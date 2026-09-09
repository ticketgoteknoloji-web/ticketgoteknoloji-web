"""TD1 ID-card MRZ parser tests — synthetic data only."""

from app.mrz.checksum import compute_check_digit
from app.mrz.td1 import parse_td1


def _build_td1() -> list[str]:
    """Synthetic TD1 MRZ (fictional person, not a real ID)."""
    doc_code = "I<"
    issuing = "TUR"
    doc_num = "A12345678"
    doc_cd = compute_check_digit(doc_num)
    optional1 = "<<<<<<<<<<<<<<<"  # 15
    line1 = f"{doc_code}{issuing}{doc_num}{doc_cd}{optional1}"
    assert len(line1) == 30

    dob = "900521"
    dob_cd = compute_check_digit(dob)
    sex = "M"
    exp = "310610"
    exp_cd = compute_check_digit(exp)
    nationality = "TUR"
    optional2 = "<<<<<<<<<<<"  # 11
    composite = doc_num + doc_cd + optional1 + dob + dob_cd + exp + exp_cd + optional2
    comp_cd = compute_check_digit(composite)
    line2 = f"{dob}{dob_cd}{sex}{exp}{exp_cd}{nationality}{optional2}{comp_cd}"
    assert len(line2) == 30

    line3 = "YILMAZ<<AHMET".ljust(30, "<")
    assert len(line3) == 30
    return [line1, line2, line3]


def test_td1_valid_synthetic():
    lines = _build_td1()
    result = parse_td1(lines)
    assert result.valid is True
    assert result.mrz_format == "TD1"
    assert result.document_type == "ID_CARD"
    assert result.fields["surname"] == "YILMAZ"
    assert result.fields["given_names"] == "AHMET"
    assert result.fields["document_number"] == "A12345678"
    assert result.fields["nationality"] == "TUR"
    assert result.fields["date_of_birth"] == "1990-05-21"
    assert result.fields["expiry_date"] == "2031-06-10"
    assert result.fields["gender"] == "M"
    assert result.fields["age"] is not None
    assert result.validation["composite"] is True


def test_td1_wrong_length():
    result = parse_td1(["I<TUR", "SHORT", "NAME"])
    assert result.valid is False
    assert "INVALID_TD1_LENGTH" in result.warnings
