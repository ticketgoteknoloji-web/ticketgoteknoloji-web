"""Field-aware OCR correction unit tests (synthetic only)."""

from app.mrz.checksum import compute_check_digit
from app.mrz.corrector import FieldKind, correct_field, soft_constrain
from app.mrz.td3 import parse_td3


def test_numeric_soft_constrain_o_to_zero():
    out, n = soft_constrain("9OO521", FieldKind.NUMERIC)
    assert out == "900521"
    assert n == 2


def test_doc_number_does_not_blind_force_letter_u():
    # U is valid in DOC_NUMBER — must not become 0
    out, n = soft_constrain("U12345678", FieldKind.DOC_NUMBER)
    assert out == "U12345678"
    assert n == 0


def test_nationality_digits_to_letters():
    out, n = soft_constrain("T0R", FieldKind.ALPHA)
    assert out == "TOR"
    assert n == 1


def test_checksum_guided_doc_fix():
    doc = "U12345678"
    check = compute_check_digit(doc)
    # OCR read B instead of 8 (letter/digit confusion inside alphanumeric doc number)
    bad = "U1234567B"
    fixed = correct_field(bad, FieldKind.DOC_NUMBER, check=check)
    assert fixed.checksum_ok
    assert fixed.value == doc
    assert fixed.used_checksum_search is True


def test_td3_ocr_confusions_still_valid():
    name = "YILMAZ<<AHMET"
    line1 = ("P<TUR" + name).ljust(44, "<")
    doc_num = "U12345678"
    doc_cd = compute_check_digit(doc_num)
    dob = "900521"
    dob_cd = compute_check_digit(dob)
    exp = "310610"
    exp_cd = compute_check_digit(exp)
    optional = "<<<<<<<<<<<<<<"
    opt_cd = compute_check_digit(optional)
    composite = doc_num + doc_cd + dob + dob_cd + exp + exp_cd + optional + opt_cd
    line2 = f"{doc_num}{doc_cd}TUR{dob}{dob_cd}M{exp}{exp_cd}{optional}{opt_cd}{compute_check_digit(composite)}"
    corrupted = list(line2)
    # dob 900521 → 9O0521 (single O/0 confusion)
    corrupted[14] = "O"
    result = parse_td3([line1, "".join(corrupted)])
    assert result.valid is True
    assert result.fields["date_of_birth"] == "1990-05-21"
    assert result.correction_count >= 1
    assert result.validation["document_number"] is True
    assert result.validation["date_of_birth"] is True
    assert result.validation["expiry_date"] is True
    assert result.validation["composite"] is True