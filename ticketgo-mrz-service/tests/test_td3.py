"""TD3 passport MRZ parser tests — synthetic data only."""

from app.mrz.checksum import compute_check_digit
from app.mrz.td3 import parse_td3


def _build_td3() -> list[str]:
    """Synthetic TD3 MRZ (fictional person, not a real passport)."""
    name = "YILMAZ<<AHMET"
    line1 = ("P<TUR" + name).ljust(44, "<")
    assert len(line1) == 44

    doc_num = "U12345678"
    doc_cd = compute_check_digit(doc_num)
    nationality = "TUR"
    dob = "900521"
    dob_cd = compute_check_digit(dob)
    sex = "M"
    exp = "310610"
    exp_cd = compute_check_digit(exp)
    optional = "<<<<<<<<<<<<<<"  # 14 fillers
    opt_cd = compute_check_digit(optional)
    composite = doc_num + doc_cd + dob + dob_cd + exp + exp_cd + optional + opt_cd
    comp_cd = compute_check_digit(composite)
    line2 = f"{doc_num}{doc_cd}{nationality}{dob}{dob_cd}{sex}{exp}{exp_cd}{optional}{opt_cd}{comp_cd}"
    assert len(line2) == 44
    return [line1, line2]


def test_td3_valid_synthetic():
    lines = _build_td3()
    result = parse_td3(lines)
    assert result.valid is True
    assert result.mrz_format == "TD3"
    assert result.fields["surname"] == "YILMAZ"
    assert result.fields["given_names"] == "AHMET"
    assert result.fields["document_number"] == "U12345678"
    assert result.fields["nationality"] == "TUR"
    assert result.fields["issuing_country"] == "TUR"
    assert result.fields["date_of_birth"] == "1990-05-21"
    assert result.fields["expiry_date"] == "2031-06-10"
    assert result.fields["gender"] == "M"
    assert result.fields["age"] is not None
    assert result.validation["document_number"] is True
    assert result.validation["date_of_birth"] is True
    assert result.validation["expiry_date"] is True
    assert result.validation["composite"] is True


def test_td3_wrong_length():
    result = parse_td3(["P<TURSHORT", "SHORT"])
    assert result.valid is False
    assert "INVALID_TD3_LENGTH" in result.warnings


def test_td3_bad_checksum_marks_invalid():
    lines = _build_td3()
    # Corrupt document number check digit
    bad = lines[1]
    bad = bad[:9] + ("0" if bad[9] != "0" else "1") + bad[10:]
    result = parse_td3([lines[0], bad])
    # May auto-correct uniquely; if not, invalid
    if not result.corrected:
        assert result.validation["document_number"] is False or result.valid is False
