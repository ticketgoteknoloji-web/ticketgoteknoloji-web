"""Extract MRZ line candidates from OCR text and route to TD1/TD3 parsers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.mrz.normalize import clean_mrz_text
from app.mrz.td1 import Td1ParseResult, parse_td1
from app.mrz.td3 import Td3ParseResult, parse_td3

Hint = Literal["auto", "passport", "id_card"]


@dataclass
class ParsedMrz:
    document_type: Literal["PASSPORT", "ID_CARD"]
    mrz_format: Literal["TD1", "TD3"]
    valid: bool
    fields: dict
    validation: dict
    mrz_lines: list[str]
    warnings: list[str]
    confidence: float
    corrected: bool = False
    correction_count: int = 0
    # Finder metadata only — never copied into the HTTP response body.
    debug: dict | None = None


def extract_mrz_candidate_lines(ocr_texts: list[str]) -> list[str]:
    """From raw OCR strings, produce cleaned lines that look like MRZ."""
    lines: list[str] = []
    for raw in ocr_texts:
        for part in raw.replace("\r", "\n").split("\n"):
            cleaned = clean_mrz_text(part)
            if len(cleaned) < 20:
                continue
            if len(cleaned) >= 28:
                lines.append(cleaned)
    return lines


def _pad_or_trim_td1(line: str, length: int) -> str | None:
    """TD1 only: allow small pad/trim. Never used for TD3/passport."""
    if len(line) == length:
        return line
    if len(line) > length:
        # Prefer a window that starts with a TD1 document code when possible.
        if length == 30 and len(line) <= 36:
            for i in range(0, len(line) - length + 1):
                win = line[i : i + length]
                if win and win[0] in "IAC":
                    return win
        return line[:length]
    if length - len(line) <= 4:
        return line + ("<" * (length - len(line)))
    return None


def _td3_line1_ok(line: str) -> bool:
    return len(line) == 44 and line.startswith("P<") and all(ch in "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<" for ch in line)


def _td3_line2_ok(line: str) -> bool:
    if len(line) != 44:
        return False
    if line.startswith("P<"):
        return False
    if not all(ch in "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<" for ch in line):
        return False
    alnum = sum(ch.isalnum() for ch in line)
    return alnum >= 20


def _extract_td3_window(text: str) -> str | None:
    """
    If OCR glued extra chars, take a real 44-char window starting at P<.
    Does not invent missing characters or pad with '<'.
    """
    cleaned = clean_mrz_text(text)
    idx = cleaned.find("P<")
    if idx < 0:
        return None
    window = cleaned[idx : idx + 44]
    if len(window) != 44 or not window.startswith("P<"):
        return None
    return window


def _line1_windows(text: str) -> list[str]:
    cleaned = clean_mrz_text(text)
    out: list[str] = []
    start = 0
    while True:
        idx = cleaned.find("P<", start)
        if idx < 0:
            break
        window = cleaned[idx : idx + 44]
        if len(window) == 44 and _td3_line1_ok(window):
            out.append(window)
        # 88-char glued TD3: P< line1 + line2
        glued = cleaned[idx : idx + 88]
        if len(glued) == 88 and _td3_line1_ok(glued[:44]) and _td3_line2_ok(glued[44:]):
            out.append(glued[:44])
        start = idx + 1
    if cleaned.startswith("P<") and len(cleaned) == 44 and _td3_line1_ok(cleaned):
        out.append(cleaned)
    # unique preserve order
    seen: set[str] = set()
    uniq: list[str] = []
    for ln in out:
        if ln not in seen:
            seen.add(ln)
            uniq.append(ln)
    return uniq


def _line2_window_score(window: str) -> int:
    """Rank exact 44-char slices that already look like a TD3 line 2. No padding."""
    if not _td3_line2_ok(window):
        return -1
    fillers = window.count("<")
    digits = sum(ch.isdigit() for ch in window)
    # Typical TD3 line 2 has date digits around cols 14–19 and 22–27 (0-based 13, 21).
    date_hits = sum(ch.isdigit() for ch in window[13:19] + window[21:27])
    return fillers + digits + date_hits


def _line2_windows(text: str) -> list[str]:
    cleaned = clean_mrz_text(text)
    out: list[str] = []
    if _td3_line2_ok(cleaned):
        out.append(cleaned)
    if len(cleaned) > 44:
        scored: list[tuple[int, int, str]] = []
        step = 1 if len(cleaned) <= 80 else 2
        for i in range(0, len(cleaned) - 43, step):
            window = cleaned[i : i + 44]
            score = _line2_window_score(window)
            if score >= 0:
                scored.append((score, -i, window))
        scored.sort(reverse=True)
        for _, _, window in scored[:8]:
            out.append(window)
    seen: set[str] = set()
    uniq: list[str] = []
    for ln in out:
        if ln not in seen:
            seen.add(ln)
            uniq.append(ln)
    return uniq


def _checksum_pass_count(parsed: Td3ParseResult) -> int:
    return sum(
        1
        for key in (
            "document_number",
            "date_of_birth",
            "expiry_date",
            "personal_number",
            "composite",
        )
        if parsed.validation.get(key) is True
    )


def iter_td3_pairs(lines: list[str]) -> list[list[str]]:
    """
    All exact 2×44 TD3 candidates.
    Line 1 must start with P<. No '<' padding. No visual-zone pairs without P<.
    """
    cleaned = [clean_mrz_text(x) for x in lines if x]
    cleaned = [x for x in cleaned if len(x) >= 20]
    pairs: list[list[str]] = []
    seen: set[tuple[str, str]] = set()

    def add(a: str, b: str) -> None:
        if not _td3_line1_ok(a) or not _td3_line2_ok(b):
            return
        key = (a, b)
        if key in seen:
            return
        seen.add(key)
        pairs.append([a, b])

    # Adjacent OCR order (typical two-line recognition)
    for i in range(len(cleaned) - 1):
        for a in _line1_windows(cleaned[i]) or ([cleaned[i]] if _td3_line1_ok(cleaned[i]) else []):
            for b in _line2_windows(cleaned[i + 1]) or ([cleaned[i + 1]] if _td3_line2_ok(cleaned[i + 1]) else []):
                add(a, b)
        # glued 88 on a single OCR row
        if len(cleaned[i]) >= 88 and cleaned[i].startswith("P<"):
            add(cleaned[i][:44], cleaned[i][44:88])

    for ln in cleaned:
        if len(ln) == 88 and ln.startswith("P<"):
            add(ln[:44], ln[44:88])
        idx = ln.find("P<")
        if idx >= 0 and len(ln) - idx >= 88:
            add(ln[idx : idx + 44], ln[idx + 44 : idx + 88])

    line1s: list[str] = []
    line2s: list[str] = []
    for ln in cleaned:
        line1s.extend(_line1_windows(ln))
        line2s.extend(_line2_windows(ln))
        if _td3_line1_ok(ln):
            line1s.append(ln)
        if _td3_line2_ok(ln):
            line2s.append(ln)

    for a in line1s[:16]:
        for b in line2s[:16]:
            add(a, b)

    return pairs


def _find_td3(lines: list[str]) -> list[str] | None:
    """
    Strict TD3 selection:
    - Line 1 must start with P<
    - Exact 2 × 44 only (no '<' padding of short lines)
    - Prefer the pair with the most ICAO check digits passing
    - Never accept arbitrary 44-char visual-zone pairs
    """
    pairs = iter_td3_pairs(lines)
    if not pairs:
        return None
    scored: list[tuple[int, int, list[str]]] = []
    for pair in pairs:
        parsed = parse_td3(pair)
        passed = _checksum_pass_count(parsed)
        scored.append((1 if parsed.valid else 0, passed, pair))
    scored.sort(key=lambda t: (t[0], t[1]), reverse=True)
    return scored[0][2]


def _td1_start(ch: str) -> bool:
    return ch in ("I", "A", "C", "1")  # 1 is common OCR confusion for I


def _normalize_td1_prefix(line: str) -> str:
    """Fix TD1 document-code OCR confusions (line 1 only). Never touch date lines."""
    if len(line) < 5:
        return line
    chars = list(line)
    # Doc codes are I</A</C< — leading 1/< confusions only in that pattern.
    if chars[0] in ("1", "L", "|") and chars[1] in ("<", "C", "E", "("):
        chars[0] = "I"
    if chars[0] == "I" and chars[1] in ("C", "E", "("):
        chars[1] = "<"
    # Require issuing-state-looking alpha at 2:5 after fix; otherwise leave untouched.
    if chars[0] in ("I", "A", "C") and chars[1] == "<":
        if not all(ch.isalpha() for ch in chars[2:5]):
            return line
        return "".join(chars)
    return line


def _find_td1(lines: list[str]) -> list[str] | None:
    cleaned = [clean_mrz_text(x) for x in lines if x]
    cleaned = [x for x in cleaned if len(x) >= 20]

    def windows_from_blob(blob: str) -> list[str] | None:
        blob = _normalize_td1_prefix(blob) if blob[:1] in "1IL|AC" else blob
        variants = [blob]
        if blob.startswith("P<") and len(blob) >= 75:
            variants.append("I<" + blob[2:])
        for src in variants:
            # Real-card OCR often drops a few fillers (<) — pad short blobs to 90.
            if 75 <= len(src) < 90:
                src = src + ("<" * (90 - len(src)))
            if len(src) < 90:
                continue
            limit = min(48, len(src) - 90)
            for i in range(0, limit + 1):
                a, b, c = src[i : i + 30], src[i + 30 : i + 60], src[i + 60 : i + 90]
                a = _normalize_td1_prefix(a)
                if a and a[0] in ("I", "A", "C") and all(len(x) == 30 for x in (a, b, c)):
                    parsed = parse_td1([a, b, c])
                    if parsed.valid:
                        return [a, b, c]
        return None

    for ln in cleaned:
        if len(ln) >= 75:
            hit = windows_from_blob(ln)
            if hit:
                return hit

    blob = "".join(cleaned)
    hit = windows_from_blob(blob)
    if hit:
        return hit

    # Two OCR rows that look like glued TD1 (e.g. 39+43) — pad and window.
    if len(cleaned) == 2 and all(34 <= len(x) <= 50 for x in cleaned):
        hit = windows_from_blob("".join(cleaned))
        if hit:
            return hit

    exact = [ln for ln in cleaned if len(ln) == 30]
    if len(exact) >= 3:
        for i in range(len(exact) - 2):
            trio = [_normalize_td1_prefix(exact[i]), exact[i + 1], exact[i + 2]]
            if trio[0][0] in ("I", "A", "C") and parse_td1(trio).valid:
                return trio

    near: list[str] = []
    for ln in cleaned:
        if 20 <= len(ln) <= 36:
            padded = _pad_or_trim_td1(ln, 30)
            if padded:
                near.append(padded)
    if len(near) >= 3:
        for i in range(len(near) - 2):
            trio = [_normalize_td1_prefix(near[i]), near[i + 1], near[i + 2]]
            if trio[0][0] not in ("I", "A", "C"):
                continue
            if parse_td1(trio).valid:
                return trio
    return None


def parse_mrz_lines(
    ocr_texts: list[str],
    *,
    document_hint: Hint = "auto",
    ocr_confidence: float = 0.0,
    require_valid: bool = False,
) -> ParsedMrz | None:
    """
    Parse OCR texts into MRZ.
    If require_valid=True (passport pipeline), only return checksum-valid TD3.
    """
    candidates = extract_mrz_candidate_lines(ocr_texts)
    if not candidates:
        return None

    td1_lines = _find_td1(candidates) if document_hint in ("auto", "id_card") else None

    results: list[ParsedMrz] = []

    if document_hint in ("auto", "passport"):
        for pair in iter_td3_pairs(candidates):
            if len(pair) != 2 or not all(len(x) == 44 for x in pair) or not pair[0].startswith("P<"):
                continue
            r: Td3ParseResult = parse_td3(pair)
            if require_valid and not r.valid:
                continue
            conf = ocr_confidence
            if r.valid:
                conf = max(conf, 0.9)
            elif any(v for k, v in r.validation.items() if k != "ocr_checksum_corrected"):
                conf = max(conf, 0.55)
            results.append(
                ParsedMrz(
                    document_type="PASSPORT",
                    mrz_format="TD3",
                    valid=r.valid,
                    fields=r.fields,
                    validation=r.validation,
                    mrz_lines=r.mrz_lines,
                    warnings=r.warnings,
                    confidence=min(1.0, conf),
                    corrected=r.corrected,
                    correction_count=r.correction_count,
                )
            )

    if td1_lines and len(td1_lines) == 3 and all(len(x) == 30 for x in td1_lines):
        r1: Td1ParseResult = parse_td1(td1_lines)
        conf = ocr_confidence
        if r1.valid:
            conf = max(conf, 0.9)
        elif any(v for k, v in r1.validation.items() if k != "ocr_checksum_corrected"):
            conf = max(conf, 0.55)
        results.append(
            ParsedMrz(
                document_type="ID_CARD",
                mrz_format="TD1",
                valid=r1.valid,
                fields=r1.fields,
                validation=r1.validation,
                mrz_lines=r1.mrz_lines,
                warnings=r1.warnings,
                confidence=min(1.0, conf),
                corrected=r1.corrected,
                correction_count=r1.correction_count,
            )
        )

    if not results:
        return None

    def score(p: ParsedMrz) -> tuple:
        hint_bonus = 0
        if document_hint == "passport" and p.mrz_format == "TD3":
            hint_bonus = 1
        if document_hint == "id_card" and p.mrz_format == "TD1":
            hint_bonus = 1
        checksums = sum(
            1 for k, v in p.validation.items() if k != "ocr_checksum_corrected" and v
        )
        p_prefix = 1 if p.mrz_lines and p.mrz_lines[0].startswith("P<") else 0
        size_ok = 1 if p.mrz_format == "TD3" and len(p.mrz_lines) == 2 and all(len(x) == 44 for x in p.mrz_lines) else 0
        return (1 if p.valid else 0, checksums, size_ok, p_prefix, hint_bonus)

    results.sort(key=score, reverse=True)
    best = results[0]
    if require_valid and not best.valid:
        return None
    return best
