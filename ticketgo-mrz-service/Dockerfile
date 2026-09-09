# syntax=docker/dockerfile:1
FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    # Paddle / OpenCV
    FLAGS_use_mkldnn=0 \
    MRZ_MAX_UPLOAD_MB=12 \
    LOG_LEVEL=INFO \
    DEBUG=false

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    libglib2.0-0 \
    libgl1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY app ./app

# Non-root user
RUN useradd --create-home --uid 10001 mrzuser \
    && mkdir -p /tmp/mrz \
    && chown -R mrzuser:mrzuser /app /tmp/mrz
USER mrzuser

EXPOSE 8091

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8091/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8091", "--workers", "1"]
