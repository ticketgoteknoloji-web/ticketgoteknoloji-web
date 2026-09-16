"""General full-page OCR (non-MRZ). Uses the shared PaddleOCR singleton."""

from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any, Literal

import cv2
import numpy as np

from app.ocr.engine import run_full_page_ocr_raw
from app.ocr.passport_mrz import cap_long_edge

logger = logging.getLogger("ticketgo-mrz.ocr")

GENERAL_MAX_EDGE = 1800
# T.C. kimlik ön yüz: smaller canvas + no angle-cls (fast). 1400 keeps gender glyphs.
IDENTITY_MAX_EDGE = 1400

DocumentHint = Literal["auto", "vehicle_registration", "identity", "passport", "other"]


@dataclass
class OcrLine:
    text: str
    confidence: float
    bounding_box: list[list[float]]
    _sort_y: float = 0.0
    _sort_x: float = 0.0


@dataclass
class GeneralOcrResult:
    document_type: str
    raw_text: str
    lines: list[OcrLine] = field(default_factory=list)
    fields: dict[str, str | None] = field(default_factory=dict)
    ocr_ms: int = 0
    total_ms: int = 0


def _empty_vehicle_fields() -> dict[str, str | None]:
    return {
        "plate": None,
        "vehicleType": None,
        "vehicleClass": None,
        "brand": None,
        "model": None,
        "modelYear": None,
        "vin": None,
        "engineNumber": None,
        "fuelType": None,
        "color": None,
        "seatCount": None,
        "firstRegistrationDate": None,
        "registrationDate": None,
        "ownerName": None,
        "documentNumber": None,
    }


def _bbox_from_points(points: Any) -> list[list[float]] | None:
    if not isinstance(points, (list, tuple)) or len(points) < 4:
        return None
    out: list[list[float]] = []
    for p in points[:4]:
        if not isinstance(p, (list, tuple)) or len(p) < 2:
            return None
        try:
            out.append([float(p[0]), float(p[1])])
        except (TypeError, ValueError):
            return None
    return out


def _parse_paddle_pages(result: Any) -> list[OcrLine]:
    """Parse PaddleOCR output into reading-order lines. Keeps raw text (not MRZ-cleaned)."""
    lines: list[OcrLine] = []
    if not result:
        return lines
    pages = result if isinstance(result, list) else [result]
    for page in pages:
        if page is None:
            continue
        if isinstance(page, dict):
            rec_texts = page.get("rec_texts") or page.get("texts") or []
            rec_scores = page.get("rec_scores") or page.get("scores") or []
            rec_polys = page.get("dt_polys") or page.get("rec_polys") or page.get("boxes") or []
            for i, t in enumerate(rec_texts):
                text = str(t).strip() if t is not None else ""
                if not text:
                    continue
                conf = 0.0
                if i < len(rec_scores):
                    try:
                        conf = float(rec_scores[i])
                    except (TypeError, ValueError):
                        conf = 0.0
                box = _bbox_from_points(rec_polys[i]) if i < len(rec_polys) else None
                ys = [p[1] for p in box] if box else [float(i)]
                xs = [p[0] for p in box] if box else [0.0]
                lines.append(
                    OcrLine(
                        text=text,
                        confidence=max(0.0, min(1.0, conf)),
                        bounding_box=box or [],
                        _sort_y=sum(ys) / len(ys),
                        _sort_x=min(xs),
                    )
                )
            continue
        if not isinstance(page, list):
            continue
        for idx, item in enumerate(page):
            if item is None:
                continue
            if isinstance(item, (list, tuple)) and len(item) >= 2:
                box = _bbox_from_points(item[0])
                payload = item[1]
                text = ""
                conf = 0.0
                if isinstance(payload, (list, tuple)) and len(payload) >= 1:
                    text = str(payload[0]).strip()
                    if len(payload) >= 2:
                        try:
                            conf = float(payload[1])
                        except (TypeError, ValueError):
                            conf = 0.0
                elif isinstance(payload, str):
                    text = payload.strip()
                if not text:
                    continue
                ys = [p[1] for p in box] if box else [float(idx)]
                xs = [p[0] for p in box] if box else [0.0]
                lines.append(
                    OcrLine(
                        text=text,
                        confidence=max(0.0, min(1.0, conf)),
                        bounding_box=box or [],
                        _sort_y=sum(ys) / len(ys),
                        _sort_x=min(xs),
                    )
                )
            elif isinstance(item, str) and item.strip():
                lines.append(
                    OcrLine(
                        text=item.strip(),
                        confidence=0.0,
                        bounding_box=[],
                        _sort_y=float(idx),
                        _sort_x=0.0,
                    )
                )
    lines.sort(key=lambda ln: (round(ln._sort_y / 8.0), ln._sort_x))
    return lines


_PLATE_RE = re.compile(
    r"\b(\d{2})\s*([A-ZÇĞİÖŞÜ]{1,3})\s*(\d{2,5})\b",
    re.IGNORECASE,
)
_VIN_RE = re.compile(r"\b([A-HJ-NPR-Z0-9]{17})\b", re.IGNORECASE)
_YEAR_RE = re.compile(r"\b((?:19|20)\d{2})\b")
_DATE_RE = re.compile(r"\b(\d{2}[./-]\d{2}[./-](?:\d{2}|\d{4}))\b")
_ENGINE_RE = re.compile(r"\b([A-Z0-9]{5,20})\b", re.IGNORECASE)
_SEAT_LABEL_RE = re.compile(
    r"(Koltuk Sayısı|Koltuk Sayisi|Oturma Yeri|Seat Count|Seating Capacity)\s*[:：\-]?\s*(\d{1,2})",
    re.IGNORECASE,
)
# Inflected Turkish forms of "motor" itself — never a real engine-number value.
_ENGINE_LABEL_STOPWORDS = {"MOTOR", "MOTORLU", "MOTORUN", "MOTORIN", "MOTORU", "MOTORLA", "MOTORDUR"}

_FUEL_TYPE_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    ("ELECTRIC", ("elektrik", "electric", "ev")),
    ("HYBRID", ("hibrit", "hybrid")),
    ("LPG", ("lpg", "otogaz")),
    ("DIESEL", ("dizel", "diesel", "motorin")),
    ("GASOLINE", ("benzin", "gasoline", "petrol")),
]

_VEHICLE_TYPE_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    ("MOTORCYCLE", ("motosiklet", "motorcycle", "scooter")),
    ("SEMI_TRUCK", ("çekici", "cekici", "tır ", " tir", "semi-truck", "semi truck")),
    ("TRUCK", ("kamyon", "truck", "kamyonet")),
    ("BUS", ("otobüs", "otobus", "bus", "coach")),
    ("MINIBUS", ("minibüs", "minibus", "midibüs", "midibus")),
    ("VAN", ("panelvan", "van")),
    ("TRAILER", ("römork", "romork", "trailer", "dorse")),
    ("CAR", ("otomobil", "binek")),
]

_BRAND_KEYWORDS = (
    "TOYOTA",
    "FORD",
    "RENAULT",
    "FIAT",
    "VOLKSWAGEN",
    "VW",
    "BMW",
    "MERCEDES-BENZ",
    "MERCEDES",
    "AUDI",
    "OPEL",
    "PEUGEOT",
    "CITROEN",
    "HYUNDAI",
    "KIA",
    "HONDA",
    "YAMAHA",
    "SUZUKI",
    "DACIA",
    "SKODA",
    "SEAT",
    "NISSAN",
    "MAZDA",
    "VOLVO",
    "MAN",
    "IVECO",
    "SCANIA",
    "ISUZU",
    "MITSUBISHI",
    "CHEVROLET",
    "TESLA",
)


def _normalize_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _detect_vehicle_type(blob: str) -> str | None:
    lower = blob.casefold()
    for vtype, keys in _VEHICLE_TYPE_KEYWORDS:
        for key in keys:
            if key.casefold() in lower:
                return vtype
    return None


def _detect_fuel_type(blob: str) -> str | None:
    lower = blob.casefold()
    for fuel, keys in _FUEL_TYPE_KEYWORDS:
        for key in keys:
            if key.casefold() in lower:
                return fuel
    return None


def _extract_plate(blob: str) -> str | None:
    m = _PLATE_RE.search(blob.upper().replace("İ", "I"))
    if not m:
        return None
    return f"{m.group(1)} {m.group(2).upper()} {m.group(3)}"


def _extract_vin(blob: str) -> str | None:
    upper = blob.upper()
    candidates = [upper, re.sub(r"[^A-Z0-9]+", " ", upper), re.sub(r"[^A-Z0-9]", "", upper)]
    for src in candidates:
        for m in re.finditer(r"(?<![A-Z0-9])([A-HJ-NPR-Z0-9]{17})(?![A-Z0-9])", src):
            cand = m.group(1).upper()
            if any(ch.isdigit() for ch in cand) and any(ch.isalpha() for ch in cand):
                return cand
    return None


def _extract_year(blob: str) -> str | None:
    years = [int(y) for y in _YEAR_RE.findall(blob)]
    years = [y for y in years if 1980 <= y <= 2035]
    if not years:
        return None
    return str(years[0])


def _extract_date(blob: str) -> str | None:
    m = _DATE_RE.search(blob)
    return m.group(1) if m else None


def _extract_brand(blob: str) -> str | None:
    upper = blob.upper().replace("İ", "I")
    for brand in _BRAND_KEYWORDS:
        if re.search(rf"\b{re.escape(brand)}\b", upper):
            return "VOLKSWAGEN" if brand == "VW" else brand
    return None


def _labeled_value(lines: list[str], labels: tuple[str, ...]) -> str | None:
    """Return text after a label on same/next line. No invention."""
    label_re = re.compile(
        r"(" + "|".join(re.escape(x) for x in labels) + r")\s*[:：\-]?\s*(.*)$",
        re.IGNORECASE,
    )
    for i, line in enumerate(lines):
        m = label_re.search(line)
        if not m:
            continue
        rest = _normalize_spaces(m.group(2))
        if rest and len(rest) >= 2:
            return rest[:80]
        if i + 1 < len(lines):
            nxt = _normalize_spaces(lines[i + 1])
            if nxt and len(nxt) >= 2 and not label_re.match(nxt):
                return nxt[:80]
    return None


def _extract_seat_count(lines: list[str]) -> str | None:
    """Digit must appear on the SAME line as the label — no next-line fallback for 1-2 digit values."""
    for line in lines:
        m = _SEAT_LABEL_RE.search(line)
        if m:
            return m.group(2)
    return None


def _extract_labeled_date(lines: list[str], labels: tuple[str, ...], exclude_labels: tuple[str, ...] = ()) -> str | None:
    """Find a date that sits on a line matching `labels` but NOT `exclude_labels` (handles the
    "Tescil Tarihi" vs "İlk Tescil Tarihi" substring-overlap case — the latter must not be
    mistaken for the former)."""
    label_re = re.compile("(" + "|".join(re.escape(x) for x in labels) + ")", re.IGNORECASE)
    exclude_re = (
        re.compile("(" + "|".join(re.escape(x) for x in exclude_labels) + ")", re.IGNORECASE)
        if exclude_labels
        else None
    )
    for line in lines:
        if exclude_re and exclude_re.search(line):
            continue
        if label_re.search(line):
            m = _DATE_RE.search(line)
            if m:
                return m.group(1)
    return None


def extract_vehicle_fields(lines: list[OcrLine]) -> dict[str, str | None]:
    """Conservative heuristics only. Missing fields stay null — never invent."""
    fields = _empty_vehicle_fields()
    texts = [ln.text for ln in lines if ln.text]
    blob = "\n".join(texts)
    flat = _normalize_spaces(blob)

    fields["plate"] = _extract_plate(flat)
    fields["vin"] = _extract_vin(flat)
    fields["vehicleType"] = _detect_vehicle_type(flat)
    fields["brand"] = _extract_brand(flat)
    fields["modelYear"] = _extract_year(flat)
    fields["fuelType"] = _detect_fuel_type(flat)

    # "Tescil Tarihi" is a substring of "İlk Tescil Tarihi" — each must be
    # matched against its own label, excluding the other, or a document with
    # both fields would have the first-registration date bleed into the
    # (re-)registration date field.
    fields["firstRegistrationDate"] = _extract_labeled_date(
        texts,
        ("İlk Tescil Tarihi", "Ilk Tescil Tarihi", "First Registration"),
    )
    fields["registrationDate"] = _extract_labeled_date(
        texts,
        ("Tescil Tarihi",),
        exclude_labels=("İlk Tescil Tarihi", "Ilk Tescil Tarihi"),
    )
    if fields["registrationDate"] is None:
        # No explicitly-labeled "Tescil Tarihi" line found — fall back to any
        # date in the document, same as before this field was disambiguated.
        fields["registrationDate"] = _extract_date(flat)

    fields["model"] = _labeled_value(
        texts,
        ("Model", "Modeli"),
    )
    fields["engineNumber"] = _labeled_value(
        texts,
        ("Motor No", "Motor Numarası", "Motor Numarasi", "Engine No", "Engine Number"),
    )
    fields["ownerName"] = _labeled_value(
        texts,
        ("Adı Soyadı", "Adi Soyadi", "Sahibi", "Owner", "Ad Soyad"),
    )
    fields["documentNumber"] = _labeled_value(
        texts,
        ("Belge No", "Belge Numarası", "Belge Numarasi", "Document No", "Seri No"),
    )
    fields["vehicleClass"] = _labeled_value(
        texts,
        ("Araç Sınıfı", "Arac Sinifi", "Sınıfı", "Sinifi", "Vehicle Class"),
    )
    fields["color"] = _labeled_value(
        texts,
        ("Rengi", "Renk", "Color", "Colour"),
    )
    fields["seatCount"] = _extract_seat_count(texts)

    if fields["engineNumber"] is None and re.search(r"\bmotor\b", flat, re.IGNORECASE):
        for ln in texts:
            if re.search(r"\bmotor\b", ln, re.IGNORECASE):
                for m in _ENGINE_RE.finditer(ln.upper()):
                    tok = m.group(1).upper()
                    if (
                        len(tok) >= 6
                        and tok != fields.get("vin")
                        and not _PLATE_RE.search(tok)
                        and tok not in _ENGINE_LABEL_STOPWORDS
                    ):
                        fields["engineNumber"] = tok
                        break
            if fields["engineNumber"]:
                break

    return fields


def _document_type_for_hint(hint: DocumentHint, fields: dict[str, str | None]) -> str:
    if hint == "vehicle_registration":
        return "VEHICLE_REGISTRATION"
    if hint == "identity":
        return "IDENTITY"
    if hint == "passport":
        return "PASSPORT"
    if hint == "other":
        return "OTHER"
    if fields.get("plate") or fields.get("vin"):
        return "VEHICLE_REGISTRATION"
    return "DOCUMENT"


def read_general_ocr(
    image_bgr: np.ndarray,
    *,
    document_hint: DocumentHint = "auto",
) -> GeneralOcrResult:
    """
    Full-document OCR. Does not require MRZ.
    Reuses the preloaded PaddleOCR singleton — never reloads the model per request.
    """
    t0 = time.perf_counter()
    if image_bgr is None or image_bgr.size == 0:
        raise ValueError("INVALID_IMAGE")

    # Identity front: prioritize latency (smaller image, skip angle classifier + blur).
    fast_identity = document_hint == "identity"
    max_edge = IDENTITY_MAX_EDGE if fast_identity else GENERAL_MAX_EDGE
    working = cap_long_edge(image_bgr, max_edge)
    if not fast_identity:
        working = cv2.GaussianBlur(working, (3, 3), 0)

    raw_result, ocr_ms = run_full_page_ocr_raw(working, use_cls=not fast_identity)
    lines = _parse_paddle_pages(raw_result)
    raw_text = "\n".join(ln.text for ln in lines)

    if document_hint in ("vehicle_registration", "auto"):
        fields = extract_vehicle_fields(lines)
    else:
        fields = _empty_vehicle_fields()

    doc_type = _document_type_for_hint(document_hint, fields)
    total_ms = int((time.perf_counter() - t0) * 1000)
    logger.info(
        "general_ocr hint=%s lines=%s ocr_ms=%s total_ms=%s doc_type=%s max_edge=%s cls=%s",
        document_hint,
        len(lines),
        ocr_ms,
        total_ms,
        doc_type,
        max_edge,
        not fast_identity,
    )
    return GeneralOcrResult(
        document_type=doc_type,
        raw_text=raw_text,
        lines=lines,
        fields=fields,
        ocr_ms=ocr_ms,
        total_ms=total_ms,
    )
