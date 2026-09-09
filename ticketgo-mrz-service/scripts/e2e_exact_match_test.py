"""Exact-match e2e against live /v1/mrz/read — synthetic data only."""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = "http://127.0.0.1:8091"

EXACT_FIELDS = (
    "document_number",
    "nationality",
    "surname",
    "given_names",
    "birth_date",
    "expiry_date",
    "sex",
)


def _load_api_key() -> str:
    for line in (ROOT / ".env").read_text(encoding="utf-8-sig").splitlines():
        if line.startswith("MRZ_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("MRZ_API_KEY missing in .env")


def multipart(path: Path, hint: str) -> tuple[int, dict]:
    boundary = "----TicketGoMrzExactBoundary"
    data = path.read_bytes()
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="document_hint"\r\n\r\n'
        f"{hint}\r\n"
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{path.name}"\r\n'
        f"Content-Type: image/jpeg\r\n\r\n"
    ).encode() + data + f"\r\n--{boundary}--\r\n".encode()
    key = _load_api_key()
    req = urllib.request.Request(
        f"{API}/v1/mrz/read",
        data=body,
        headers={
            "Authorization": f"Bearer {key}",
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
            return e.code, {"raw": raw[:300]}


def evaluate(label: str, path: Path, hint: str, expected: dict) -> dict:
    status, payload = multipart(path, hint)
    mismatches = {}
    for field in EXACT_FIELDS:
        got = payload.get(field)
        exp = expected.get(field)
        if got != exp:
            mismatches[field] = {"expected": exp, "got": got}
    validation = payload.get("validation") or {}
    check_ok = all(
        [
            validation.get("document_number") is True,
            validation.get("date_of_birth") is True,
            validation.get("expiry_date") is True,
            validation.get("composite") is True,
        ]
    )
    result = {
        "label": label,
        "http": status,
        "valid": payload.get("valid"),
        "exact_field_match": status == 200 and not mismatches,
        "check_digits_ok": check_ok,
        "mismatches": mismatches,
        "diagnostics": payload.get("diagnostics"),
        "ocr_checksum_corrected": validation.get("ocr_checksum_corrected"),
        "mrz_format": payload.get("mrz_format"),
        "document_type": payload.get("document_type"),
        "error": payload.get("error"),
    }
    (ROOT / "testdata" / f"response_{label.lower()}.json").write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return result


def main() -> int:
    meta = json.loads((ROOT / "testdata" / "meta.json").read_text(encoding="utf-8"))
    results = {
        "TD3": evaluate(
            "TD3",
            ROOT / "testdata" / "synthetic_td3.jpg",
            "passport",
            meta["expected_td3"],
        ),
        "TD1": evaluate(
            "TD1",
            ROOT / "testdata" / "synthetic_td1.jpg",
            "id_card",
            meta["expected_td1"],
        ),
    }
    (ROOT / "testdata" / "e2e_exact_summary.json").write_text(
        json.dumps(results, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    # Print only non-secret summary (no raw MRZ dump in stdout beyond mismatch values which are synthetic)
    print(json.dumps(results, indent=2, ensure_ascii=False))
    ok = all(
        r["http"] == 200 and r["valid"] is True and r["exact_field_match"] and r["check_digits_ok"]
        for r in results.values()
    )
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
