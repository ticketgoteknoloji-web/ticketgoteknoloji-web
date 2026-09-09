# TicketGo MRZ OCR Service

Self-hosted MRZ (Machine Readable Zone) OCR API for passports (ICAO TD3) and ID cards (ICAO TD1).

**No cloud OCR.** All recognition runs inside this container (PaddleOCR / PaddlePaddle). Images are not persisted; personal data is not written to application logs.

## Requirements

- Docker + Docker Compose (recommended for production)
- Or Python 3.11+ for local development

## 1. Local setup

```bash
cd ticketgo-mrz-service
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env   # Windows
# cp .env.example .env   # Linux/macOS
# Edit .env and set MRZ_API_KEY

uvicorn app.main:app --host 0.0.0.0 --port 8091
```

First start downloads PaddleOCR detection/recognition models into the user cache (local disk only).

## 2. Docker setup

```bash
cd ticketgo-mrz-service
copy .env.example .env
# Set a strong MRZ_API_KEY in .env

docker compose up -d --build
```

Service listens on **8091**.

Internal Docker network name: `ticketgo-internal`  
Other containers (e.g. n8n) can call: `http://ticketgo-mrz:8091`

`/tmp` is mounted as **tmpfs** (no persistent image files on host disk).

## 3. Tests

Parser/checksum tests do not need GPU or live OCR models:

```bash
cd ticketgo-mrz-service
pip install -r requirements.txt
pytest -q tests/
```

## 4. curl examples

Health (no API key):

```bash
curl -s http://localhost:8091/health
```

Read MRZ:

```bash
curl -s -X POST http://localhost:8091/v1/mrz/read ^
  -H "X-API-Key: YOUR_KEY" ^
  -F "file=@passport.jpg" ^
  -F "document_hint=auto"
```

Linux/macOS:

```bash
curl -s -X POST http://localhost:8091/v1/mrz/read \
  -H "X-API-Key: YOUR_KEY" \
  -F "file=@passport.jpg" \
  -F "document_hint=passport"
```

Hints: `auto` | `passport` | `id_card`

## 5. n8n HTTP Request integration

1. Node type: **HTTP Request**
2. Method: `POST`
3. URL: `http://ticketgo-mrz:8091/v1/mrz/read` (same Docker network)  
   or `http://host.docker.internal:8091/v1/mrz/read` if n8n runs elsewhere on the host
4. Authentication: Header  
   Name: `X-API-Key`  
   Value: `{{$env.MRZ_API_KEY}}` (or n8n credential)
5. Body Content Type: **Form-Data / Multipart**
6. Field `file`: binary from previous node (image)
7. Optional field `document_hint`: `auto`
8. On `success: false` / HTTP 422: do **not** invent passenger data — route to manual review

TicketGo Core remains source of truth for pricing categories (adult/child/infant). This service only returns `date_of_birth` and `age`.

## 6. API response

### `GET /health`

```json
{
  "status": "ok",
  "service": "ticketgo-mrz",
  "version": "1.0.0"
}
```

### `POST /v1/mrz/read` success (HTTP 200)

- `document_type`: `PASSPORT` or `ID_CARD`
- `mrz_format`: `TD3` or `TD1`
- `valid`: all ICAO check digits passed and dates parsed
- `fields`: surname, given_names, document_number, nationality, dates (ISO), gender, age, optional_data, …
- `validation`: per-field checksum booleans
- `mrz_lines`: raw MRZ lines used
- `warnings`: e.g. `DOCUMENT_EXPIRED`, `OCR_CHECKSUM_CORRECTED`

### Failure (HTTP 422)

```json
{
  "success": false,
  "error": "MRZ_NOT_FOUND",
  "message": "Belgede geçerli MRZ alanı bulunamadı."
}
```

Other errors: `UNAUTHORIZED` (401), `FILE_TOO_LARGE` (413), `UNSUPPORTED_FORMAT`, `INVALID_IMAGE`, `API_KEY_NOT_CONFIGURED` (503).

## 7. Security / KVKK notes

- Set a long random `MRZ_API_KEY`; never commit real keys
- Do not publish port 8091 to the public internet in production; keep on internal network
- Images are processed in memory / tmpfs and deleted after the request
- Application logs intentionally omit MRZ lines, names, document numbers, and dates of birth
- Max upload: 12 MB (configurable)
- `DEBUG=false` in production (disables `/docs`)
- No Google Vision, AWS Textract, Azure OCR, OpenAI, or other external OCR APIs

## License

Internal TicketGo component.
