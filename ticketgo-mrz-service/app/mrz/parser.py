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
    """TD1 only: allow tiny pad/trim. Never used for TD3/passport."""
    if len(line) == length:
        return line
    if len(line) > length:
        return line[:length]
    if length - len(line) <= 2:
        return line + ("<" * (length - len(line)))
    return None


def _td3_line1_score(line: str) -> float:
    """Higher = more likely real TD3 line 1 (P< + fillers + length)."""
    if not line.startswith("P<"):
        return -1.0
    if len(line) != 44:
        return -1.0
    fillers = line.count("<")
    # Real TD3 line1 is dense with fillers in the name zone
    if fillers < 2:
        return 0.0
    # Prefer typical issuing country letters after P<
    bonus = 0.5 if len(line) >= 5 and line[2:5].isalpha() else 0.0
    return float(fillers) + bonus


def _td3_line2_score(line: str) -> float:
    if len(line) != 44:
        return -1.0
    if line.startswith("P<"):
        return -1.0  # line2 is not document type line
    # Line2 is mostly alnum + some fillers; must have check-digit digits
    alnum = sum(ch.isalnum() for ch in line)
    if alnum < 20:
        return -1.0
    return float(alnum) + (0.5 if line[9].isdigit() else 0.0)


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
    if len(window) != 44:
        return None
    if not window.startswith("P<"):
        return None
    return window


def _find_td3(lines: list[str]) -> list[str] | None:
    """
    Strict TD3 selection:
    - Line 1 must start with P<
    - Exact 2 × 44 only (no '<' padding of short lines)
    - Prefer high filler density on line 1
    - Never accept arbitrary 44-char visual-zone pairs
    """
    # Materialize candidate line1 windows (exact or P< window from longer OCR)
    line1_candidates: list[str] = []
    others: list[str] = []
    for ln in lines:
        if ln.startswith("P<") and len(ln) == 44:
            line1_candidates.append(ln)
            continue
        win = _extract_td3_window(ln)
        if win is not None:
            line1_candidates.append(win)
            continue
        if len(ln) == 44:
            others.append(ln)
        elif 44 < len(ln) <= 48:
            # Longer non-P line: try left trim only if it looks like line2 (no invent)
            others.append(ln[:44])

    if not line1_candidates:
        return None

    line1_candidates.sort(key=_td3_line1_score, reverse=True)
    line1 = line1_candidates[0]
    if _td3_line1_score(line1) < 0:
        return None

    # Pair with best line2 among remaining 44-char lines (not the same as line1)
    line2_pool = [x for x in others if x != line1 and len(x) == 44]
    # Also allow other cleaned lines of length 44 from original
    for ln in lines:
        if len(ln) == 44 and ln != line1 and ln not in line2_pool:
            line2_pool.append(ln)
        elif len(ln) > 44:
            # If a second MRZ line was concatenated after line1 in same string — rare
            pass

    if not line2_pool:
        # Try to find another P<-less 44 window near candidates in raw list
        for ln in lines:
            cleaned = clean_mrz_text(ln)
            if cleaned.startswith("P<"):
                continue
            if len(cleaned) >= 44:
                cand = cleaned[:44]
                if len(cand) == 44 and cand != line1:
                    line2_pool.append(cand)

    if not line2_pool:
        return None

    line2_pool.sort(key=_td3_line2_score, reverse=True)
    line2 = line2_pool[0]
    if _td3_line2_score(line2) < 0:
        return None

    return [line1, line2]


def _find_td1(lines: list[str]) -> list[str] | None:
    exact = [ln for ln in lines if len(ln) == 30]
    if len(exact) >= 3:
        for i in range(len(exact) - 2):
            if exact[i][0] in ("I", "A", "C"):
                return exact[i : i + 3]
        return exact[:3]

    near = []
    for ln in lines:
        if 28 <= len(ln) <= 32:
            padded = _pad_or_trim_td1(ln, 30)
            if padded:
                near.append(padded)
    if len(near) >= 3:
        for i in range(len(near) - 2):
            if near[i][0] in ("I", "A", "C"):
                trio = near[i : i + 3]
                if all(len(x) == 30 for x in trio):
                    return trio
        if all(len(x) == 30 for x in near[:3]):
            return near[:3]
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

    td3_lines = _find_td3(candidates) if document_hint in ("auto", "passport") else None
    td1_lines = _find_td1(candidates) if document_hint in ("auto", "id_card") else None

    results: list[ParsedMrz] = []

    if td3_lines and len(td3_lines) == 2 and all(len(x) == 44 for x in td3_lines):
        if not td3_lines[0].startswith("P<"):
            td3_lines = None
        else:
            r: Td3ParseResult = parse_td3(td3_lines)
            # Passport path: never promote invalid / invented MRZ as a usable hit
            if require_valid and not r.valid:
                td3_lines = None
            else:
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
        return (1 if p.valid else 0, hint_bonus, p.confidence, checksums)

    results.sort(key=score, reverse=True)
    best = results[0]
    if require_valid and not best.valid:
        return None
    return best
