"""ICAO 9303 check digit algorithm."""

from __future__ import annotations

WEIGHTS = (7, 3, 1)


def char_value(ch: str) -> int:
    if "0" <= ch <= "9":
        return ord(ch) - ord("0")
    if "A" <= ch <= "Z":
        return ord(ch) - ord("A") + 10
    if ch == "<":
        return 0
    raise ValueError(f"Invalid MRZ character for checksum: {ch!r}")


def compute_check_digit(data: str) -> str:
    """Return single check digit character (0-9) for the given field string."""
    total = 0
    for i, ch in enumerate(data):
        total += char_value(ch) * WEIGHTS[i % 3]
    return str(total % 10)


def verify_check_digit(data: str, check: str) -> bool:
    if not check or len(check) != 1:
        return False
    if check == "<":
        return False
    try:
        return compute_check_digit(data) == check
    except ValueError:
        return False
