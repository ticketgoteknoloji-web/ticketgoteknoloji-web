"""Generate synthetic OCR-B-like MRZ images (fictional data only — no real PII)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.mrz.checksum import compute_check_digit  # noqa: E402

# Fictional expected fields used by exact-match e2e
EXPECTED_TD3 = {
    "document_number": "U12345678",
    "nationality": "TUR",
    "surname": "YILMAZ",
    "given_names": "AHMET",
    "birth_date": "1990-05-21",
    "expiry_date": "2031-06-10",
    "sex": "M",
}
EXPECTED_TD1 = dict(EXPECTED_TD3)
EXPECTED_TD1["document_number"] = "A12345678"


def build_td3_lines() -> list[str]:
    name = "YILMAZ<<AHMET"
    line1 = ("P<TUR" + name).ljust(44, "<")
    doc_num = EXPECTED_TD3["document_number"]
    doc_cd = compute_check_digit(doc_num)
    dob = "900521"
    dob_cd = compute_check_digit(dob)
    exp = "310610"
    exp_cd = compute_check_digit(exp)
    optional = "<<<<<<<<<<<<<<"
    opt_cd = compute_check_digit(optional)
    composite = doc_num + doc_cd + dob + dob_cd + exp + exp_cd + optional + opt_cd
    line2 = (
        f"{doc_num}{doc_cd}TUR{dob}{dob_cd}M{exp}{exp_cd}"
        f"{optional}{opt_cd}{compute_check_digit(composite)}"
    )
    assert len(line1) == 44 and len(line2) == 44
    return [line1, line2]


def build_td1_lines() -> list[str]:
    doc_num = EXPECTED_TD1["document_number"]
    doc_cd = compute_check_digit(doc_num)
    optional1 = "<<<<<<<<<<<<<<<"
    line1 = f"I<TUR{doc_num}{doc_cd}{optional1}"
    dob = "900521"
    dob_cd = compute_check_digit(dob)
    exp = "310610"
    exp_cd = compute_check_digit(exp)
    optional2 = "<<<<<<<<<<<"
    composite = doc_num + doc_cd + optional1 + dob + dob_cd + exp + exp_cd + optional2
    line2 = f"{dob}{dob_cd}M{exp}{exp_cd}TUR{optional2}{compute_check_digit(composite)}"
    line3 = "YILMAZ<<AHMET".ljust(30, "<")
    assert len(line1) == 30 and len(line2) == 30 and len(line3) == 30
    return [line1, line2, line3]


def _load_ocrb_like_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """Prefer monospace fonts that resemble OCR-B stroke geometry."""
    candidates = [
        "C:/Windows/Fonts/courbd.ttf",  # Courier New Bold
        "C:/Windows/Fonts/cour.ttf",
        "C:/Windows/Fonts/consolab.ttf",
        "C:/Windows/Fonts/consola.ttf",
        "C:/Windows/Fonts/lucon.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def render_mrz_ocrb(lines: list[str], out: Path) -> None:
    """
    Render MRZ as fixed-width character cells (OCR-B style strip).
    High contrast, generous glyph size, slight stroke thickening.
    """
    n_chars = max(len(l) for l in lines)
    cell_w = 28
    cell_h = 44
    pad_x = 48
    pad_y = 36
    visual_h = 220
    width = pad_x * 2 + cell_w * n_chars
    height = pad_y * 2 + visual_h + cell_h * len(lines) + 24
    img = Image.new("RGB", (width, height), (236, 236, 230))
    draw = ImageDraw.Draw(img)

    # Blank visual zone (no real photo / PII)
    draw.rectangle([32, 32, width - 32, 32 + visual_h], fill=(220, 220, 214), outline=(180, 180, 170))
    draw.text((48, 48), "SYNTHETIC DOCUMENT — NOT A REAL ID", fill=(120, 120, 120))

    font = _load_ocrb_like_font(34)
    y0 = 32 + visual_h + 20
    for row, line in enumerate(lines):
        y = y0 + row * cell_h
        for i, ch in enumerate(line):
            x = pad_x + i * cell_w
            # Fixed cell guide (very light) helps spacing without confusing OCR much
            # Draw glyph with slight bolding via multi-pass offsets
            for dx, dy in ((0, 0), (1, 0), (0, 1)):
                draw.text((x + 2 + dx, y + 4 + dy), ch, fill=(8, 8, 8), font=font)

    # Mild unsharp to mimic print
    img = img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=120, threshold=2))
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, format="JPEG", quality=98, subsampling=0)


def main() -> None:
    out_dir = ROOT / "testdata"
    td3 = out_dir / "synthetic_td3.jpg"
    td1 = out_dir / "synthetic_td1.jpg"
    td3_lines = build_td3_lines()
    td1_lines = build_td1_lines()
    render_mrz_ocrb(td3_lines, td3)
    render_mrz_ocrb(td1_lines, td1)
    meta = {
        "td3": str(td3),
        "td1": str(td1),
        "td3_lines": td3_lines,
        "td1_lines": td1_lines,
        "expected_td3": EXPECTED_TD3,
        "expected_td1": EXPECTED_TD1,
    }
    (out_dir / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(json.dumps({"ok": True, "td3": str(td3), "td1": str(td1)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
