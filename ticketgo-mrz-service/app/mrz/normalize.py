"""Date and MRZ string normalization helpers."""

from __future__ import annotations

from datetime import date, datetime, timezone


MRZ_CHARS = set("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<")

# Common OCR confusions in MRZ context (letter ↔ digit)
DIGIT_CONFUSIONS = {
    "O": "0",
    "Q": "0",
    "D": "0",
    "I": "1",
    "L": "1",
    "Z": "2",
    "S": "5",
    "B": "8",
    "G": "6",
}
LETTER_CONFUSIONS = {
    "0": "O",
    "1": "I",
    "2": "Z",
    "5": "S",
    "8": "B",
    "6": "G",
}


def clean_mrz_text(text: str) -> str:
    """Uppercase, strip spaces, keep only A-Z 0-9 <."""
    out: list[str] = []
    for ch in text.upper():
        if ch in (" ", "\t", "\n", "\r", "|"):
            continue
        if ch == "«":
            out.append("<")
            continue
        if ch in MRZ_CHARS:
            out.append(ch)
    return "".join(out)


def expand_filler(value: str) -> str:
    """Strip trailing fillers and replace internal < with space for names."""
    return value.rstrip("<").replace("<", " ").strip()


def parse_sex(ch: str) -> str | None:
    if ch in ("M", "F"):
        return ch
    if ch == "<":
        return "X"
    return None


def _century_for_yy(yy: int, *, is_expiry: bool, today: date) -> int:
    """Choose 19xx vs 20xx using reasonable passport/ID rules."""
    full_1900 = 1900 + yy
    full_2000 = 2000 + yy
    if is_expiry:
        # Expiry: prefer the date closest to today within ~15 years past / 30 future
        candidates = [full_1900, full_2000]
        best = min(candidates, key=lambda y: abs((date(y, 1, 1) - today).days))
        return best
    # Birth: cannot be in the future; prefer 1900+ if 2000+ would be future
    if full_2000 > today.year:
        return full_1900
    # Prefer younger if both plausible (age < 100)
    age_2000 = today.year - full_2000
    if 0 <= age_2000 <= 100:
        return full_2000
    return full_1900


def parse_mrz_date(yymmdd: str, *, is_expiry: bool = False, today: date | None = None) -> tuple[str | None, list[str]]:
    """
    Convert YYMMDD to ISO YYYY-MM-DD.
    Returns (iso_or_none, warnings).
    """
    warnings: list[str] = []
    if len(yymmdd) != 6 or not yymmdd.isdigit():
        return None, warnings
    today = today or datetime.now(timezone.utc).date()
    yy = int(yymmdd[0:2])
    mm = int(yymmdd[2:4])
    dd = int(yymmdd[4:6])
    year = _century_for_yy(yy, is_expiry=is_expiry, today=today)
    try:
        d = date(year, mm, dd)
    except ValueError:
        return None, warnings
    if not is_expiry and d > today:
        # Birth in the future — try alternate century once
        alt = 1900 + yy if year >= 2000 else 2000 + yy
        try:
            d2 = date(alt, mm, dd)
        except ValueError:
            return None, warnings
        if d2 > today:
            return None, warnings
        d = d2
    iso = d.isoformat()
    if is_expiry and d < today:
        warnings.append("DOCUMENT_EXPIRED")
    return iso, warnings


def compute_age(iso_dob: str, today: date | None = None) -> int | None:
    today = today or datetime.now(timezone.utc).date()
    try:
        dob = date.fromisoformat(iso_dob)
    except ValueError:
        return None
    if dob > today:
        return None
    years = today.year - dob.year
    if (today.month, today.day) < (dob.month, dob.day):
        years -= 1
    return years


def force_digits(s: str) -> str:
    return "".join(DIGIT_CONFUSIONS.get(ch, ch) for ch in s)


def force_letters(s: str) -> str:
    return "".join(LETTER_CONFUSIONS.get(ch, ch) for ch in s)
