"""ICAO TD3 (passport) MRZ parser — 2 lines × 44 characters."""

from __future__ import annotations

from dataclasses import dataclass, field

from app.mrz.checksum import verify_check_digit
from app.mrz.corrector import FieldKind, correct_field, normalize_sex, soft_constrain
from app.mrz.normalize import compute_age, expand_filler, parse_mrz_date


@dataclass
class Td3ParseResult:
    document_type: str = "PASSPORT"
    mrz_format: str = "TD3"
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


def parse_td3(lines: list[str]) -> Td3ParseResult:
    result = Td3ParseResult(mrz_lines=list(lines))
    if len(lines) != 2 or any(len(ln) != 44 for ln in lines):
        result.warnings.append("INVALID_TD3_LENGTH")
        return result

    line1, line2 = lines
    correction_count = 0

    doc_code, c = soft_constrain(line1[0:2], FieldKind.NAME)
    correction_count += c
    issuing, c = soft_constrain(line1[2:5], FieldKind.ALPHA)
    correction_count += c
    surname, given, name_changes = _split_names(line1[5:44])
    correction_count += name_changes
    name_field, _ = soft_constrain(line1[5:44], FieldKind.NAME)

    doc_fix = correct_field(line2[0:9], FieldKind.DOC_NUMBER, check=line2[9])
    doc_num, doc_check = doc_fix.value, line2[9]
    correction_count += doc_fix.changes

    nationality, c = soft_constrain(line2[10:13], FieldKind.ALPHA)
    correction_count += c

    dob_fix = correct_field(line2[13:19], FieldKind.NUMERIC, check=line2[19])
    dob, dob_check = dob_fix.value, line2[19]
    correction_count += dob_fix.changes

    sex, sex_changes = normalize_sex(line2[20])
    correction_count += sex_changes
    if sex == "M":
        sex_ch = "M"
    elif sex == "F":
        sex_ch = "F"
    elif sex == "X":
        sex_ch = "<"
    else:
        sex_ch = line2[20]

    exp_fix = correct_field(line2[21:27], FieldKind.NUMERIC, check=line2[27])
    exp, exp_check = exp_fix.value, line2[27]
    correction_count += exp_fix.changes

    optional_raw = line2[28:42]
    optional_check = line2[42]
    composite_check = line2[43]
    opt_changes = 0
    used_opt_search = False

    if optional_check == "<" and set(optional_raw) <= {"<"}:
        optional = optional_raw
        v_opt = True
    else:
        opt_fix = correct_field(optional_raw, FieldKind.OPTIONAL, check=optional_check)
        optional = opt_fix.value
        v_opt = opt_fix.checksum_ok
        opt_changes = opt_fix.changes
        used_opt_search = opt_fix.used_checksum_search
        correction_count += opt_changes

    v_doc = verify_check_digit(doc_num, doc_check)
    v_dob = verify_check_digit(dob, dob_check)
    v_exp = verify_check_digit(exp, exp_check)

    composite_data = doc_num + doc_check + dob + dob_check + exp + exp_check + optional + optional_check
    v_comp = verify_check_digit(composite_data, composite_check)

    if not v_comp and v_doc and v_dob and v_exp and optional_check != "<":
        opt_fix2 = correct_field(optional_raw, FieldKind.OPTIONAL, check=optional_check)
        if opt_fix2.checksum_ok:
            trial_data = (
                doc_num + doc_check + dob + dob_check + exp + exp_check + opt_fix2.value + optional_check
            )
            if verify_check_digit(trial_data, composite_check):
                optional = opt_fix2.value
                if opt_fix2.changes > opt_changes:
                    correction_count += opt_fix2.changes - opt_changes
                v_opt = True
                v_comp = True
                used_opt_search = used_opt_search or opt_fix2.used_checksum_search

    line1_fixed = (doc_code + issuing + name_field).ljust(44, "<")[:44]
    line2_fixed = (
        f"{doc_num}{doc_check}{nationality}{dob}{dob_check}{sex_ch}"
        f"{exp}{exp_check}{optional}{optional_check}{composite_check}"
    )
    if len(line1_fixed) == 44:
        line1 = line1_fixed
    if len(line2_fixed) == 44:
        line2 = line2_fixed

    dob_iso, dob_warns = parse_mrz_date(dob, is_expiry=False)
    exp_iso, exp_warns = parse_mrz_date(exp, is_expiry=True)
    warnings = list(dob_warns) + list(exp_warns)

    ocr_checksum_corrected = bool(
        (doc_fix.used_checksum_search and doc_fix.checksum_ok and doc_fix.changes > 0)
        or (dob_fix.used_checksum_search and dob_fix.checksum_ok and dob_fix.changes > 0)
        or (exp_fix.used_checksum_search and exp_fix.checksum_ok and exp_fix.changes > 0)
        or (used_opt_search and v_opt and opt_changes > 0)
    )
    if ocr_checksum_corrected:
        warnings.append("OCR_CHECKSUM_CORRECTED")

    age = compute_age(dob_iso) if dob_iso else None
    dtype_field = "PASSPORT" if doc_code.startswith("P") else doc_code.rstrip("<")

    result.fields = {
        "document_type": dtype_field,
        "issuing_country": issuing.rstrip("<"),
        "surname": surname or None,
        "given_names": given or None,
        "document_number": doc_num.rstrip("<") or None,
        "nationality": nationality.rstrip("<") or None,
        "date_of_birth": dob_iso,
        "gender": sex,
        "expiry_date": exp_iso,
        "optional_data": expand_filler(optional) if optional.strip("<") else "",
        "personal_number": expand_filler(optional) if optional.strip("<") else "",
        "age": age,
    }
    result.validation = {
        "document_number": v_doc,
        "date_of_birth": v_dob,
        "expiry_date": v_exp,
        "personal_number": v_opt,
        "composite": bool(v_comp and v_opt),
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
    result.mrz_lines = [line1, line2]
    return result
