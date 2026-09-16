"""TicketGo MRZ OCR microservice — FastAPI entrypoint."""

from __future__ import annotations

import asyncio
import io
import json
import logging
import os
import sys
import tempfile
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Literal

import cv2
import numpy as np
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import JSONResponse
from PIL import Image, ImageOps

from app import __version__
from app.config import get_settings
from app.models import (
    Diagnostics,
    GeneralOcrErrorResponse,
    GeneralOcrLine,
    GeneralOcrSuccessResponse,
    HealthResponse,
    MrzErrorResponse,
    MrzFields,
    MrzSuccessResponse,
    ValidationResult,
    VehicleRegistrationFields,
)
from app.ocr.engine import (
    consume_ocr_perf,
    init_ocr_engine,
    read_mrz_from_image,
    warmup_ocr_engine,
)
from app.ocr.general import read_general_ocr
from app.ocr.debug_trace import consume_public_trace
from app.security import (
    ALLOWED_FORMATS,
    client_ip,
    new_request_id,
    rate_limiter,
    require_bearer_token,
)

# Logging: never attach request bodies, images, MRZ lines, or personal data
class _SafeFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        if not hasattr(record, "request_id"):
            record.request_id = "-"
        return super().format(record)


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s request_id=%(request_id)s %(message)s",
)


class _RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id"):
            record.request_id = "-"
        return True


for _handler in logging.root.handlers:
    _handler.addFilter(_RequestIdFilter())
    _handler.setFormatter(
        _SafeFormatter("%(asctime)s %(levelname)s %(name)s request_id=%(request_id)s %(message)s")
    )

logger = logging.getLogger("ticketgo-mrz")


KEEP_WARM_MAX_BYTES = 20_000
KEEP_WARM_MAX_EDGE = 220


def _reattach_app_logging() -> None:
    """PaddleOCR may steal root handlers; keep our timings on stderr."""
    fmt = _SafeFormatter("%(asctime)s %(levelname)s %(name)s request_id=%(request_id)s %(message)s")
    for name in ("ticketgo-mrz", "ticketgo-mrz.ocr"):
        lg = logging.getLogger(name)
        lg.setLevel(logging.INFO)
        lg.propagate = False
        lg.handlers.clear()
        handler = logging.StreamHandler(sys.stderr)
        handler.addFilter(_RequestIdFilter())
        handler.setFormatter(fmt)
        lg.addHandler(handler)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    logging.getLogger().setLevel(getattr(logging, settings.log_level, logging.INFO))
    if settings.debug:
        logger.warning("DEBUG is enabled — disable in production")
    init_ocr_engine()
    _reattach_app_logging()
    warmup_ocr_engine()
    _reattach_app_logging()
    yield


app = FastAPI(
    title="TicketGo MRZ Service",
    version=__version__,
    docs_url=None if not get_settings().debug else "/docs",
    redoc_url=None,
    openapi_url=None if not get_settings().debug else "/openapi.json",
    lifespan=lifespan,
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    # Public-safe: no version, no config, no secrets
    return HealthResponse(status="ok")


def _emit_local_debug(log: logging.LoggerAdapter, *, found: bool) -> None:
    """Write ephemeral local debug only when DEBUG=true. Not part of the API body."""
    settings = get_settings()
    if not settings.debug:
        return
    report = consume_public_trace(include_raw_lines=True)
    report["td3_found"] = found or bool(report.get("td3_found"))
    # Lengths and check booleans go to the process log. Raw lines go only to tmp.
    log.info(
        "mrz_debug ori=%s roi=%s variant=%s line_lens=%s checks=%s td3_found=%s oris=%s rois=%s",
        report.get("orientation"),
        report.get("roi"),
        report.get("variant"),
        report.get("line_lens"),
        report.get("checks"),
        report.get("td3_found"),
        report.get("orientations_tried"),
        report.get("rois_tried"),
    )
    path = Path(os.getenv("MRZ_DEBUG_FILE", str(Path(tempfile.gettempdir()) / "mrz_debug_last.json")))
    try:
        path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError:
        log.warning("mrz_debug_file_write_failed")


def _is_keep_warm(data_len: int, image: np.ndarray) -> bool:
    if data_len < KEEP_WARM_MAX_BYTES:
        return True
    h, w = image.shape[:2]
    return max(h, w) < KEEP_WARM_MAX_EDGE


def _server_timing(decode_ms: int, perf: dict) -> str:
    parts = [
        f"decode;dur={int(decode_ms)}",
        f"preprocess;dur={int(perf.get('preprocess_ms') or 0)}",
        f"model_init;dur={int(perf.get('model_init_ms') or 0)}",
        f"det;dur={int(perf.get('detection_ms') or 0)}",
        f"rec;dur={int(perf.get('recognition_ms') or 0)}",
        f"angle;dur={int(perf.get('angle_orientation_ms') or 0)}",
        f"post;dur={int(perf.get('postprocess_ms') or 0)}",
        f"lock;dur={int(perf.get('lock_wait_ms') or 0)}",
        f"total;dur={int(perf.get('total_ms') or 0)}",
    ]
    return ", ".join(parts)


def _run_ocr_job(image: np.ndarray, document_hint: str, background: bool):
    """Run OCR in a worker thread and return perf from the same thread."""
    parsed = read_mrz_from_image(
        image,
        document_hint=document_hint,
        background=background,
    )
    return parsed, consume_ocr_perf()


def _log_mrz_perf(log: logging.LoggerAdapter, *, decode_ms: int = 0, perf: dict | None = None) -> dict:
    if perf is None:
        perf = consume_ocr_perf()
    else:
        perf = dict(perf)
    if decode_ms:
        perf["decode_ms"] = int(decode_ms)
    line = (
        "mrz_perf total_ms=%s decode_ms=%s preprocess_ms=%s model_init_ms=%s "
        "det_ms=%s rec_ms=%s angle_ms=%s post_ms=%s lock_wait_ms=%s "
        "fast_crop_ms=%s fast_ocr_ms=%s FAST_DETECTION_MS=%s FAST_RECOGNITION_MS=%s "
        "fallback_used=%s FULL_PAGE_FALLBACK_USED=%s full_ocr_ms=%s FULL_PAGE_MS=%s "
        "ocr_calls=%s keep_warm_skipped=%s path=%s"
        % (
            int(perf.get("total_ms") or 0),
            int(perf.get("decode_ms") or 0),
            int(perf.get("preprocess_ms") or 0),
            int(perf.get("model_init_ms") or 0),
            int(perf.get("detection_ms") or 0),
            int(perf.get("recognition_ms") or 0),
            int(perf.get("angle_orientation_ms") or 0),
            int(perf.get("postprocess_ms") or 0),
            int(perf.get("lock_wait_ms") or 0),
            int(perf.get("fast_crop_ms") or 0),
            int(perf.get("fast_ocr_ms") or 0),
            int(perf.get("fast_crop_ms") or 0),
            int(perf.get("fast_ocr_ms") or 0),
            bool(perf.get("fallback_used")),
            bool(perf.get("fallback_used")),
            int(perf.get("full_ocr_ms") or 0),
            int(perf.get("full_ocr_ms") or 0),
            int(perf.get("ocr_calls") or 0),
            bool(perf.get("keep_warm_skipped")),
            str(perf.get("path") or ""),
        )
    )
    print(line, file=sys.stderr, flush=True)
    log.info(line)
    return perf


def _error(status_code: int, error: str, message: str, *, headers: dict | None = None) -> JSONResponse:
    body = MrzErrorResponse(success=False, error=error, message=message)
    return JSONResponse(status_code=status_code, content=body.model_dump(), headers=headers or None)


def _load_image_from_bytes(data: bytes) -> tuple[np.ndarray, dict[str, object]]:
    """Decode image with Pillow (EXIF fix) → OpenCV BGR. Validates real format."""
    meta: dict[str, object] = {
        "exif_orientation": None,
        "rotation_applied": 0,
        "input_mime": None,
    }
    try:
        with Image.open(io.BytesIO(data)) as img:
            fmt = (img.format or "").upper()
            meta["input_mime"] = {
                "JPEG": "image/jpeg",
                "PNG": "image/png",
            }.get(fmt, fmt.lower() or "unknown")
            if fmt not in ALLOWED_FORMATS:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        "success": False,
                        "error": "UNSUPPORTED_FORMAT",
                        "message": "Only JPEG and PNG images are accepted.",
                    },
                )
            try:
                exif = img.getexif()
                orientation = int(exif.get(274)) if exif and 274 in exif else None
            except Exception:
                orientation = None
            meta["exif_orientation"] = orientation
            # Pillow transpose maps EXIF orientation to upright pixels.
            rotation_map = {None: 0, 1: 0, 2: 0, 3: 180, 4: 0, 5: 90, 6: 90, 7: 270, 8: 270}
            meta["rotation_applied"] = rotation_map.get(orientation, 0)
            img = ImageOps.exif_transpose(img)
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            elif img.mode == "L":
                img = img.convert("RGB")
            arr = np.array(img)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "success": False,
                "error": "INVALID_IMAGE",
                "message": "Image could not be decoded.",
            },
        ) from exc

    if arr.ndim == 2:
        bgr = cv2.cvtColor(arr, cv2.COLOR_GRAY2BGR)
    else:
        bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
    return bgr, meta


@app.post(
    "/v1/mrz/read",
    responses={
        200: {"model": MrzSuccessResponse},
        401: {"model": MrzErrorResponse},
        413: {"model": MrzErrorResponse},
        422: {"model": MrzErrorResponse},
        429: {"model": MrzErrorResponse},
    },
    dependencies=[Depends(require_bearer_token)],
)
async def read_mrz(
    request: Request,
    file: Annotated[UploadFile, File(...)],
    document_hint: Annotated[Literal["auto", "passport", "id_card"], Form()] = "auto",
) -> JSONResponse:
    settings = get_settings()
    request_id = new_request_id()
    log = logging.LoggerAdapter(logger, {"request_id": request_id})

    rate_limiter.check(client_ip(request), settings.rate_limit_per_minute, 60)

    content_type = (file.content_type or "").lower()
    if content_type and content_type not in {"image/jpeg", "image/png", "application/octet-stream"}:
        return _error(422, "UNSUPPORTED_FORMAT", "Only JPEG and PNG images are accepted.")

    data = await file.read()
    await file.close()

    if not data:
        return _error(422, "EMPTY_FILE", "Uploaded file is empty.")

    if len(data) > settings.max_upload_bytes:
        return _error(413, "FILE_TOO_LARGE", f"Maximum upload size is {settings.max_upload_mb} MB.")

    tmp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".img", delete=False) as tmp:
            tmp.write(data)
            tmp_path = Path(tmp.name)

        t_decode = time.perf_counter()
        image, decode_meta = _load_image_from_bytes(data)
        decode_ms = int((time.perf_counter() - t_decode) * 1000)
        data_len = len(data)
        del data
        background = _is_keep_warm(data_len, image)

        log.info("mrz_read_start hint=%s background=%s", document_hint, background)
        h, w = image.shape[:2]
        aspect = float(w) / float(h) if h else 0.0
        detection = "identity" if aspect >= 1.15 else ("passport" if aspect <= 0.90 else "unknown")
        log.info(
            "INPUT_FILE_RECEIVED=true INPUT_MIME=%s INPUT_BYTES=%s IMAGE_WIDTH=%s IMAGE_HEIGHT=%s "
            "EXIF_ORIENTATION=%s ROTATION_APPLIED=%s detection=%s hint=%s",
            decode_meta.get("input_mime") or content_type or "unknown",
            data_len,
            w,
            h,
            decode_meta.get("exif_orientation"),
            decode_meta.get("rotation_applied"),
            detection,
            document_hint,
        )
        parsed, perf = await asyncio.to_thread(
            _run_ocr_job,
            image,
            document_hint,
            background,
        )
        del image

        if parsed is None:
            perf = _log_mrz_perf(log, decode_ms=decode_ms, perf=perf)
            log.info(
                "mrz_read_result=MRZ_NOT_FOUND FINAL_HTTP_STATUS=422 FINAL_ERROR_CODE=MRZ_NOT_FOUND "
                "FULL_PAGE_FALLBACK_USED=%s path=%s",
                bool(perf.get("fallback_used")),
                perf.get("path"),
            )
            _emit_local_debug(log, found=False)
            return _error(
                422,
                "MRZ_NOT_FOUND",
                "Belgede geçerli MRZ alanı bulunamadı.",
                headers={"Server-Timing": _server_timing(decode_ms, perf)},
            )

        if document_hint == "passport":
            lines = list(parsed.mrz_lines or [])
            td3_ok = (
                parsed.mrz_format == "TD3"
                and len(lines) == 2
                and all(len(x) == 44 for x in lines)
                and lines[0].startswith("P<")
            )
            td1_ok = (
                parsed.mrz_format == "TD1"
                and parsed.valid is True
                and len(lines) == 3
                and all(len(x) == 30 for x in lines)
            )
            if not td3_ok and not td1_ok:
                perf = _log_mrz_perf(log, decode_ms=decode_ms, perf=perf)
                log.info("mrz_read_result=MRZ_NOT_FOUND")
                _emit_local_debug(log, found=False)
                return _error(
                    422,
                    "MRZ_NOT_FOUND",
                    "Belgede geçerli MRZ alanı bulunamadı.",
                    headers={"Server-Timing": _server_timing(decode_ms, perf)},
                )

        src = dict(parsed.fields)
        dob = src.get("date_of_birth")
        sex_val = src.get("gender")
        src["birth_date"] = dob
        src["sex"] = sex_val
        fields = MrzFields(**{k: src.get(k) for k in MrzFields.model_fields})
        validation = ValidationResult(
            document_number=bool(parsed.validation.get("document_number")),
            date_of_birth=bool(parsed.validation.get("date_of_birth")),
            expiry_date=bool(parsed.validation.get("expiry_date")),
            personal_number=bool(parsed.validation.get("personal_number")),
            composite=bool(parsed.validation.get("composite")),
            ocr_checksum_corrected=bool(parsed.validation.get("ocr_checksum_corrected")),
        )
        diagnostics = Diagnostics(
            corrections_applied=bool(parsed.corrected or parsed.correction_count > 0),
            correction_count=int(parsed.correction_count or 0),
        )
        response = MrzSuccessResponse(
            success=True,
            document_type=parsed.document_type,
            mrz_format=parsed.mrz_format,
            valid=parsed.valid,
            confidence=round(float(parsed.confidence), 4),
            document_number=src.get("document_number"),
            nationality=src.get("nationality"),
            surname=src.get("surname"),
            given_names=src.get("given_names"),
            birth_date=dob,
            sex=sex_val,
            expiry_date=src.get("expiry_date"),
            personal_number=src.get("personal_number") or src.get("optional_data") or "",
            raw_mrz=list(parsed.mrz_lines),
            fields=fields,
            validation=validation,
            diagnostics=diagnostics,
            mrz_lines=parsed.mrz_lines,
            warnings=list(parsed.warnings),
        )
        # Do not log fields, MRZ lines, images, or personal data
        perf = _log_mrz_perf(log, decode_ms=decode_ms, perf=perf)
        log.info(
            "mrz_read_result=OK FINAL_HTTP_STATUS=200 FINAL_ERROR_CODE=none "
            "format=%s valid=%s FULL_PAGE_FALLBACK_USED=%s path=%s",
            parsed.mrz_format,
            parsed.valid,
            bool(perf.get("fallback_used")),
            perf.get("path"),
        )
        _emit_local_debug(log, found=True)
        return JSONResponse(
            status_code=200,
            content=response.model_dump(),
            headers={"Server-Timing": _server_timing(decode_ms, perf)},
        )
    except HTTPException as exc:
        detail = exc.detail
        if isinstance(detail, dict) and detail.get("success") is False:
            return JSONResponse(status_code=exc.status_code, content=detail)
        raise
    except Exception:
        log.exception("mrz_read_internal_error")
        return _error(500, "INTERNAL_ERROR", "MRZ processing failed.")
    finally:
        if tmp_path is not None:
            try:
                tmp_path.unlink(missing_ok=True)
            except OSError:
                pass


def _general_error(status_code: int, error: str, message: str) -> JSONResponse:
    body = GeneralOcrErrorResponse(success=False, error=error, message=message)
    return JSONResponse(status_code=status_code, content=body.model_dump())


@app.post(
    "/v1/ocr/read",
    responses={
        200: {"model": GeneralOcrSuccessResponse},
        400: {"model": GeneralOcrErrorResponse},
        401: {"model": GeneralOcrErrorResponse},
        500: {"model": GeneralOcrErrorResponse},
    },
    dependencies=[Depends(require_bearer_token)],
)
async def read_general_document(
    request: Request,
    file: UploadFile = File(...),
    document_hint: Annotated[
        Literal["auto", "vehicle_registration", "identity", "passport", "other"],
        Form(),
    ] = "auto",
) -> JSONResponse:
    """
    General document OCR — MRZ is NOT required.
    Reuses the preloaded PaddleOCR singleton. Does not alter /v1/mrz/read.
    """
    settings = get_settings()
    request_id = new_request_id()
    log = logging.LoggerAdapter(logger, {"request_id": request_id})
    rate_limiter.check(client_ip(request), settings.rate_limit_per_minute, 60)

    content_type = (file.content_type or "").lower()
    if content_type and content_type not in {"image/jpeg", "image/png", "application/octet-stream"}:
        return _general_error(400, "INVALID_IMAGE", "Only JPEG and PNG images are accepted.")

    data = await file.read()
    await file.close()
    if not data:
        return _general_error(400, "FILE_REQUIRED", "Uploaded file is empty.")

    if len(data) > settings.max_upload_bytes:
        return _general_error(400, "INVALID_IMAGE", f"Maximum upload size is {settings.max_upload_mb} MB.")

    t0 = time.perf_counter()
    try:
        try:
            image, decode_meta = _load_image_from_bytes(data)
        except HTTPException as exc:
            detail = exc.detail if isinstance(exc.detail, dict) else {}
            err = str(detail.get("error") or "INVALID_IMAGE")
            msg = str(detail.get("message") or "Image could not be decoded.")
            return _general_error(400, "INVALID_IMAGE", msg if err else "Image could not be decoded.")

        del data
        h, w = image.shape[:2]
        log.info(
            "general_ocr_start hint=%s width=%s height=%s bytes_meta=%s exif=%s",
            document_hint,
            w,
            h,
            decode_meta.get("input_mime"),
            decode_meta.get("exif_orientation"),
        )

        def _job():
            return read_general_ocr(image, document_hint=document_hint)

        try:
            result = await asyncio.to_thread(_job)
        except Exception:
            log.exception("general_ocr_failed")
            return _general_error(500, "OCR_FAILED", "OCR processing failed.")

        lines = [
            GeneralOcrLine(
                text=ln.text,
                confidence=round(float(ln.confidence), 4),
                boundingBox=ln.bounding_box,
            )
            for ln in result.lines
        ]
        response = GeneralOcrSuccessResponse(
            success=True,
            documentType=result.document_type,
            rawText=result.raw_text,
            lines=lines,
            fields=VehicleRegistrationFields(**result.fields),
            ocrMs=int(result.ocr_ms),
            totalMs=int(result.total_ms or int((time.perf_counter() - t0) * 1000)),
        )
        log.info(
            "general_ocr_result=OK lines=%s ocr_ms=%s total_ms=%s doc_type=%s",
            len(lines),
            response.ocrMs,
            response.totalMs,
            response.documentType,
        )
        return JSONResponse(status_code=200, content=response.model_dump())
    except Exception:
        log.exception("general_ocr_internal_error")
        return _general_error(500, "OCR_FAILED", "OCR processing failed.")
