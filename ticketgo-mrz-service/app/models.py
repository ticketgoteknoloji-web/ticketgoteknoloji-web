"""Pydantic response models for the MRZ API."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"


class MrzFields(BaseModel):
    surname: str | None = None
    given_names: str | None = None
    document_number: str | None = None
    nationality: str | None = None
    date_of_birth: str | None = None
    birth_date: str | None = None
    gender: str | None = None
    sex: str | None = None
    expiry_date: str | None = None
    issuing_country: str | None = None
    optional_data: str | None = None
    personal_number: str | None = None
    age: int | None = None
    document_type: str | None = None


class ValidationResult(BaseModel):
    document_number: bool = False
    date_of_birth: bool = False
    expiry_date: bool = False
    personal_number: bool = False
    composite: bool = False
    ocr_checksum_corrected: bool = False


class Diagnostics(BaseModel):
    """Non-sensitive OCR normalization diagnostics only."""

    corrections_applied: bool = False
    correction_count: int = 0


class MrzSuccessResponse(BaseModel):
    success: Literal[True] = True
    document_type: Literal["PASSPORT", "ID_CARD"]
    mrz_format: Literal["TD1", "TD3"]
    valid: bool
    confidence: float = Field(ge=0.0, le=1.0)
    document_number: str | None = None
    nationality: str | None = None
    surname: str | None = None
    given_names: str | None = None
    birth_date: str | None = None
    sex: str | None = None
    expiry_date: str | None = None
    personal_number: str | None = None
    raw_mrz: list[str] = Field(default_factory=list)
    fields: MrzFields
    validation: ValidationResult
    diagnostics: Diagnostics = Field(default_factory=Diagnostics)
    mrz_lines: list[str]
    warnings: list[str] = Field(default_factory=list)


class MrzErrorResponse(BaseModel):
    success: Literal[False] = False
    error: str
    message: str
    details: dict[str, Any] | None = None


class GeneralOcrLine(BaseModel):
    text: str
    confidence: float = Field(ge=0.0, le=1.0)
    boundingBox: list[list[float]] = Field(default_factory=list)


class VehicleRegistrationFields(BaseModel):
    plate: str | None = None
    vehicleType: str | None = None
    brand: str | None = None
    model: str | None = None
    modelYear: str | None = None
    vin: str | None = None
    engineNumber: str | None = None
    registrationDate: str | None = None
    ownerName: str | None = None
    documentNumber: str | None = None


class GeneralOcrSuccessResponse(BaseModel):
    success: Literal[True] = True
    documentType: str
    rawText: str
    lines: list[GeneralOcrLine] = Field(default_factory=list)
    fields: VehicleRegistrationFields = Field(default_factory=VehicleRegistrationFields)
    ocrMs: int = 0
    totalMs: int = 0


class GeneralOcrErrorResponse(BaseModel):
    success: Literal[False] = False
    error: str
    message: str
