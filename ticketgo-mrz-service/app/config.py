"""Application configuration from environment variables."""

from __future__ import annotations

import os
from functools import lru_cache


class Settings:
    def __init__(self) -> None:
        self.mrz_api_key: str = os.getenv("MRZ_API_KEY", "").strip()
        self.max_upload_mb: int = int(os.getenv("MRZ_MAX_UPLOAD_MB", "8"))
        self.log_level: str = os.getenv("LOG_LEVEL", "INFO").upper()
        self.service_name: str = "ticketgo-mrz"
        self.version: str = "1.0.0"
        self.debug: bool = os.getenv("DEBUG", "false").lower() in {"1", "true", "yes"}
        self.rate_limit_per_minute: int = int(os.getenv("MRZ_RATE_LIMIT_PER_MINUTE", "30"))
        # OCR — PaddleOCR 2.8.1 real constructor names only
        self.paddle_lang: str = os.getenv("PADDLE_LANG", "en")
        self.paddle_use_gpu: bool = os.getenv("PADDLE_USE_GPU", "false").lower() in {"1", "true", "yes"}
        # Keep angle classifier on: it was required for the working FAST passport path.
        self.paddle_use_angle_cls: bool = os.getenv("PADDLE_USE_ANGLE_CLS", "true").lower() in {
            "1",
            "true",
            "yes",
        }
        self.paddle_enable_mkldnn: bool = os.getenv("PADDLE_ENABLE_MKLDNN", "false").lower() in {
            "1",
            "true",
            "yes",
        }
        self.paddle_cpu_threads: int = int(os.getenv("PADDLE_CPU_THREADS", "4"))

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
