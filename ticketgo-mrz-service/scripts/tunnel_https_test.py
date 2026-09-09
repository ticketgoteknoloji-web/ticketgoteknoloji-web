"""Validate auth locally and via Cloudflare tunnel without printing secrets.

Uses Cloudflare DoH when local DNS cannot resolve trycloudflare.com hostnames.
"""

from __future__ import annotations

import http.client
import json
import socket
import ssl
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_key() -> str:
    for line in (ROOT / ".env").read_text(encoding="utf-8-sig").splitlines():
        if line.startswith("MRZ_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("MRZ_API_KEY missing")


def resolve_host(hostname: str) -> str:
    try:
        return socket.getaddrinfo(hostname, 443, type=socket.SOCK_STREAM)[0][4][0]
    except OSError:
        req = urllib.request.Request(
            f"https://cloudflare-dns.com/dns-query?name={hostname}&type=A",
            headers={"Accept": "application/dns-json"},
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
        for ans in data.get("Answer") or []:
            if ans.get("type") == 1 and ans.get("data"):
                return str(ans["data"])
        raise RuntimeError(f"DoH could not resolve {hostname}")


def https_request(
    hostname: str,
    method: str,
    path: str,
    *,
    headers: dict[str, str] | None = None,
    body: bytes | None = None,
    timeout: int = 300,
) -> tuple[int, dict | str]:
    ip = resolve_host(hostname)
    ctx = ssl.create_default_context()
    original = socket.create_connection

    def create_connection(address, *args, **kwargs):  # type: ignore[no-untyped-def]
        host, port = address
        if host == hostname:
            return original((ip, port), *args, **kwargs)
        return original(address, *args, **kwargs)

    socket.create_connection = create_connection  # type: ignore[assignment]
    try:
        conn = http.client.HTTPSConnection(hostname, timeout=timeout, context=ctx)
        hdrs = {"Host": hostname}
        if headers:
            hdrs.update(headers)
        conn.request(method, path, body=body, headers=hdrs)
        resp = conn.getresponse()
        raw = resp.read().decode()
        try:
            payload: dict | str = json.loads(raw)
        except Exception:
            payload = raw[:300]
        return resp.status, payload
    finally:
        socket.create_connection = original  # type: ignore[assignment]
        try:
            conn.close()
        except Exception:
            pass


def http_request(
    base: str,
    method: str,
    path: str,
    *,
    headers: dict[str, str] | None = None,
    body: bytes | None = None,
    timeout: int = 300,
) -> tuple[int, dict | str]:
    base = base.rstrip("/")
    if base.startswith("https://"):
        return https_request(base[len("https://") :], method, path, headers=headers, body=body, timeout=timeout)

    req = urllib.request.Request(f"{base}{path}", data=body, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode()
            try:
                return resp.status, json.loads(raw)
            except Exception:
                return resp.status, raw[:300]
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw[:300]


def post_mrz(base: str, key: str | None, image: Path) -> tuple[int, dict | str]:
    data = image.read_bytes()
    boundary = "----TicketGoMrzBoundary7MA4YWxkTrZu0gW"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="document_hint"\r\n\r\n'
        f"auto\r\n"
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{image.name}"\r\n'
        f"Content-Type: image/jpeg\r\n\r\n"
    ).encode() + data + f"\r\n--{boundary}--\r\n".encode()
    headers = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
    if key is not None:
        headers["Authorization"] = f"Bearer {key}"
    return http_request(base, "POST", "/v1/mrz/read", headers=headers, body=body, timeout=300)


def main() -> None:
    key = load_key()
    image = ROOT / "testdata" / "synthetic_td3.jpg"
    tunnel = (ROOT / ".tunnel-url").read_text(encoding="utf-8-sig").strip().rstrip("/")
    out: dict = {
        "env_key_len": len(key),
        "env_key_ge_32": len(key) >= 32,
    }

    code, hb = http_request(tunnel, "GET", "/health", timeout=60)
    out["health_http"] = code
    out["health_body"] = hb
    out["health_minimal"] = (
        isinstance(hb, dict) and list(hb.keys()) == ["status"] and hb.get("status") == "ok"
    )

    code, _ = post_mrz(tunnel, None, image)
    out["tunnel_unauth_http"] = code
    out["tunnel_unauth_ok"] = code == 401

    code, payload = post_mrz("http://127.0.0.1:8091", key, image)
    out["local_auth_http"] = code
    out["local_auth_ok"] = (
        code == 200
        and isinstance(payload, dict)
        and payload.get("success") is True
        and payload.get("valid") is True
    )

    code, payload = post_mrz(tunnel, key, image)
    out["tunnel_auth_http"] = code
    out["tunnel_auth_ok"] = (
        code == 200
        and isinstance(payload, dict)
        and payload.get("success") is True
        and payload.get("valid") is True
    )
    if code == 200 and isinstance(payload, dict):
        out["document_type"] = payload.get("document_type")
        out["required_fields"] = all(
            k in payload
            for k in [
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
        )

    out["base"] = tunnel
    out["test_ok"] = bool(
        out.get("health_minimal")
        and out.get("tunnel_unauth_ok")
        and out.get("local_auth_ok")
        and out.get("tunnel_auth_ok")
        and out.get("required_fields")
    )
    print(json.dumps(out, indent=2))
    (ROOT / "testdata" / "tunnel_test_result.json").write_text(json.dumps(out, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
