"""E2E multipart upload test against local MRZ API."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from pathlib import Path

API = "http://127.0.0.1:8091"
ROOT = Path(__file__).resolve().parents[1]


def _load_api_key() -> str:
    env_path = ROOT / ".env"
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if line.startswith("MRZ_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("MRZ_API_KEY missing in .env")


KEY = _load_api_key()


def multipart(path: Path, hint: str) -> tuple[int, dict]:
    boundary = "----TicketGoMrzBoundary7MA4YWxkTrZu0gW"
    data = path.read_bytes()
    parts = [
        (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="document_hint"\r\n\r\n'
            f"{hint}\r\n"
        ).encode(),
        (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="file"; filename="{path.name}"\r\n'
            f"Content-Type: image/jpeg\r\n\r\n"
        ).encode()
        + data
        + b"\r\n",
        f"--{boundary}--\r\n".encode(),
    ]
    body = b"".join(parts)
    req = urllib.request.Request(
        f"{API}/v1/mrz/read",
        data=body,
        headers={
            "Authorization": f"Bearer {KEY}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw}


def main() -> None:
    required = [
        "document_type",
        "document_number",
        "nationality",
        "surname",
        "given_names",
        "birth_date",
        "sex",
        "expiry_date",
        "personal_number",
        "raw_mrz",
        "valid",
    ]
    results = {}
    for label, path, hint in [
        ("TD3", ROOT / "testdata" / "synthetic_td3.jpg", "passport"),
        ("TD1", ROOT / "testdata" / "synthetic_td1.jpg", "id_card"),
    ]:
        status, payload = multipart(path, hint)
        missing = [k for k in required if k not in payload]
        summary = {
            "http": status,
            "missing_top_level": missing,
            "success": payload.get("success"),
            "document_type": payload.get("document_type"),
            "mrz_format": payload.get("mrz_format"),
            "valid": payload.get("valid"),
            "document_number": payload.get("document_number"),
            "nationality": payload.get("nationality"),
            "surname": payload.get("surname"),
            "given_names": payload.get("given_names"),
            "birth_date": payload.get("birth_date"),
            "sex": payload.get("sex"),
            "expiry_date": payload.get("expiry_date"),
            "personal_number": payload.get("personal_number"),
            "raw_mrz": payload.get("raw_mrz"),
            "validation": payload.get("validation"),
            "confidence": payload.get("confidence"),
            "error": payload.get("error"),
            "message": payload.get("message"),
        }
        results[label] = summary
        (ROOT / "testdata" / f"response_{label.lower()}.json").write_text(
            json.dumps(payload, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        print(f"==== {label}")
        print(json.dumps(summary, indent=2, ensure_ascii=False))
    (ROOT / "testdata" / "e2e_summary.json").write_text(
        json.dumps(results, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
