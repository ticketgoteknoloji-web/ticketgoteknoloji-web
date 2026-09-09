"""Unit tests for ICAO 9303 check digits."""

from app.mrz.checksum import compute_check_digit, verify_check_digit


def test_digit_values():
    assert compute_check_digit("0") == "0"
    assert compute_check_digit("9") == "3"  # 9*7 % 10 = 3


def test_letter_and_filler():
    # A=10 → 10*7=70 → 0
    assert compute_check_digit("A") == "0"
    assert compute_check_digit("<") == "0"


def test_icao_example_document_number():
    # Classic ICAO sample document number L898902C3 check 6
    assert compute_check_digit("L898902C3") == "6"
    assert verify_check_digit("L898902C3", "6")


def test_icao_example_dob():
    assert compute_check_digit("740812") == "2"
    assert verify_check_digit("740812", "2")


def test_icao_example_expiry():
    assert compute_check_digit("120415") == "9"
    assert verify_check_digit("120415", "9")


def test_reject_invalid():
    assert not verify_check_digit("L898902C3", "0")
    assert not verify_check_digit("L898902C3", "")
    assert not verify_check_digit("L898902C3", "<")
