"""Ephemeral passport-OCR debug trace. Never used in production logs by default."""

from __future__ import annotations

from typing import Any

# Process-local last attempt. Not a persistent log. Cleared after consume.
_LAST: dict[str, Any] = {}


def reset_trace() -> None:
    _LAST.clear()
    _LAST.update(
        {
            "orientations_tried": 0,
            "rois_tried": 0,
            "orientation": None,
            "roi": None,
            "variant": None,
            "line_lens": [],
            "checks": {},
            "raw_lines": [],
            "td3_found": False,
        }
    )


def note_orientation() -> None:
    _LAST["orientations_tried"] = int(_LAST.get("orientations_tried") or 0) + 1


def note_roi() -> None:
    _LAST["rois_tried"] = int(_LAST.get("rois_tried") or 0) + 1


def record_pick(
    *,
    orientation: str,
    roi: str,
    variant: str,
    line_lens: list[int],
    checks: dict[str, bool],
    raw_lines: list[str],
    td3_found: bool,
) -> None:
    _LAST["orientation"] = orientation
    _LAST["roi"] = roi
    _LAST["variant"] = variant
    _LAST["line_lens"] = list(line_lens)
    _LAST["checks"] = dict(checks)
    _LAST["raw_lines"] = list(raw_lines)
    _LAST["td3_found"] = bool(td3_found)


def snapshot() -> dict[str, Any]:
    return dict(_LAST)


def consume_public_trace(*, include_raw_lines: bool) -> dict[str, Any]:
    """Copy for local debug file. Raw MRZ lines only when explicitly allowed."""
    data = snapshot()
    if not include_raw_lines:
        data.pop("raw_lines", None)
    return data
