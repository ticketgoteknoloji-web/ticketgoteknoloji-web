"""Field-aware ICAO MRZ OCR character correction (check-digit guided)."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from app.mrz.checksum import verify_check_digit

# Bidirectional OCR confusions commonly seen with OCR-B / MRZ fonts
_CONFUSION_PAIRS: tuple[tuple[str, str], ...] = (
    ("O", "0"),
    ("Q", "0"),
    ("D", "0"),
    ("I", "1"),
    ("L", "1"),
    ("Z", "2"),
    ("S", "5"),
    ("B", "8"),
    ("G", "6"),
)


class FieldKind(str, Enum):
    NUMERIC = "numeric"  # dates, check digits
    ALPHA = "alpha"  # nationality / issuing country
    NAME = "name"  # A-Z and <
    DOC_NUMBER = "doc_number"  # A-Z 0-9 <
    SEX = "sex"  # M F <
    OPTIONAL = "optional"  # A-Z 0-9 <


_CHARSETS: dict[FieldKind, set[str]] = {
    FieldKind.NUMERIC: set("0123456789"),
    FieldKind.ALPHA: set("ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
    FieldKind.NAME: set("ABCDEFGHIJKLMNOPQRSTUVWXYZ<"),
    FieldKind.DOC_NUMBER: set("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<"),
    FieldKind.SEX: set("MF<"),
    FieldKind.OPTIONAL: set("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<"),
}


def _alts_for(ch: str, kind: FieldKind) -> list[str]:
    """OCR confusion alternatives that remain inside the field charset."""
    charset = _CHARSETS[kind]
    alts: list[str] = []
    for a, b in _CONFUSION_PAIRS:
        if ch == a and b in charset:
            alts.append(b)
        elif ch == b and a in charset:
            alts.append(a)
    # Sex: keep small extra set of common misreads (still within charset)
    if kind == FieldKind.SEX and ch not in charset:
        for guess in ("M", "F", "<"):
            if guess in charset:
                alts.append(guess)
    # Deduplicate preserving order
    seen: set[str] = set()
    out: list[str] = []
    for x in alts:
        if x != ch and x not in seen:
            seen.add(x)
            out.append(x)
    return out


def soft_constrain(value: str, kind: FieldKind) -> tuple[str, int]:
    """
    Map characters that are outside the field charset using confusion tables.
    Never rewrite characters that already belong to the charset (no blind O→0
    inside alphanumeric document numbers).
    """
    charset = _CHARSETS[kind]
    out: list[str] = []
    changes = 0
    for ch in value:
        if ch in charset:
            out.append(ch)
            continue
        alts = _alts_for(ch, kind)
        # Prefer the first alternative that is in charset (already filtered)
        if len(alts) == 1:
            out.append(alts[0])
            changes += 1
        elif len(alts) > 1:
            # Prefer digit when numeric field, letter when alpha/name
            if kind == FieldKind.NUMERIC:
                pick = next((a for a in alts if a.isdigit()), alts[0])
            elif kind in (FieldKind.ALPHA, FieldKind.NAME, FieldKind.SEX):
                pick = next((a for a in alts if a.isalpha() or a == "<"), alts[0])
            else:
                pick = alts[0]
            out.append(pick)
            changes += 1
        else:
            # Irrecoverable for this field — keep original (checksum will fail)
            out.append(ch)
    return "".join(out), changes


@dataclass
class FieldCorrection:
    value: str
    changes: int
    checksum_ok: bool
    used_checksum_search: bool = False


def correct_field(
    value: str,
    kind: FieldKind,
    *,
    check: str | None = None,
    max_positions: int = 2,
) -> FieldCorrection:
    """
    Constrain to field charset; if a check digit is provided, search OCR
    confusion candidates and keep only checksum-passing ICAO-valid results.
    """
    constrained, soft_changes = soft_constrain(value, kind)
    charset = _CHARSETS[kind]

    if check is None:
        return FieldCorrection(value=constrained, changes=soft_changes, checksum_ok=False)

    if verify_check_digit(constrained, check) and set(constrained) <= charset | set(constrained):
        # Ensure every char is allowed
        if all(c in charset for c in constrained):
            return FieldCorrection(
                value=constrained,
                changes=soft_changes,
                checksum_ok=True,
                used_checksum_search=False,
            )

    # Build candidate pool starting from constrained (and raw if different)
    seeds = [constrained]
    if value != constrained:
        seeds.append(value)

    best: FieldCorrection | None = None

    def consider(candidate: str, base_changes: int, searched: bool) -> None:
        nonlocal best
        if len(candidate) != len(value):
            return
        if not all(c in charset for c in candidate):
            return
        if not verify_check_digit(candidate, check):
            return
        # count diffs vs original OCR value
        diffs = sum(1 for a, b in zip(candidate, value) if a != b)
        # Prefer fewer total diffs; tie-break: fewer soft+search changes, then stable string
        score = (diffs, base_changes, candidate)
        current = FieldCorrection(
            value=candidate,
            changes=diffs,
            checksum_ok=True,
            used_checksum_search=searched,
        )
        if best is None:
            best = current
            return
        best_score = (
            sum(1 for a, b in zip(best.value, value) if a != b),
            best.changes,
            best.value,
        )
        if score < best_score:
            best = current

    for seed in seeds:
        if all(c in charset for c in seed):
            consider(seed, soft_changes if seed == constrained else 0, searched=False)

    # Single-position search
    for seed in seeds:
        for i, ch in enumerate(seed):
            for alt in _alts_for(ch, kind):
                trial = seed[:i] + alt + seed[i + 1 :]
                consider(trial, soft_changes + 1, searched=True)

    # Two-position search if needed
    if best is None and max_positions >= 2:
        for seed in seeds:
            n = len(seed)
            for i in range(n):
                alts_i = _alts_for(seed[i], kind)
                if not alts_i:
                    continue
                for j in range(i + 1, n):
                    alts_j = _alts_for(seed[j], kind)
                    if not alts_j:
                        continue
                    for a in alts_i:
                        for b in alts_j:
                            trial = seed[:i] + a + seed[i + 1 : j] + b + seed[j + 1 :]
                            consider(trial, soft_changes + 2, searched=True)

    if best is not None:
        return best

    # No checksum-passing candidate — return constrained (may be invalid)
    return FieldCorrection(
        value=constrained,
        changes=soft_changes,
        checksum_ok=verify_check_digit(constrained, check),
        used_checksum_search=True,
    )


def normalize_sex(ch: str) -> tuple[str | None, int]:
    constrained, changes = soft_constrain((ch or "<")[:1], FieldKind.SEX)
    from app.mrz.normalize import parse_sex

    return parse_sex(constrained), changes
