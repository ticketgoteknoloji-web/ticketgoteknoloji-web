"""PaddleOCR engine — singleton loaded at application startup."""

from __future__ import annotations

import logging
import threading
from typing import Any

import numpy as np

from app.config import get_settings
from app.mrz.parser import ParsedMrz, parse_mrz_lines
from app.ocr.detector import crop_regions, upscale_if_small, upscale_mrz_band
from app.ocr.passport_mrz import (
    build_passport_mrz_variants,
    deskew_mrz_crop,
    orientation_candidates,
    passport_bottom_regions,
)
from app.ocr.preprocess import build_variants

logger = logging.getLogger("ticketgo-mrz.ocr")

_engine_lock = threading.Lock()
_ocr_instance: Any = None


def init_ocr_engine() -> None:
    """Load PaddleOCR once. Call from FastAPI lifespan."""
    global _ocr_instance
    with _engine_lock:
        if _ocr_instance is not None:
            return
        settings = get_settings()
        logger.info("Loading PaddleOCR engine (local models only)")
        from paddleocr import PaddleOCR

        # Compatible across PaddleOCR 2.x constructor styles
        try:
            _ocr_instance = PaddleOCR(
                use_angle_cls=settings.paddle_use_angle_cls,
                lang=settings.paddle_lang,
                use_gpu=settings.paddle_use_gpu,
                show_log=False,
            )
        except TypeError:
            _ocr_instance = PaddleOCR(
                use_angle_cls=settings.paddle_use_angle_cls,
                lang=settings.paddle_lang,
            )
        logger.info("PaddleOCR engine ready")


def get_ocr_engine() -> Any:
    if _ocr_instance is None:
        init_ocr_engine()
    return _ocr_instance


def _run_paddle(image_bgr: np.ndarray) -> tuple[list[str], float]:
    """Execute OCR; return (texts, mean_confidence). Never log text content."""
    ocr = get_ocr_engine()
    try:
        result = ocr.ocr(image_bgr, cls=True)
    except TypeError:
        result = ocr.ocr(image_bgr)

    texts: list[str] = []
    scores: list[float] = []

    if not result:
        return texts, 0.0

    pages = result if isinstance(result, list) else [result]
    for page in pages:
        if page is None:
            continue
        if isinstance(page, dict):
            rec_texts = page.get("rec_texts") or page.get("text") or []
            rec_scores = page.get("rec_scores") or []
            for i, t in enumerate(rec_texts):
                if t:
                    texts.append(str(t))
                    if i < len(rec_scores):
                        try:
                            scores.append(float(rec_scores[i]))
                        except (TypeError, ValueError):
                            pass
            continue
        if not isinstance(page, list):
            continue
        for line in page:
            if line is None:
                continue
            if isinstance(line, (list, tuple)) and len(line) >= 2:
                payload = line[1]
                if isinstance(payload, (list, tuple)) and len(payload) >= 1:
                    texts.append(str(payload[0]))
                    if len(payload) >= 2:
                        try:
                            scores.append(float(payload[1]))
                        except (TypeError, ValueError):
                            pass
                elif isinstance(payload, str):
                    texts.append(payload)
    mean_conf = float(sum(scores) / len(scores)) if scores else 0.0
    return texts, mean_conf


def _score_parsed(p: ParsedMrz) -> tuple:
    return (
        1 if p.valid else 0,
        sum(1 for k, v in p.validation.items() if k != "ocr_checksum_corrected" and v),
        p.confidence,
    )


def _read_passport_td3(image_bgr: np.ndarray) -> ParsedMrz | None:
    """
    Dedicated PASSPORT/TD3 pipeline:
    - orientation candidates
    - bottom / MRZ-band crops only (no visual-zone full page as MRZ source)
    - mandatory deskew
    - multi-variant preprocess
    - only checksum-valid TD3 accepted
    """
    best: ParsedMrz | None = None
    attempts = 0
    max_attempts = 48

    # Prefer upright first; still try other rotations if needed
    orientations = orientation_candidates(image_bgr)
    # Reorder: 0, 180, 90, 270 (upright/upside-down more common for phone scans)
    order = {"rot0": 0, "rot180": 1, "rot90": 2, "rot270": 3}
    orientations.sort(key=lambda x: order.get(x[0], 9))

    for ori_name, oriented in orientations:
        regions = passport_bottom_regions(oriented)
        for region_name, region in regions:
            if region is None or region.size == 0:
                continue
            deskewed = deskew_mrz_crop(region)
            deskewed = upscale_if_small(deskewed, min_width=1100)
            if region_name == "mrz_band":
                deskewed = upscale_mrz_band(deskewed, min_char_width=22.0)

            for variant_name, variant_img in build_passport_mrz_variants(deskewed):
                if attempts >= max_attempts:
                    break
                attempts += 1
                try:
                    texts, mean_conf = _run_paddle(variant_img)
                except Exception:
                    logger.warning(
                        "passport OCR attempt failed ori=%s region=%s variant=%s",
                        ori_name,
                        region_name,
                        variant_name,
                    )
                    continue
                if not texts:
                    continue
                parsed = parse_mrz_lines(
                    texts,
                    document_hint="passport",
                    ocr_confidence=mean_conf,
                    require_valid=True,
                )
                if parsed is None or not parsed.valid or parsed.mrz_format != "TD3":
                    continue
                if not parsed.mrz_lines or not parsed.mrz_lines[0].startswith("P<"):
                    continue
                if best is None or _score_parsed(parsed) > _score_parsed(best):
                    best = parsed
                if best.valid and best.confidence >= 0.85:
                    return best
            if best and best.valid:
                return best
        # If this orientation already yielded a valid TD3, stop rotating
        if best and best.valid:
            return best

    return best


def _read_id_card_td1(image_bgr: np.ndarray) -> ParsedMrz | None:
    """Existing TD1 / Turkish ID path — unchanged region strategy for ID cards."""
    best: ParsedMrz | None = None
    attempts = 0
    max_attempts = 36

    regions = crop_regions(image_bgr)
    for region_name, region in regions:
        region = upscale_if_small(region, min_width=1200)
        if region_name == "mrz_band":
            region = upscale_mrz_band(region, min_char_width=24.0)
        variants = build_variants(region)
        for variant_name, variant_img in variants:
            if attempts >= max_attempts:
                break
            attempts += 1
            try:
                texts, mean_conf = _run_paddle(variant_img)
            except Exception:
                logger.warning("OCR attempt failed region=%s variant=%s", region_name, variant_name)
                continue
            if not texts:
                continue
            parsed = parse_mrz_lines(
                texts,
                document_hint="id_card",
                ocr_confidence=mean_conf,
            )
            if parsed is None:
                continue
            if best is None or _score_parsed(parsed) > _score_parsed(best):
                best = parsed
            if best.valid and best.confidence >= 0.85:
                return best
        if best and best.valid:
            return best

    return best


def read_mrz_from_image(
    image_bgr: np.ndarray,
    *,
    document_hint: str = "auto",
) -> ParsedMrz | None:
    """
    Full OCR pipeline.
    Passport uses a dedicated bottom-MRZ pipeline (visual zone is not an MRZ source).
    Does not persist images. Does not log MRZ or personal data.
    """
    if image_bgr is None or image_bgr.size == 0:
        return None

    hint = document_hint if document_hint in ("auto", "passport", "id_card") else "auto"

    if hint == "passport":
        return _read_passport_td3(image_bgr)

    if hint == "id_card":
        return _read_id_card_td1(image_bgr)

    # auto: try passport TD3 (strict) first, then ID card TD1 — do not mix visual-zone TD3 fakes
    passport_hit = _read_passport_td3(image_bgr)
    if passport_hit is not None and passport_hit.valid:
        return passport_hit

    return _read_id_card_td1(image_bgr)
