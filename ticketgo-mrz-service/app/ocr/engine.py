"""PaddleOCR engine — singleton loaded at application startup."""

from __future__ import annotations

import logging
import threading
import time
from typing import Any

import numpy as np

from app.config import get_settings
from app.mrz.parser import ParsedMrz, parse_mrz_lines
from app.ocr.detector import crop_regions, upscale_if_small, upscale_mrz_band
from app.mrz.normalize import clean_mrz_text
from app.ocr.passport_mrz import (
    build_passport_mrz_variants,
    cap_long_edge,
    deskew_mrz_crop,
    fast_id_rois,
    fast_passport_rois,
    is_tight_mrz_crop,
    is_tight_td1_crop,
    maybe_perspective,
    orientation_candidates,
    passport_td3_rois,
    split_td1_line_crops,
    iter_td1_line_splits,
    split_td3_line_crops,
)
from app.ocr import debug_trace
from app.ocr.preprocess import build_variants

logger = logging.getLogger("ticketgo-mrz.ocr")

_engine_lock = threading.Lock()
_inference_lock = threading.Lock()
_state_lock = threading.Lock()
_ocr_instance: Any = None
_user_inflight = 0
_model_init_ms = 0
_warmup_done = False
_perf = threading.local()

FAST_MAX_OCR = 12
ID_FAST_MAX_OCR = 6
FAST_MAX_EDGE = 2000
FAST_MIN_CONFIDENCE = 0.50
PASSPORT_FALLBACK_MAX_OCR = 28
ID_FALLBACK_MAX_OCR = 3
KEEP_WARM_MAX_OCR = 1


def begin_ocr_perf() -> None:
    _perf.data = {
        "decode_ms": 0,
        "preprocess_ms": 0,
        "model_init_ms": 0,
        "detection_ms": 0,
        "recognition_ms": 0,
        "angle_orientation_ms": 0,
        "postprocess_ms": 0,
        "lock_wait_ms": 0,
        "fast_crop_ms": 0,
        "fast_ocr_ms": 0,
        "fallback_used": False,
        "full_ocr_ms": 0,
        "parse_validation_ms": 0,
        "total_ms": 0,
        "ocr_calls": 0,
        "keep_warm_skipped": False,
        "path": "",
    }


def consume_ocr_perf() -> dict[str, Any]:
    data = getattr(_perf, "data", None)
    if not isinstance(data, dict):
        begin_ocr_perf()
        data = getattr(_perf, "data", {})
    return dict(data)


def _perf_add(key: str, ms: int) -> None:
    data = getattr(_perf, "data", None)
    if not isinstance(data, dict):
        return
    data[key] = int(data.get(key) or 0) + int(ms)


def _perf_set(key: str, value: Any) -> None:
    data = getattr(_perf, "data", None)
    if not isinstance(data, dict):
        return
    data[key] = value


def init_ocr_engine() -> None:
    """Load PaddleOCR once. Call from FastAPI lifespan."""
    global _ocr_instance, _model_init_ms
    with _engine_lock:
        if _ocr_instance is not None:
            return
        settings = get_settings()
        logger.info(
            "Loading PaddleOCR engine singleton threads=%s angle_cls=%s mkldnn=%s",
            settings.paddle_cpu_threads,
            settings.paddle_use_angle_cls,
            settings.paddle_enable_mkldnn,
        )
        from paddleocr import PaddleOCR

        attempts = [
            dict(
                use_angle_cls=settings.paddle_use_angle_cls,
                lang=settings.paddle_lang,
                use_gpu=settings.paddle_use_gpu,
                show_log=False,
                enable_mkldnn=settings.paddle_enable_mkldnn,
                cpu_threads=settings.paddle_cpu_threads,
            ),
            dict(
                use_angle_cls=settings.paddle_use_angle_cls,
                lang=settings.paddle_lang,
                use_gpu=settings.paddle_use_gpu,
                show_log=False,
            ),
            dict(
                use_angle_cls=settings.paddle_use_angle_cls,
                lang=settings.paddle_lang,
            ),
        ]
        last_error: Exception | None = None
        t0 = time.perf_counter()
        for kwargs in attempts:
            try:
                _ocr_instance = PaddleOCR(**kwargs)
                last_error = None
                break
            except TypeError as exc:
                last_error = exc
        if _ocr_instance is None and last_error is not None:
            raise last_error
        _model_init_ms = int((time.perf_counter() - t0) * 1000)
        logger.info("PaddleOCR engine ready model_init_ms=%s", _model_init_ms)


def warmup_ocr_engine() -> None:
    """One dummy inference at startup only. Never on user requests."""
    global _warmup_done
    if _warmup_done:
        return
    get_ocr_engine()
    dummy = np.full((64, 320, 3), 255, dtype=np.uint8)
    t0 = time.perf_counter()
    try:
        _run_paddle(dummy, rec_only=False, use_cls=True, background=False)
    except Exception:
        logger.warning("startup warmup inference failed")
    logger.info("startup_warmup_ms=%s", int((time.perf_counter() - t0) * 1000))
    _warmup_done = True


def get_ocr_engine() -> Any:
    if _ocr_instance is None:
        init_ocr_engine()
    return _ocr_instance


def run_full_page_ocr_raw(
    image_bgr: np.ndarray,
    *,
    use_cls: bool = True,
) -> tuple[Any, int]:
    """
    Full-page PaddleOCR for general (non-MRZ) use.
    Returns (raw_paddle_result, ocr_ms). Uses singleton + shared inference lock.
    Does not apply MRZ text cleaning. Does not reload the model.
    """
    global _user_inflight
    ocr = get_ocr_engine()
    with _state_lock:
        _user_inflight += 1
    t_lock = time.perf_counter()
    _inference_lock.acquire()
    _perf_add("lock_wait_ms", int((time.perf_counter() - t_lock) * 1000))
    t_inf = time.perf_counter()
    try:
        _perf_add("ocr_calls", 1)
        try:
            result = ocr.ocr(image_bgr, cls=use_cls)
        except TypeError:
            result = ocr.ocr(image_bgr)
        elapsed = int((time.perf_counter() - t_inf) * 1000)
        _perf_add("detection_ms", elapsed)
        return result, elapsed
    except Exception:
        elapsed = int((time.perf_counter() - t_inf) * 1000)
        _perf_add("detection_ms", elapsed)
        raise
    finally:
        _inference_lock.release()
        with _state_lock:
            _user_inflight = max(0, _user_inflight - 1)


def _run_paddle(
    image_bgr: np.ndarray,
    *,
    rec_only: bool = False,
    use_cls: bool = True,
    background: bool = False,
) -> tuple[list[str], float]:
    """Execute OCR; return (texts, mean_confidence). Never log text content."""
    global _user_inflight
    ocr = get_ocr_engine()
    if background:
        with _state_lock:
            users = _user_inflight
        if users > 0:
            _perf_set("keep_warm_skipped", True)
            return [], 0.0
        t_lock = time.perf_counter()
        got = _inference_lock.acquire(blocking=False)
        _perf_add("lock_wait_ms", int((time.perf_counter() - t_lock) * 1000))
        if not got:
            _perf_set("keep_warm_skipped", True)
            return [], 0.0
    else:
        with _state_lock:
            _user_inflight += 1
        t_lock = time.perf_counter()
        _inference_lock.acquire()
        _perf_add("lock_wait_ms", int((time.perf_counter() - t_lock) * 1000))

    t_inf = time.perf_counter()
    try:
        _perf_add("ocr_calls", 1)
        try:
            if rec_only:
                try:
                    result = ocr.ocr(image_bgr, det=False, rec=True, cls=use_cls)
                except TypeError:
                    result = ocr.ocr(image_bgr, det=False, rec=True)
            else:
                try:
                    result = ocr.ocr(image_bgr, cls=use_cls)
                except TypeError:
                    result = ocr.ocr(image_bgr, cls=True)
        except TypeError:
            result = ocr.ocr(image_bgr)
        elapsed = int((time.perf_counter() - t_inf) * 1000)
        if rec_only:
            _perf_add("recognition_ms", elapsed)
        else:
            _perf_add("detection_ms", elapsed)
    except Exception:
        elapsed = int((time.perf_counter() - t_inf) * 1000)
        if rec_only:
            _perf_add("recognition_ms", elapsed)
        else:
            _perf_add("detection_ms", elapsed)
        raise
    finally:
        _inference_lock.release()
        if not background:
            with _state_lock:
                _user_inflight = max(0, _user_inflight - 1)

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
            if isinstance(line, (list, tuple)) and len(line) >= 1 and isinstance(line[0], str):
                texts.append(str(line[0]))
                if len(line) >= 2 and not isinstance(line[1], (list, tuple)):
                    try:
                        scores.append(float(line[1]))
                    except (TypeError, ValueError):
                        pass
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
            elif isinstance(line, str):
                texts.append(line)
    mean_conf = float(sum(scores) / len(scores)) if scores else 0.0
    cleaned: list[str] = []
    for t in texts:
        c = clean_mrz_text(t)
        if c:
            cleaned.append(c)
    return cleaned, mean_conf


def _score_parsed(p: ParsedMrz) -> tuple:
    """ID-card ranking (unchanged)."""
    return (
        1 if p.valid else 0,
        sum(1 for k, v in p.validation.items() if k != "ocr_checksum_corrected" and v),
        p.confidence,
    )


def _score_passport_td3(p: ParsedMrz) -> tuple:
    """Rank PASSPORT candidates by ICAO checks first, OCR confidence last."""
    v = p.validation or {}
    return (
        1 if _is_strict_td3(p) else 0,
        1 if v.get("document_number") else 0,
        1 if v.get("date_of_birth") else 0,
        1 if v.get("expiry_date") else 0,
        1 if v.get("personal_number") else 0,
        1 if v.get("composite") else 0,
        float(p.confidence or 0.0),
    )


def _is_strict_td3(p: ParsedMrz | None) -> bool:
    if p is None or p.mrz_format != "TD3" or not p.mrz_lines:
        return False
    if len(p.mrz_lines) != 2:
        return False
    a, b = p.mrz_lines
    return (
        len(a) == 44
        and len(b) == 44
        and a.startswith("P<")
        and all(ch in "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<" for ch in a + b)
    )


def _consider_passport(
    texts: list[str],
    mean_conf: float,
    best: ParsedMrz | None,
    *,
    meta: dict | None = None,
) -> ParsedMrz | None:
    if not texts:
        return best
    parsed = parse_mrz_lines(
        texts,
        document_hint="passport",
        ocr_confidence=mean_conf,
        require_valid=False,
    )
    if not _is_strict_td3(parsed):
        return best
    parsed.debug = dict(meta or {})
    if best is None or _score_passport_td3(parsed) > _score_passport_td3(best):
        debug_trace.record_pick(
            orientation=str((meta or {}).get("orientation") or ""),
            roi=str((meta or {}).get("roi") or ""),
            variant=str((meta or {}).get("variant") or ""),
            line_lens=[len(x) for x in parsed.mrz_lines],
            checks={
                "document_number": bool(parsed.validation.get("document_number")),
                "date_of_birth": bool(parsed.validation.get("date_of_birth")),
                "expiry_date": bool(parsed.validation.get("expiry_date")),
                "personal_number": bool(parsed.validation.get("personal_number")),
                "composite": bool(parsed.validation.get("composite")),
            },
            raw_lines=list(parsed.mrz_lines),
            td3_found=True,
        )
        logger.info(
            "passport_mrz_candidate valid=%s checks=%s conf=%.3f line_lens=%s ori=%s roi=%s variant=%s",
            parsed.valid,
            sum(1 for k, val in parsed.validation.items() if k != "ocr_checksum_corrected" and val),
            parsed.confidence,
            [len(x) for x in parsed.mrz_lines],
            (meta or {}).get("orientation"),
            (meta or {}).get("roi"),
            (meta or {}).get("variant"),
        )
        return parsed
    return best


def _fast_passport_ok(parsed: ParsedMrz | None) -> bool:
    """FAST accept: strict TD3 + ICAO check digits. Low confidence falls through."""
    if parsed is None or not _is_strict_td3(parsed) or not parsed.valid:
        return False
    v = parsed.validation or {}
    if not (v.get("document_number") and v.get("date_of_birth") and v.get("expiry_date")):
        return False
    if float(parsed.confidence or 0.0) < FAST_MIN_CONFIDENCE:
        return False
    return True


def _is_strict_td1(p: ParsedMrz | None) -> bool:
    if p is None or p.mrz_format != "TD1" or not p.mrz_lines:
        return False
    if len(p.mrz_lines) != 3:
        return False
    return all(len(x) == 30 for x in p.mrz_lines)


def _fast_id_ok(parsed: ParsedMrz | None) -> bool:
    """FAST TD1 accept: exact 3×30 + checksums. Does not run the TD3 parser."""
    if parsed is None or not _is_strict_td1(parsed) or not parsed.valid:
        return False
    v = parsed.validation or {}
    if not (
        v.get("document_number")
        and v.get("date_of_birth")
        and v.get("expiry_date")
        and v.get("composite")
    ):
        return False
    if float(parsed.confidence or 0.0) < FAST_MIN_CONFIDENCE:
        return False
    return True


def _format_from_ocr_texts(texts: list[str]) -> str:
    cands = [clean_mrz_text(t) for t in texts if t]
    cands = [x for x in cands if len(x) >= 20]
    lengths = [len(x) for x in cands]
    near30 = sum(1 for n in lengths if 28 <= n <= 32)
    if near30 >= 3 or any(n >= 90 for n in lengths):
        return "TD1"
    if any(n == 44 or n == 88 for n in lengths):
        return "TD3"
    return "UNKNOWN"


def _log_ocr_raw(
    texts: list[str],
    mean_conf: float,
    *,
    ori: str,
    roi: str,
    variant: str = "",
) -> None:
    cleaned = [clean_mrz_text(t) for t in texts if t]
    lengths = [len(x) for x in cleaned if x]
    logger.info(
        "OCR_RAW line_count=%s line_lengths=%s confidence=%.3f ori=%s roi=%s variant=%s format=%s",
        len(lengths),
        lengths[:12],
        float(mean_conf or 0.0),
        ori,
        roi,
        variant,
        _format_from_ocr_texts(texts),
    )


def _fast_variants(crop_img: np.ndarray) -> list[tuple[str, np.ndarray]]:
    """Ranked preprocess views. Names depend on glyph width (1x vs 2x)."""
    variants = build_passport_mrz_variants(crop_img)
    by_name = {name: img for name, img in variants}
    preferred = (
        "contrast_1x",
        "clahe_sharp_1x",
        "adaptive_1x",
        "clahe_sharp_1p5x",
        "contrast_1p5x",
        "clahe_sharp_2x",
        "adaptive_2x",
        "gray_1x",
    )
    out: list[tuple[str, np.ndarray]] = []
    seen: set[str] = set()
    for name in preferred:
        if name in by_name and name not in seen:
            seen.add(name)
            out.append((name, by_name[name]))
        if len(out) >= 3:
            return out
    for name, img in variants:
        if name in seen:
            continue
        seen.add(name)
        out.append((name, img))
        if len(out) >= 3:
            break
    return out


def _fast_td1_variants(crop_img: np.ndarray) -> list[tuple[str, np.ndarray]]:
    """ID-card FAST views. Prefer invert (T.C. kimlik light-on-dark), then normal."""
    variants = build_passport_mrz_variants(crop_img, chars_per_line=30)
    prefixes = (
        "adaptive_inv_",
        "otsu_inv_",
        "clahe_sharp_",
        "adaptive_",
        "contrast_",
    )
    out: list[tuple[str, np.ndarray]] = []
    seen: set[str] = set()
    for prefix in prefixes:
        for name, img in variants:
            if name.startswith(prefix) and name not in seen:
                seen.add(name)
                out.append((name, img))
                break
        if len(out) >= 3:
            return out
    for name, img in variants:
        if name in seen:
            continue
        seen.add(name)
        out.append((name, img))
        if len(out) >= 3:
            break
    return out


def _td1_variant_image(line_img: np.ndarray, variant_name: str) -> np.ndarray | None:
    variants = build_passport_mrz_variants(line_img, chars_per_line=30)
    if not variants:
        return None
    by_name = {name: img for name, img in variants}
    if variant_name in by_name:
        return by_name[variant_name]
    prefix = variant_name.rsplit("_", 1)[0] + "_"
    for name, img in variants:
        if name.startswith(prefix):
            return img
    return variants[0][1]


def _read_passport_fast(image_bgr: np.ndarray, *, background: bool = False) -> ParsedMrz | None:
    """
    Cheap first pass: cap size, keep 0/90/180/270, OCR only bottom 35–45% (+ band).
    Full-page search is intentionally skipped here.
    """
    t_crop0 = time.perf_counter()
    working = cap_long_edge(image_bgr, FAST_MAX_EDGE)
    orientations = orientation_candidates(working)
    order = {"rot0": 0, "rot180": 1, "rot90": 2, "rot270": 3}
    orientations.sort(key=lambda x: order.get(x[0], 9))
    _perf_add("fast_crop_ms", int((time.perf_counter() - t_crop0) * 1000))

    ocr_calls = 0
    best: ParsedMrz | None = None
    line_rec_names = {
        "clahe_sharp_2x",
        "clahe_sharp_1p5x",
        "clahe_sharp_1x",
        "adaptive_2x",
        "otsu_2x",
    }

    def consider(texts: list[str], mean_conf: float, meta: dict) -> ParsedMrz | None:
        nonlocal best
        t_parse = time.perf_counter()
        best = _consider_passport(texts, mean_conf, best, meta=meta)
        _perf_add("parse_validation_ms", int((time.perf_counter() - t_parse) * 1000))
        if _fast_passport_ok(best):
            logger.info(
                "passport_fast_hit ori=%s roi=%s variant=%s conf=%.3f",
                meta.get("orientation"),
                meta.get("roi"),
                meta.get("variant"),
                float(best.confidence or 0.0),
            )
            return best
        return None

    def ocr_call(img: np.ndarray, rec_only: bool) -> tuple[list[str], float]:
        nonlocal ocr_calls
        limit = KEEP_WARM_MAX_OCR if background else FAST_MAX_OCR
        if ocr_calls >= limit:
            return [], 0.0
        ocr_calls += 1
        t_ocr = time.perf_counter()
        try:
            texts, mean_conf = _run_paddle(
                img, rec_only=rec_only, use_cls=True, background=background
            )
        except Exception:
            _perf_add("fast_ocr_ms", int((time.perf_counter() - t_ocr) * 1000))
            return [], 0.0
        _perf_add("fast_ocr_ms", int((time.perf_counter() - t_ocr) * 1000))
        return texts, mean_conf

    for ori_name, oriented in orientations:
        t_roi = time.perf_counter()
        rois = fast_passport_rois(oriented)
        _perf_add("fast_crop_ms", int((time.perf_counter() - t_roi) * 1000))
        for region_name, region in rois:
            if region is None or region.size == 0:
                continue
            prepared = deskew_mrz_crop(region)
            prepared = upscale_if_small(prepared, min_width=1200)
            if region_name.startswith("mrz_") or is_tight_mrz_crop(prepared):
                prepared = upscale_mrz_band(prepared, min_char_width=22.0)
            tight = is_tight_mrz_crop(prepared) or region_name.startswith("mrz_")
            bottomish = tight or region_name.startswith("bottom_")
            line_rows = split_td3_line_crops(prepared) if bottomish else []
            for variant_name, variant_img in _fast_variants(prepared):
                texts, mean_conf = ocr_call(variant_img, False)
                limit = KEEP_WARM_MAX_OCR if background else FAST_MAX_OCR
                if not texts and ocr_calls >= limit:
                    return best if _fast_passport_ok(best) else None
                hit = consider(
                    texts,
                    mean_conf,
                    {
                        "orientation": ori_name,
                        "roi": region_name,
                        "variant": variant_name,
                        "path": "fast",
                    },
                )
                if hit is not None:
                    return hit
                if variant_name not in line_rec_names or len(line_rows) < 2:
                    continue
                row_texts: list[str] = []
                confs: list[float] = []
                for _line_name, line_img in line_rows:
                    line_img = upscale_if_small(line_img, min_width=1000)
                    chosen = next(
                        (im for n, im in build_passport_mrz_variants(line_img) if n == variant_name),
                        None,
                    )
                    if chosen is None:
                        continue
                    lt, lc = ocr_call(chosen, True)
                    row_texts.extend(lt)
                    confs.append(lc)
                if len(row_texts) >= 2:
                    pair = [row_texts[0], row_texts[1], row_texts[0] + row_texts[1]]
                    mean_line = float(sum(confs) / len(confs)) if confs else 0.0
                    hit = consider(
                        pair,
                        mean_line,
                        {
                            "orientation": ori_name,
                            "roi": region_name,
                            "variant": variant_name + "_lines",
                            "path": "fast",
                        },
                    )
                    if hit is not None:
                        return hit
    return best if _fast_passport_ok(best) else None


def _read_passport_td3(image_bgr: np.ndarray) -> ParsedMrz | None:
    """
    Dedicated PASSPORT/TD3 pipeline:
    - EXIF applied upstream; still try 0/90/180/270
    - bottom 30/35/40/45/50% + full image (+ tight MRZ band when detected)
    - grayscale, CLAHE, contrast, sharpen, adaptive, Otsu, invert, 2x/3x
    - light deskew / perspective
    - fields only from parse_td3 on exact 2×44 P< lines
    """
    debug_trace.reset_trace()
    best: ParsedMrz | None = None
    ocr_calls = 0
    max_ocr = PASSPORT_FALLBACK_MAX_OCR
    line_rec_names = {
        "clahe_sharp_2x",
        "clahe_sharp_1p5x",
        "clahe_sharp_1x",
        "adaptive_2x",
        "adaptive_1p5x",
        "otsu_2x",
        "otsu_1p5x",
        "clahe_sharp_3x",
        "adaptive_3x",
    }

    def ocr_call(img: np.ndarray, rec_only: bool) -> tuple[list[str], float]:
        nonlocal ocr_calls
        if ocr_calls >= max_ocr:
            return [], 0.0
        ocr_calls += 1
        return _run_paddle(img, rec_only=rec_only)

    orientations = orientation_candidates(image_bgr)
    order = {"rot0": 0, "rot180": 1, "rot90": 2, "rot270": 3}
    orientations.sort(key=lambda x: order.get(x[0], 9))

    def try_crop(ori_name: str, region_name: str, region: np.ndarray) -> ParsedMrz | None:
        nonlocal best
        if region is None or region.size == 0:
            return best
        debug_trace.note_roi()
        prepared = deskew_mrz_crop(region)
        prepared = upscale_if_small(prepared, min_width=1200)
        if region_name.startswith("mrz_") or is_tight_mrz_crop(prepared):
            prepared = upscale_mrz_band(prepared, min_char_width=22.0)

        crops: list[tuple[str, np.ndarray]] = [(region_name, prepared)]
        if region_name == "full":
            warped = maybe_perspective(prepared)
            if warped is not None:
                crops.append((region_name + "_persp", upscale_if_small(warped, min_width=1200)))

        for crop_name, crop_img in crops:
            tight = is_tight_mrz_crop(crop_img) or crop_name.startswith("mrz_")
            bottomish = tight or crop_name.startswith("bottom_")
            line_rows = split_td3_line_crops(crop_img) if bottomish else []
            for variant_name, variant_img in build_passport_mrz_variants(crop_img):
                meta = {
                    "orientation": ori_name,
                    "roi": crop_name,
                    "variant": variant_name,
                }
                try:
                    texts, mean_conf = ocr_call(variant_img, False)
                except Exception:
                    logger.warning(
                        "passport OCR attempt failed ori=%s region=%s variant=%s",
                        ori_name,
                        crop_name,
                        variant_name,
                    )
                    continue
                best = _consider_passport(texts, mean_conf, best, meta=meta)
                if best is not None and best.valid:
                    return best

                if variant_name not in line_rec_names or len(line_rows) < 2:
                    continue
                row_texts: list[str] = []
                confs: list[float] = []
                for _line_name, line_img in line_rows:
                    line_img = upscale_if_small(line_img, min_width=1000)
                    chosen = next(
                        (im for n, im in build_passport_mrz_variants(line_img) if n == variant_name),
                        None,
                    )
                    if chosen is None:
                        continue
                    try:
                        lt, lc = ocr_call(chosen, True)
                    except Exception:
                        logger.warning(
                            "passport line OCR failed ori=%s region=%s",
                            ori_name,
                            crop_name,
                        )
                        continue
                    row_texts.extend(lt)
                    confs.append(lc)
                if len(row_texts) >= 2:
                    pair = [row_texts[0], row_texts[1], row_texts[0] + row_texts[1]]
                    mean_line = float(sum(confs) / len(confs)) if confs else 0.0
                    best = _consider_passport(
                        pair,
                        mean_line,
                        best,
                        meta={**meta, "variant": variant_name + "_lines"},
                    )
                    if best is not None and best.valid:
                        return best
        return best

    for ori_name, oriented in orientations:
        debug_trace.note_orientation()
        rois = passport_td3_rois(oriented)
        # Prefer tight/bottom bands before the full visual page.
        rank = {
            "mrz_band": 0,
            "mrz_band_pad": 1,
            "bottom_30": 2,
            "bottom_35": 3,
            "bottom_40": 4,
            "bottom_45": 5,
            "bottom_50": 6,
            "full": 7,
        }
        rois.sort(key=lambda x: rank.get(x[0], 9))
        for region_name, region in rois:
            try_crop(ori_name, region_name, region)
            if best is not None and best.valid:
                return best
        if best is not None and best.valid:
            return best

    if _is_strict_td3(best):
        logger.info(
            "passport_mrz_pick valid=%s conf=%.3f line_lens=%s ori=%s roi=%s variant=%s",
            best.valid,
            best.confidence,
            [len(x) for x in best.mrz_lines],
            (best.debug or {}).get("orientation"),
            (best.debug or {}).get("roi"),
            (best.debug or {}).get("variant"),
        )
        return best
    return None


def _read_id_card_fast(image_bgr: np.ndarray, *, background: bool = False) -> ParsedMrz | None:
    """
    FAST TD1: landscape ID only, bottom 35–45% + band, 3×30 parser.
    Portrait (passport-like) is skipped — TD3 FAST owns that path.
    Full-page OCR is not done here.
    """
    t_crop0 = time.perf_counter()
    working = cap_long_edge(image_bgr, FAST_MAX_EDGE)
    ph, pw = working.shape[:2]
    if min(ph, pw) < 180:
        return None
    aspect = float(pw) / float(ph) if ph else 0.0
    detection = "identity" if aspect >= 1.15 else ("passport" if aspect <= 0.90 else "unknown")
    logger.info(
        "DOCUMENT_DETECTION source=fast_td1 aspect=%.3f class=%s parent_w=%s parent_h=%s "
        "FAST_PATH_ENTERED=%s",
        aspect,
        detection,
        pw,
        ph,
        detection != "passport",
    )
    # Clear portrait = passport page. Do not burn TD1 budget.
    if detection == "passport":
        _perf_add("fast_crop_ms", int((time.perf_counter() - t_crop0) * 1000))
        return None

    # Landscape ID: rot0 only. Unknown square-ish: rot0 + rot180 cheaply.
    orientations = orientation_candidates(working)
    if detection == "identity":
        orientations = [x for x in orientations if x[0] == "rot0"]
    else:
        orientations = [x for x in orientations if x[0] in ("rot0", "rot180")]
    order = {"rot0": 0, "rot180": 1}
    orientations.sort(key=lambda x: order.get(x[0], 9))
    _perf_add("fast_crop_ms", int((time.perf_counter() - t_crop0) * 1000))

    ocr_calls = 0
    limit = KEEP_WARM_MAX_OCR if background else ID_FAST_MAX_OCR

    def ocr_call(img: np.ndarray, rec_only: bool) -> tuple[list[str], float]:
        nonlocal ocr_calls
        if ocr_calls >= limit:
            return [], 0.0
        ocr_calls += 1
        t_ocr = time.perf_counter()
        try:
            texts, mean_conf = _run_paddle(
                img, rec_only=rec_only, use_cls=True, background=background
            )
        except Exception:
            _perf_add("fast_ocr_ms", int((time.perf_counter() - t_ocr) * 1000))
            return [], 0.0
        _perf_add("fast_ocr_ms", int((time.perf_counter() - t_ocr) * 1000))
        return texts, mean_conf

    def consider(texts: list[str], mean_conf: float, meta: dict) -> ParsedMrz | None:
        _log_ocr_raw(
            texts,
            mean_conf,
            ori=str(meta.get("orientation") or ""),
            roi=str(meta.get("roi") or ""),
            variant=str(meta.get("variant") or ""),
        )
        t_parse = time.perf_counter()
        parsed = parse_mrz_lines(
            texts,
            document_hint="id_card",
            ocr_confidence=mean_conf,
        )
        _perf_add("parse_validation_ms", int((time.perf_counter() - t_parse) * 1000))
        td1_hit = parsed is not None and parsed.mrz_format == "TD1"
        cleaned_preview = [clean_mrz_text(t) for t in texts if t]
        logger.info(
            "FORMAT_DETECTION format=%s td1_parser=%s line_lens=%s "
            "FAST_MRZ_CANDIDATE_COUNT=%s first2=%s",
            "TD1" if td1_hit else _format_from_ocr_texts(texts),
            td1_hit,
            [len(x) for x in (parsed.mrz_lines if parsed else [])],
            len([t for t in texts if t]),
            [x[:2] for x in cleaned_preview[:4]],
        )
        if not td1_hit:
            return None
        parsed.debug = dict(meta)
        if _fast_id_ok(parsed):
            logger.info(
                "TD1_PARSER called=true FAST_CHECK_DIGITS_VALID=true ori=%s roi=%s variant=%s",
                meta.get("orientation"),
                meta.get("roi"),
                meta.get("variant"),
            )
            return parsed
        logger.info(
            "TD1_PARSER called=true FAST_CHECK_DIGITS_VALID=false checks=%s",
            sum(1 for k, val in parsed.validation.items() if k != "ocr_checksum_corrected" and val),
        )
        return None

    for view_name, view in orientations:
        oh, ow = view.shape[:2]
        t_roi = time.perf_counter()
        rois = fast_id_rois(view)
        _perf_add("fast_crop_ms", int((time.perf_counter() - t_roi) * 1000))
        for region_name, region in rois:
            if region is None or region.size == 0:
                continue
            if region_name not in ("bottom_40", "mrz_band", "bottom_35"):
                continue
            rh, rw = region.shape[:2]
            covers_bottom = region_name.startswith("bottom_") or (rh / max(oh, 1)) >= 0.32
            y1_abs = oh
            y0_abs = oh - rh
            logger.info(
                "FAST_CROP td1 name=%s crop_w=%s crop_h=%s parent_w=%s parent_h=%s "
                "frac=%.3f MRZ_BAND_FOUND=%s MRZ_BAND_Y1=%s MRZ_BAND_Y2=%s view=%s",
                region_name,
                rw,
                rh,
                ow,
                oh,
                rh / max(oh, 1),
                covers_bottom,
                y0_abs,
                y1_abs,
                view_name,
            )
            prepared = deskew_mrz_crop(region)
            prepared = upscale_if_small(prepared, min_width=1200)
            if is_tight_td1_crop(prepared) or region_name.startswith(("mrz_", "bottom_")):
                prepared = upscale_mrz_band(prepared, min_char_width=20.0)

            # 1) Cheap band-level OCR (often returns 2 long lines → blob recovery).
            for variant_name, variant_img in _fast_td1_variants(prepared):
                texts, mean_conf = ocr_call(variant_img, False)
                if ocr_calls >= limit and not texts:
                    return None
                if texts:
                    hit = consider(
                        texts,
                        mean_conf,
                        {
                            "orientation": view_name,
                            "roi": region_name,
                            "variant": f"{variant_name}_band",
                            "path": "fast_td1",
                        },
                    )
                    if hit is not None:
                        return hit

            # 2) 3-line crops when band OCR did not validate.
            for geo_name, line_rows in iter_td1_line_splits(prepared, char_h_ratio=1.25):
                if len(line_rows) < 3:
                    continue
                logger.info(
                    "FAST_CROP td1_lines geo=%s row_heights=%s crop_h=%s",
                    geo_name,
                    [im.shape[0] for _n, im in line_rows],
                    prepared.shape[0],
                )
                for variant_name, _variant_img in _fast_td1_variants(prepared):
                    row_texts: list[str] = []
                    confs: list[float] = []
                    for _line_name, line_img in line_rows:
                        line_img = upscale_if_small(line_img, min_width=900)
                        chosen = _td1_variant_image(line_img, variant_name)
                        if chosen is None:
                            continue
                        lt, lc = ocr_call(chosen, True)
                        if ocr_calls >= limit and not lt:
                            return None
                        row_texts.append("".join(lt))
                        confs.append(lc)
                    if len(row_texts) < 2:
                        continue
                    mean_line = float(sum(confs) / len(confs)) if confs else 0.0
                    hit = consider(
                        row_texts,
                        mean_line,
                        {
                            "orientation": view_name,
                            "roi": region_name,
                            "variant": f"{variant_name}_td1_{geo_name}",
                            "path": "fast_td1",
                        },
                    )
                    if hit is not None:
                        return hit
                    if ocr_calls >= limit:
                        return None
    return None


def _read_id_card_td1(image_bgr: np.ndarray) -> ParsedMrz | None:
    """TD1 fallback: rec-only 3-line crops first, then existing multi-ROI OCR."""
    best: ParsedMrz | None = None
    attempts = 0
    max_attempts = ID_FALLBACK_MAX_OCR

    working = cap_long_edge(image_bgr, FAST_MAX_EDGE)
    for region_name, region in fast_id_rois(working):
        if region_name not in ("bottom_35", "bottom_40", "bottom_45"):
            continue
        prepared = deskew_mrz_crop(region)
        prepared = upscale_if_small(prepared, min_width=1200)
        prepared = upscale_mrz_band(prepared, min_char_width=20.0)
        for geo_name, line_rows in iter_td1_line_splits(prepared, char_h_ratio=1.25):
            if len(line_rows) < 3:
                continue
            for variant_name, _variant_img in _fast_td1_variants(prepared):
                row_texts: list[str] = []
                confs: list[float] = []
                for _line_name, line_img in line_rows:
                    if attempts >= max_attempts:
                        break
                    line_img = upscale_if_small(line_img, min_width=900)
                    chosen = _td1_variant_image(line_img, variant_name)
                    if chosen is None:
                        continue
                    attempts += 1
                    try:
                        lt, lc = _run_paddle(chosen, rec_only=True, use_cls=True)
                    except Exception:
                        continue
                    row_texts.append("".join(lt))
                    confs.append(lc)
                if len(row_texts) < 3:
                    continue
                mean_line = float(sum(confs) / len(confs)) if confs else 0.0
                parsed = parse_mrz_lines(
                    row_texts,
                    document_hint="id_card",
                    ocr_confidence=mean_line,
                )
                if parsed is None or parsed.mrz_format != "TD1":
                    continue
                if best is None or _score_parsed(parsed) > _score_parsed(best):
                    best = parsed
                if best.valid and _is_strict_td1(best):
                    return best
            if attempts >= max_attempts:
                break
        if attempts >= max_attempts:
            break

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


def _looks_like_id_card(image_bgr: np.ndarray) -> bool:
    h, w = image_bgr.shape[:2]
    if min(h, w) < 180:
        return False
    return w >= h * 1.20


def _read_passport_td3_with_fast(image_bgr: np.ndarray, *, background: bool = False) -> ParsedMrz | None:
    """
    FAST order (passport hint / auto):
      1) TD3 FAST first — keep historical ~400ms passport path
      2) TD1 FAST second — Turkish ID under passport hint
      3) Cheap fallback only if both miss
    Landscape must NOT burn TD1 before TD3 (that caused 2–7s regressions).
    """
    debug_trace.reset_trace()
    begin_ocr_perf()
    t0 = time.perf_counter()
    h, w = image_bgr.shape[:2]
    aspect = float(w) / float(h) if h else 0.0
    clear_portrait = aspect <= 0.90
    logger.info(
        "ROUTE clear_portrait=%s aspect=%.3f FAST_PATH_ENTERED=true order=td3_then_td1",
        clear_portrait,
        aspect,
    )

    fast = _read_passport_fast(image_bgr, background=background)
    if _fast_passport_ok(fast):
        _perf_set("fallback_used", False)
        _perf_set("full_ocr_ms", 0)
        _perf_set("path", "fast_td3")
        _perf_set("total_ms", int((time.perf_counter() - t0) * 1000))
        return fast
    if background:
        _perf_set("fallback_used", False)
        _perf_set("path", "keep_warm")
        _perf_set("total_ms", int((time.perf_counter() - t0) * 1000))
        return None

    # Portrait: skip TD1 FAST (ID cards are landscape).
    if not clear_portrait:
        fast_id = _read_id_card_fast(image_bgr, background=False)
        if _fast_id_ok(fast_id):
            _perf_set("fallback_used", False)
            _perf_set("full_ocr_ms", 0)
            _perf_set("path", "fast_td1")
            _perf_set("total_ms", int((time.perf_counter() - t0) * 1000))
            return fast_id

    _perf_set("fallback_used", True)
    logger.info(
        "FULL_PAGE_FALLBACK_USED=true reason=%s",
        "portrait_fast_miss" if clear_portrait else "fast_td3_td1_miss",
    )
    # FAST already spent the TD1 budget on landscape. Do not repeat the same
    # multi-ROI TD1 search (that caused 12–20s MRZ_NOT_FOUND tails).
    t_full = time.perf_counter()
    full = _read_passport_td3(image_bgr)
    _perf_add("full_ocr_ms", int((time.perf_counter() - t_full) * 1000))
    if _is_strict_td3(full):
        _perf_set("path", "fallback_td3")
        _perf_set("total_ms", int((time.perf_counter() - t0) * 1000))
        return full
    if clear_portrait:
        _perf_set("path", "fallback_td3")
        _perf_set("total_ms", int((time.perf_counter() - t0) * 1000))
        return full
    # Last chance TD1 only if FAST never entered (should be rare).
    hit = _read_id_card_td1(image_bgr)
    _perf_set("path", "fallback_td1" if hit is not None else "fallback_td3")
    _perf_set("total_ms", int((time.perf_counter() - t0) * 1000))
    return hit if hit is not None else full


def read_mrz_from_image(
    image_bgr: np.ndarray,
    *,
    document_hint: str = "auto",
    background: bool = False,
) -> ParsedMrz | None:
    """
    Full OCR pipeline.
    Passport FAST TD3 is unchanged and still runs first.
    ID cards use a separate FAST TD1 crop (bottom 35–45%, 3×30).
    Does not persist images. Does not log MRZ or personal data.
    """
    if image_bgr is None or image_bgr.size == 0:
        return None

    hint = document_hint if document_hint in ("auto", "passport", "id_card") else "auto"

    if hint == "passport":
        return _read_passport_td3_with_fast(image_bgr, background=background)

    if hint == "id_card":
        begin_ocr_perf()
        t0 = time.perf_counter()
        if background:
            _perf_set("fallback_used", False)
            _perf_set("path", "keep_warm")
            try:
                _run_paddle(image_bgr, rec_only=False, use_cls=True, background=True)
            except Exception:
                pass
            _perf_set("total_ms", int((time.perf_counter() - t0) * 1000))
            return None
        fast_id = _read_id_card_fast(image_bgr, background=False)
        if _fast_id_ok(fast_id):
            _perf_set("fallback_used", False)
            _perf_set("full_ocr_ms", 0)
            _perf_set("path", "fast_td1")
            _perf_set("total_ms", int((time.perf_counter() - t0) * 1000))
            return fast_id
        _perf_set("fallback_used", True)
        t_full = time.perf_counter()
        hit = _read_id_card_td1(image_bgr)
        _perf_set("full_ocr_ms", int((time.perf_counter() - t_full) * 1000))
        _perf_set("path", "fallback_td1")
        _perf_set("total_ms", int((time.perf_counter() - t0) * 1000))
        return hit

    passport_hit = _read_passport_td3_with_fast(image_bgr, background=background)
    if _is_strict_td3(passport_hit) or _fast_id_ok(passport_hit) or _is_strict_td1(passport_hit):
        return passport_hit
    if background:
        return None

    return _read_id_card_td1(image_bgr)
