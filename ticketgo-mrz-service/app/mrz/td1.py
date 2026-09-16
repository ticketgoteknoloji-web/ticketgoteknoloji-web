"""ICAO TD1 (ID card) MRZ parser — 3 lines × 30 characters."""

from __future__ import annotations

from dataclasses import dataclass, field

from app.mrz.checksum import verify_check_digit
from app.mrz.corrector import FieldKind, correct_field, normalize_sex, soft_constrain
from app.mrz.normalize import compute_age, expand_filler, parse_mrz_date


@dataclass
class Td1ParseResult:
    document_type: str = "ID_CARD"
    mrz_format: str = "TD1"
    valid: bool = False
    fields: dict = field(default_factory=dict)
    validation: dict = field(default_factory=dict)
    mrz_lines: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    corrected: bool = False
    correction_count: int = 0


def _split_names(name_field: str) -> tuple[str, str, int]:
    constrained, changes = soft_constrain(name_field, FieldKind.NAME)
    parts = constrained.split("<<", 1)
    surname = expand_filler(parts[0]) if parts else ""
    given = expand_filler(parts[1]) if len(parts) > 1 else ""
    return surname, given, changes


def parse_td1(lines: list[str]) -> Td1ParseResult:
    result = Td1ParseResult(mrz_lines=list(lines))
    if len(lines) != 3 or any(len(ln) != 30 for ln in lines):
        result.warnings.append("INVALID_TD1_LENGTH")
        return result

    line1, line2, line3 = lines
    correction_count = 0

    doc_code, c = soft_constrain(line1[0:2], FieldKind.NAME)
    correction_count += c
    issuing, c = soft_constrain(line1[2:5], FieldKind.ALPHA)
    correction_count += c

    doc_fix = correct_field(line1[5:14], FieldKind.DOC_NUMBER, check=line1[14])
    doc_num, doc_check = doc_fix.value, line1[14]
    correction_count += doc_fix.changes

    optional1, c = soft_constrain(line1[15:30], FieldKind.OPTIONAL)
    correction_count += c

    dob_fix = correct_field(line2[0:6], FieldKind.NUMERIC, check=line2[6])
    dob, dob_check = dob_fix.value, line2[6]
    correction_count += dob_fix.changes

    sex, sex_changes = normalize_sex(line2[7])
    correction_count += sex_changes
    if sex == "M":
        sex_ch = "M"
    elif sex == "F":
        sex_ch = "F"
    elif sex == "X":
        sex_ch = "<"
    else:
        sex_ch = line2[7]

    exp_fix = correct_field(line2[8:14], FieldKind.NUMERIC, check=line2[14])
    exp, exp_check = exp_fix.value, line2[14]
    correction_count += exp_fix.changes

    nationality, c = soft_constrain(line2[15:18], FieldKind.ALPHA)
    correction_count += c

    optional2, c = soft_constrain(line2[18:29], FieldKind.OPTIONAL)
    correction_count += c
    composite_check = line2[29]

    surname, given, name_changes = _split_names(line3[0:30])
    correction_count += name_changes
    name_field, _ = soft_constrain(line3[0:30], FieldKind.NAME)

    v_doc = verify_check_digit(doc_num, doc_check)
    v_dob = verify_check_digit(dob, dob_check)
    v_exp = verify_check_digit(exp, exp_check)

    composite_data = doc_num + doc_check + optional1 + dob + dob_check + exp + exp_check + optional2
    v_comp = verify_check_digit(composite_data, composite_check)

    # If composite fails, try optional field OCR confusions guided by composite check
    if not v_comp and v_doc and v_dob and v_exp:
        # Search single-char fixes on optional1/optional2 jointly via correct_field on concatenated optional
        # Prefer optional1 corrections (longer)
        for kind_slice, start, end, current in (
            (FieldKind.OPTIONAL, 0, 15, optional1),
            (FieldKind.OPTIONAL, 0, 11, optional2),
        ):
            _ = kind_slice, start, end, current
        # Brute single-position on optional1 then optional2
        from app.mrz.corrector import _alts_for

        fixed = False
        for i, ch in enumerate(optional1):
            for alt in _alts_for(ch, FieldKind.OPTIONAL):
                trial_opt1 = optional1[:i] + alt + optional1[i + 1 :]
                trial = doc_num + doc_check + trial_opt1 + dob + dob_check + exp + exp_check + optional2
                if verify_check_digit(trial, composite_check):
                    optional1 = trial_opt1
                    correction_count += 1
                    v_comp = True
                    fixed = True
                    break
            if fixed:
                break
        if not fixed:
            for i, ch in enumerate(optional2):
                for alt in _alts_for(ch, FieldKind.OPTIONAL):
                    trial_opt2 = optional2[:i] + alt + optional2[i + 1 :]
                    trial = doc_num + doc_check + optional1 + dob + dob_check + exp + exp_check + trial_opt2
                    if verify_check_digit(trial, composite_check):
                        optional2 = trial_opt2
                        correction_count += 1
                        v_comp = True
                        fixed = True
                        break
                if fixed:
                    break

    line1_fixed = f"{doc_code}{issuing}{doc_num}{doc_check}{optional1}"
    line2_fixed = f"{dob}{dob_check}{sex_ch}{exp}{exp_check}{nationality}{optional2}{composite_check}"
    line3_fixed = name_field.ljust(30, "<")[:30]
    if len(line1_fixed) == 30:
        line1 = line1_fixed
    if len(line2_fixed) == 30:
        line2 = line2_fixed
    if len(line3_fixed) == 30:
        line3 = line3_fixed

    dob_iso, dob_warns = parse_mrz_date(dob, is_expiry=False)
    exp_iso, exp_warns = parse_mrz_date(exp, is_expiry=True)
    warnings = list(dob_warns) + list(exp_warns)

    ocr_checksum_corrected = bool(
        (doc_fix.used_checksum_search and doc_fix.checksum_ok and doc_fix.changes > 0)
        or (dob_fix.used_checksum_search and dob_fix.checksum_ok and dob_fix.changes > 0)
        or (exp_fix.used_checksum_search and exp_fix.checksum_ok and exp_fix.changes > 0)
    )
    if ocr_checksum_corrected:
        warnings.append("OCR_CHECKSUM_CORRECTED")

    optional_combined = (optional1 + optional2).rstrip("<")
    age = compute_age(dob_iso) if dob_iso else None
    code_clean = doc_code.rstrip("<")
    dtype_field_code = code_clean if code_clean else "I"

    result.fields = {
        "document_type": dtype_field_code,
        "issuing_country": issuing.rstrip("<"),
        "surname": surname or None,
        "given_names": given or None,
        "document_number": doc_num.rstrip("<") or None,
        "nationality": nationality.rstrip("<") or None,
        "date_of_birth": dob_iso,
        "gender": sex,
        "expiry_date": exp_iso,
        "optional_data": expand_filler(optional_combined) if optional_combined else "",
        "personal_number": None,
        "age": age,
    }
    result.validation = {
        "document_number": v_doc,
        "date_of_birth": v_dob,
        "expiry_date": v_exp,
        "personal_number": True,
        "composite": v_comp,
        "ocr_checksum_corrected": ocr_checksum_corrected,
    }
    result.valid = all(
        [
            result.validation["document_number"],
            result.validation["date_of_birth"],
            result.validation["expiry_date"],
            result.validation["composite"],
            dob_iso is not None,
            exp_iso is not None,
        ]
    )
    result.warnings = warnings
    result.corrected = correction_count > 0
    result.correction_count = int(correction_count)
    result.mrz_lines = [line1, line2, line3]
    result.document_type = "ID_CARD"
    return result
