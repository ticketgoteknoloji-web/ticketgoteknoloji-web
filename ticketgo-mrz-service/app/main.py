"""TicketGo MRZ OCR microservice — FastAPI entrypoint."""

from __future__ import annotations

import io
import logging
import tempfile
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
    HealthResponse,
    MrzErrorResponse,
    MrzFields,
    MrzSuccessResponse,
    ValidationResult,
)
from app.ocr.engine import init_ocr_engine, read_mrz_from_image
from app.security import (
    ALLOWED_FORMATS,
    client_ip,
    new_request_id,
    rate_limiter,
    require_bearer_token,
)

# Logging: never attach request bodies, images, MRZ lines, or personal data
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

logger = logging.getLogger("ticketgo-mrz")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    logging.getLogger().setLevel(getattr(logging, settings.log_level, logging.INFO))
    if settings.debug:
        logger.warning("DEBUG is enabled — disable in production")
    init_ocr_engine()
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


def _error(status_code: int, error: str, message: str) -> JSONResponse:
    body = MrzErrorResponse(success=False, error=error, message=message)
    return JSONResponse(status_code=status_code, content=body.model_dump())


def _load_image_from_bytes(data: bytes) -> np.ndarray:
    """Decode image with Pillow (EXIF fix) → OpenCV BGR. Validates real format."""
    try:
        with Image.open(io.BytesIO(data)) as img:
            fmt = (img.format or "").upper()
            if fmt not in ALLOWED_FORMATS:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        "success": False,
                        "error": "UNSUPPORTED_FORMAT",
                        "message": "Only JPEG and PNG images are accepted.",
                    },
                )
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
    return bgr


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

        image = _load_image_from_bytes(data)
        del data

        log.info("mrz_read_start hint=%s", document_hint)
        parsed = read_mrz_from_image(image, document_hint=document_hint)
        del image

        if parsed is None:
            log.info("mrz_read_result=MRZ_NOT_FOUND")
            return _error(422, "MRZ_NOT_FOUND", "Belgede geçerli MRZ alanı bulunamadı.")

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
        log.info(
            "mrz_read_result=OK format=%s valid=%s confidence=%.3f corrections=%s count=%s",
            parsed.mrz_format,
            parsed.valid,
            parsed.confidence,
            diagnostics.corrections_applied,
            diagnostics.correction_count,
        )
        return JSONResponse(status_code=200, content=response.model_dump())
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
