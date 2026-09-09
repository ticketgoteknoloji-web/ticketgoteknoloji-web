"""Ops helper: rotate key length check, recreate hints — never prints secret values."""

from __future__ import annotations

import os
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def key_len() -> int:
    for line in (ROOT / ".env").read_text(encoding="utf-8-sig").splitlines():
        if line.startswith("MRZ_API_KEY="):
            return len(line.split("=", 1)[1].strip().strip('"').strip("'"))
    return 0


def wait_local_health(timeout: int = 120) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen("http://127.0.0.1:8091/health", timeout=5) as r:
                if r.status == 200:
                    return
        except Exception:
            time.sleep(2)
    raise RuntimeError("local health timeout")


def start_tunnel(cloudflared: str) -> str:
    out_log = ROOT / "testdata" / "cloudflared-out.log"
    err_log = ROOT / "testdata" / "cloudflared-err.log"
    for p in (out_log, err_log, ROOT / ".tunnel-url"):
        if p.exists():
            p.unlink()
    # kill existing
    if sys.platform.startswith("win"):
        subprocess.run(["taskkill", "/F", "/IM", "cloudflared.exe"], capture_output=True)
    proc = subprocess.Popen(
        [cloudflared, "tunnel", "--url", "http://127.0.0.1:8091", "--no-autoupdate"],
        stdout=out_log.open("w", encoding="utf-8"),
        stderr=err_log.open("w", encoding="utf-8"),
        cwd=str(ROOT),
    )
    pattern = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com")
    deadline = time.time() + 90
    while time.time() < deadline:
        blob = ""
        for p in (out_log, err_log):
            if p.exists():
                blob += p.read_text(encoding="utf-8", errors="ignore")
        m = pattern.search(blob)
        if m:
            url = m.group(0)
            (ROOT / ".tunnel-url").write_text(url + "\n", encoding="ascii")
            print(f"tunnel_pid={proc.pid}")
            print(f"tunnel_url={url}")
            return url
        if proc.poll() is not None:
            raise RuntimeError("cloudflared exited early\n" + blob[-2000:])
        time.sleep(1)
    raise RuntimeError("tunnel url not found")


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    if cmd == "keylen":
        print("env_key_len", key_len())
    elif cmd == "tunnel":
        cf = sys.argv[2]
        start_tunnel(cf)
    elif cmd == "wait-health":
        wait_local_health()
        print("local_health_ok")
    else:
        raise SystemExit(f"unknown cmd {cmd}")


if __name__ == "__main__":
    main()
