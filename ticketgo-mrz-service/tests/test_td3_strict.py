"""Strict TD3 line selection — reject visual-zone fakes; no '<' padding."""

from app.mrz.parser import _find_td3, parse_mrz_lines
from app.mrz.checksum import compute_check_digit


def _real_td3() -> list[str]:
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
    return [line1, line2]


def test_find_td3_requires_p_prefix():
    # Two 44-char visual-zone-like lines without P< must not be accepted
    fake1 = ("SURNAME<<GIVEN" + "<" * 30)[:44]
    fake2 = ("A" * 44)
    assert not fake1.startswith("P<")
    assert _find_td3([fake1, fake2]) is None


def test_find_td3_accepts_real_pair():
    lines = _real_td3()
    found = _find_td3(lines)
    assert found is not None
    assert found[0].startswith("P<")
    assert len(found[0]) == 44 and len(found[1]) == 44


def test_find_td3_does_not_pad_short_lines():
    short = "P<TURYILMAZ<<AHMET<<<<<<<<<<<"  # < 44
    assert len(short) < 44
    assert _find_td3([short, "U123456784TUR9005215M3106109<<<<<<<<<<<<<<00"]) is None


def test_require_valid_rejects_bad_checksum_pair():
    line1 = ("P<TURYILMAZ<<AHMET").ljust(44, "<")
    bad_line2 = "U123456780TUR9005210M3106100<<<<<<<<<<<<<<00"  # likely bad checks
    assert len(line1) == 44 and len(bad_line2) == 44
    parsed = parse_mrz_lines(
        [line1, bad_line2],
        document_hint="passport",
        require_valid=True,
    )
    # Either None or only if somehow valid — for this crafted bad pair expect None
    if parsed is not None:
        assert parsed.valid is True
    # Crafted digits almost certainly invalid:
    from app.mrz.td3 import parse_td3

    assert parse_td3([line1, bad_line2]).valid is False
    assert parsed is None


def test_visual_zone_noise_ignored_when_real_present():
    real = _real_td3()
    noise = [
        "REPUBLIC OF TURKEY<<<<<<<<<<<<<<<<<<<",
        "PASSPORT<<<<<<<<<<<<<<<<<<<<<<<<<<<<<",
        ("NAME<<SURNAME" + "<" * 40)[:44],
    ]
    found = _find_td3(noise + real)
    assert found is not None
    assert found[0].startswith("P<TUR")
    assert found[0] == real[0]
