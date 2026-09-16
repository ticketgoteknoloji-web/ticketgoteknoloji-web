"""Passport / TD3 dedicated MRZ image pipeline (visual-zone OCR is never the MRZ source)."""

from __future__ import annotations

import cv2
import numpy as np

from app.ocr.preprocess import (
    adaptive_threshold,
    apply_clahe,
    enhance_contrast,
    estimate_skew_angle,
    normalize_contrast,
    otsu_threshold,
    perspective_correct_if_possible,
    sharpen,
    to_grayscale,
)


def rotate_bgr(image: np.ndarray, degrees: int) -> np.ndarray:
    """Rotate by 0/90/180/270 clockwise."""
    d = degrees % 360
    if d == 0:
        return image
    if d == 90:
        return cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)
    if d == 180:
        return cv2.rotate(image, cv2.ROTATE_180)
    if d == 270:
        return cv2.rotate(image, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return image


def orientation_candidates(image: np.ndarray) -> list[tuple[str, np.ndarray]]:
    """EXIF is applied upstream; still evaluate 4 upright candidates for MRZ."""
    out: list[tuple[str, np.ndarray]] = []
    for deg in (0, 90, 180, 270):
        out.append((f"rot{deg}", rotate_bgr(image, deg)))
    return out


def _crop_box(image: np.ndarray, y0: int, y1: int, x0: int, x1: int) -> np.ndarray | None:
    h, w = image.shape[:2]
    y0 = max(0, min(h - 1, y0))
    y1 = max(y0 + 1, min(h, y1))
    x0 = max(0, min(w - 1, x0))
    x1 = max(x0 + 1, min(w, x1))
    if y1 - y0 < 12 or x1 - x0 < 40:
        return None
    return image[y0:y1, x0:x1].copy()


def _detect_mrz_band_box(image: np.ndarray) -> tuple[int, int, int, int] | None:
    """
    Locate the lowest dense two-line text band in the bottom of the page.
    Returns (y0, y1, x0, x1) in full-image coordinates.
    """
    h, w = image.shape[:2]
    if h < 40 or w < 80:
        return None
    gray = to_grayscale(image)
    # Search only the lowest ~40% — TD3 is at the very bottom of a passport page.
    y_search0 = int(h * 0.60)
    roi = gray[y_search0:h, :]
    blur = cv2.GaussianBlur(roi, (3, 3), 0)
    bw = cv2.adaptiveThreshold(
        blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 10
    )
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(32, w // 24), 2))
    bw = cv2.morphologyEx(bw, cv2.MORPH_CLOSE, kernel)
    projection = bw.sum(axis=1).astype(np.float64)
    if projection.max() <= 0:
        return None
    k = max(3, (len(projection) // 24) | 1)
    smooth = np.convolve(projection, np.ones(k) / k, mode="same")
    mask = smooth >= (smooth.max() * 0.20)
    if not mask.any():
        return None
    indices = np.where(mask)[0]
    segments: list[tuple[int, int]] = []
    start = prev = int(indices[0])
    for idx in indices[1:]:
        i = int(idx)
        if i == prev + 1:
            prev = i
            continue
        segments.append((start, prev))
        start = prev = i
    segments.append((start, prev))

    min_band = max(20, int(h * 0.025))
    max_band = max(100, int(h * 0.24))
    scored: list[tuple[int, int, int]] = []
    for a, b in segments:
        height = b - a + 1
        if height < min_band:
            continue
        if height > max_band:
            a = b - max_band + 1
        scored.append((a, b, b))
    if not scored:
        return None
    a, b, _ = max(scored, key=lambda t: (t[2], t[1] - t[0]))
    y0 = y_search0 + a
    y1 = y_search0 + b + 1
    x0 = int(w * 0.012)
    x1 = int(w * 0.988)
    # Guarantee height for two OCR-B rows (~2.3 glyph heights), growing upward.
    char_h = max(14, int((x1 - x0) / 44.0 * 1.25))
    need = max(min_band, int(char_h * 2.35))
    if (y1 - y0) < need:
        y0 = max(y_search0, y1 - need)
    y0 = max(0, y0)
    y1 = min(h, y1)
    return (y0, y1, x0, x1)


def prepare_fast_view(image: np.ndarray) -> np.ndarray:
    """
    One decode-time crop view for FAST OCR: grayscale + CLAHE + sharpen, optional 2x.
    Does not emit a grid of preprocess variants.
    """
    gray = to_grayscale(image)
    gray = normalize_contrast(gray)
    gray = apply_clahe(gray)
    gray = sharpen(gray)
    h, w = gray.shape[:2]
    char_w = w / 44.0
    if char_w < 16.0 and w > 40:
        scale = min(2.0, 18.0 / max(char_w, 1e-6))
        gray = cv2.resize(
            gray,
            (max(1, int(w * scale)), max(1, int(h * scale))),
            interpolation=cv2.INTER_CUBIC,
        )
    gray = _cap_width(gray, 1800)
    return _as_bgr(gray)


def _td1_energy_row_centers(image: np.ndarray, char_h: float) -> list[int] | None:
    """Find three TD1 line centers via row energy. Tries both polarities."""
    h, w = image.shape[:2]
    gray = to_grayscale(image)
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    min_gap = max(6, int(char_h * 0.55))
    scored: list[tuple[float, list[int]]] = []
    for method in (cv2.THRESH_BINARY, cv2.THRESH_BINARY_INV):
        bw = cv2.adaptiveThreshold(
            blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, method, 21, 8
        )
        energy = bw.sum(axis=1).astype(np.float64)
        if energy.max() <= 0:
            continue
        k = max(3, int(char_h * 0.40) | 1)
        smooth = np.convolve(energy, np.ones(k) / k, mode="same")
        if smooth.max() <= 0:
            continue
        thresh = smooth.max() * 0.28
        peaks: list[int] = []
        for i in range(1, h - 1):
            if smooth[i] < thresh:
                continue
            if smooth[i] < smooth[i - 1] or smooth[i] < smooth[i + 1]:
                continue
            if peaks and i - peaks[-1] < min_gap:
                if smooth[i] > smooth[peaks[-1]]:
                    peaks[-1] = i
                continue
            peaks.append(i)
        if len(peaks) < 3:
            continue
        for i in range(len(peaks) - 2):
            trio = peaks[i : i + 3]
            d0 = float(trio[1] - trio[0])
            d1 = float(trio[2] - trio[1])
            score = -abs(d0 - char_h) - abs(d1 - char_h) + float(trio[0]) * 0.002
            scored.append((score, trio))
    if not scored:
        return None
    scored.sort(key=lambda t: t[0], reverse=True)
    return scored[0][1]


def split_td1_line_crops(
    image: np.ndarray,
    *,
    char_h_ratio: float = 1.25,
    mode: str = "lower58",
) -> list[tuple[str, np.ndarray]]:
    """
    Split an ID-card MRZ crop into three TD1 rows.
    mode=energy: glyph-height rows at energy peaks (visual zone or footer margin).
    mode=lower58: skip the upper visual zone of a 35–45% crop.
    mode=full: equal thirds of the whole crop.
    """
    h, w = image.shape[:2]
    if h < 18 or w < 40:
        return []
    char_h = max(8.0, (w / 30.0) * float(char_h_ratio))
    names = ("td1_line1", "td1_line2", "td1_line3")
    if mode == "energy":
        centers = _td1_energy_row_centers(image, char_h)
        if centers is None:
            return []
        half = max(5, int(round(char_h * 0.48)))
        rows: list[tuple[str, np.ndarray]] = []
        for name, cy in zip(names, centers):
            y0 = max(0, int(cy) - half)
            y1 = min(h, int(cy) + half)
            if y1 - y0 < 6:
                continue
            rows.append((name, image[y0:y1, :]))
        return rows if len(rows) == 3 else []

    overlap = max(3, int(round(char_h * 0.18)))
    if mode == "full":
        y0, y1 = 0, h
    else:
        y0, y1 = int(h * 0.42), h
        if y1 - y0 < int(char_h * 2.4):
            y0 = max(0, h - int(char_h * 3.4))
    band_h = max(1, y1 - y0)
    third = band_h / 3.0
    rows = []
    for i, name in enumerate(names):
        a = max(0, y0 + int(i * third) - overlap)
        b = min(h, y0 + int((i + 1) * third) + overlap)
        if b - a < 6:
            continue
        rows.append((name, image[a:b, :]))
    return rows


def iter_td1_line_splits(
    image: np.ndarray,
    *,
    char_h_ratio: float = 1.25,
) -> list[tuple[str, list[tuple[str, np.ndarray]]]]:
    """FAST TD1 candidate row sets. Does not touch passport TD3 splits."""
    out: list[tuple[str, list[tuple[str, np.ndarray]]]] = []
    seen: set[tuple[int, int, int]] = set()
    for mode in ("energy", "lower58"):
        rows = split_td1_line_crops(image, char_h_ratio=char_h_ratio, mode=mode)
        if len(rows) < 3:
            continue
        key = tuple(im.shape[0] for _n, im in rows)
        if key in seen:
            continue
        seen.add(key)
        out.append((mode, rows))
    return out


def _detect_td1_mrz_band_box(image: np.ndarray) -> tuple[int, int, int, int] | None:
    """
    Locate a 3-line TD1 MRZ band in the lower half of an ID card.
    Separate from the passport TD3 two-line detector — do not reuse that crop.
    Returns (y0, y1, x0, x1) in full-image coordinates.
    """
    h, w = image.shape[:2]
    if h < 40 or w < 80:
        return None
    gray = to_grayscale(image)
    y_search0 = int(h * 0.50)
    roi = gray[y_search0:h, :]
    blur = cv2.GaussianBlur(roi, (3, 3), 0)
    bw = cv2.adaptiveThreshold(
        blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 10
    )
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(24, w // 28), 2))
    bw = cv2.morphologyEx(bw, cv2.MORPH_CLOSE, kernel)
    projection = bw.sum(axis=1).astype(np.float64)
    if projection.max() <= 0:
        return None
    k = max(3, (len(projection) // 20) | 1)
    smooth = np.convolve(projection, np.ones(k) / k, mode="same")
    mask = smooth >= (smooth.max() * 0.18)
    if not mask.any():
        return None
    indices = np.where(mask)[0]
    segments: list[tuple[int, int]] = []
    start = prev = int(indices[0])
    for idx in indices[1:]:
        i = int(idx)
        if i == prev + 1:
            prev = i
            continue
        segments.append((start, prev))
        start = prev = i
    segments.append((start, prev))

    min_band = max(32, int(h * 0.06))
    max_band = max(120, int(h * 0.45))
    scored: list[tuple[int, int, int]] = []
    for a, b in segments:
        height = b - a + 1
        if height < min_band:
            continue
        if height > max_band:
            a = b - max_band + 1
        scored.append((a, b, b))
    if not scored:
        return None
    a, b, _ = max(scored, key=lambda t: (t[2], t[1] - t[0]))
    y0 = y_search0 + a
    y1 = y_search0 + b + 1
    x0 = int(w * 0.012)
    x1 = int(w * 0.988)
    char_h = max(12, int((x1 - x0) / 30.0 * 1.25))
    need = max(min_band, int(char_h * 3.45))
    if (y1 - y0) < need:
        y0 = max(int(h * 0.55), y1 - need)
        y0 = max(y_search0, y0)
    y0 = max(0, y0)
    y1 = min(h, y1)
    if y1 - y0 < min_band:
        return None
    return (y0, y1, x0, x1)


def is_tight_td1_crop(image: np.ndarray) -> bool:
    """True when the crop is roughly three OCR-B TD1 rows."""
    h, w = image.shape[:2]
    if h < 12 or w < 40:
        return False
    three_line = (w / 30.0) * 1.25 * 3.5
    return h <= three_line * 1.7


def fast_id_rois(image: np.ndarray) -> list[tuple[str, np.ndarray]]:
    """
    FAST TD1 only: bottom ~35–45% plus a 3-line MRZ band.
    Never the full page. Never uses the passport TD3 two-line crop.
    """
    h, w = image.shape[:2]
    x0 = int(w * 0.008)
    x1 = int(w * 0.992)
    regions: list[tuple[str, np.ndarray]] = []
    seen: set[tuple[int, int, int, int]] = set()

    def add(name: str, y0: int, y1: int, xa: int, xb: int) -> None:
        key = (y0, y1, xa, xb)
        if key in seen:
            return
        crop = _crop_box(image, y0, y1, xa, xb)
        if crop is None:
            return
        seen.add(key)
        regions.append((name, crop))

    for name, top_frac in (
        ("bottom_35", 0.65),
        ("bottom_40", 0.60),
        ("bottom_45", 0.55),
        ("bottom_28", 0.72),
        ("bottom_22", 0.78),
    ):
        add(name, int(h * top_frac), h, x0, x1)

    box = _detect_td1_mrz_band_box(image)
    if box is not None:
        y0, y1, xa, xb = box
        # Ignore mid-page bands that miss the card foot (table photos).
        if y1 >= int(h * 0.78):
            add("mrz_band", y0, y1, xa, xb)

    rank = {
        "bottom_35": 0,
        "bottom_40": 1,
        "bottom_45": 2,
        "mrz_band": 3,
        "bottom_28": 4,
        "bottom_22": 5,
    }
    regions.sort(key=lambda x: rank.get(x[0], 9))
    return regions


def cap_long_edge(image: np.ndarray, max_edge: int = 2000) -> np.ndarray:
    """Downscale huge pages so FAST OCR stays cheap. Does not upscale."""
    h, w = image.shape[:2]
    long_edge = max(h, w)
    if long_edge <= max_edge or long_edge < 2:
        return image
    scale = max_edge / float(long_edge)
    return cv2.resize(
        image,
        (max(1, int(w * scale)), max(1, int(h * scale))),
        interpolation=cv2.INTER_AREA,
    )


def fast_passport_rois(image: np.ndarray) -> list[tuple[str, np.ndarray]]:
    """
    FAST path only: bottom 30–45% plus detected MRZ band. Never the full page.
    Never includes the full visual page.
    """
    h, w = image.shape[:2]
    x0 = int(w * 0.008)
    x1 = int(w * 0.992)
    regions: list[tuple[str, np.ndarray]] = []
    seen: set[tuple[int, int, int, int]] = set()

    def add(name: str, y0: int, y1: int, xa: int, xb: int) -> None:
        key = (y0, y1, xa, xb)
        if key in seen:
            return
        crop = _crop_box(image, y0, y1, xa, xb)
        if crop is None:
            return
        seen.add(key)
        regions.append((name, crop))

    box = _detect_mrz_band_box(image)
    if box is not None:
        y0, y1, xa, xb = box
        add("mrz_band", y0, y1, xa, xb)

    # Tightest bottom band first (MRZ sits at the page foot), then 35–45%.
    for name, top_frac in (
        ("bottom_22", 0.78),
        ("bottom_25", 0.75),
        ("bottom_30", 0.70),
        ("bottom_40", 0.60),
        ("bottom_35", 0.65),
        ("bottom_45", 0.55),
    ):
        add(name, int(h * top_frac), h, x0, x1)

    rank = {
        "bottom_22": 0,
        "bottom_25": 1,
        "bottom_30": 2,
        "bottom_40": 3,
        "bottom_35": 4,
        "bottom_45": 5,
        "mrz_band": 6,
    }
    regions.sort(key=lambda x: rank.get(x[0], 9))
    return regions


def passport_td3_rois(image: np.ndarray) -> list[tuple[str, np.ndarray]]:
    """
    TD3 ROI candidates. Does not invent MRZ text; crops only.
    Required bands: bottom 30/35/40/45/50% and full image.
    Tight detected MRZ band is an extra candidate when found.
    """
    h, w = image.shape[:2]
    x0 = int(w * 0.008)
    x1 = int(w * 0.992)
    regions: list[tuple[str, np.ndarray]] = []
    seen: set[tuple[int, int, int, int]] = set()

    def add(name: str, y0: int, y1: int, xa: int, xb: int) -> None:
        key = (y0, y1, xa, xb)
        if key in seen:
            return
        crop = _crop_box(image, y0, y1, xa, xb)
        if crop is None:
            return
        seen.add(key)
        regions.append((name, crop))

    # Lowest fractions first (MRZ sits at the bottom of a passport page).
    for name, top_frac in (
        ("bottom_30", 0.70),
        ("bottom_35", 0.65),
        ("bottom_40", 0.60),
        ("bottom_45", 0.55),
        ("bottom_50", 0.50),
    ):
        add(name, int(h * top_frac), h, x0, x1)

    add("full", 0, h, 0, w)

    box = _detect_mrz_band_box(image)
    if box is not None:
        y0, y1, xa, xb = box
        add("mrz_band", y0, y1, xa, xb)
        pad = max(6, int((y1 - y0) * 0.20))
        add("mrz_band_pad", y0 - pad, y1 + pad, xa, xb)

    return regions


def passport_bottom_regions(image: np.ndarray) -> list[tuple[str, np.ndarray]]:
    """Backward-compatible alias — passport TD3 ROI set."""
    return passport_td3_rois(image)


def _detect_mrz_band_lower_half(image: np.ndarray) -> np.ndarray | None:
    box = _detect_mrz_band_box(image)
    if box is None:
        return None
    y0, y1, x0, x1 = box
    return _crop_box(image, y0, y1, x0, x1)


def split_td3_line_crops(image: np.ndarray) -> list[tuple[str, np.ndarray]]:
    """
    Split an MRZ crop into two horizontal line strips (TD3 is exactly 2 rows).
    Used so recognition-only OCR can read each 44-char line independently.
    """
    h, w = image.shape[:2]
    if h < 12 or w < 40:
        return []
    gray = to_grayscale(image)
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    bw = cv2.adaptiveThreshold(
        blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 21, 8
    )
    energy = bw.sum(axis=1).astype(np.float64)
    strips: list[tuple[str, np.ndarray]] = []
    if energy.max() > 0:
        k = max(3, (h // 12) | 1)
        smooth = np.convolve(energy, np.ones(k) / k, mode="same")
        search0 = max(1, int(h * 0.18))
        search1 = min(h - 1, int(h * 0.82))
        if search1 > search0:
            valley = search0 + int(np.argmin(smooth[search0:search1]))
            pad = max(2, h // 18)
            top = image[0 : min(h, valley + pad), :]
            bot = image[max(0, valley - pad) : h, :]
            if top.shape[0] >= 8 and bot.shape[0] >= 8:
                strips.append(("td3_line1", top))
                strips.append(("td3_line2", bot))
    if not strips:
        mid = h // 2
        overlap = max(2, h // 16)
        strips.append(("td3_line1", image[0 : min(h, mid + overlap), :]))
        strips.append(("td3_line2", image[max(0, mid - overlap) : h, :]))
    return strips


def deskew_mrz_crop(image: np.ndarray) -> np.ndarray:
    """
    Deskew MRZ crop before OCR. Only apply small angles (~-10..+10).
    Always runs estimate; identity if angle is negligible.
    """
    gray = to_grayscale(image)
    angle = estimate_skew_angle(gray)
    if abs(angle) < 0.2:
        return image
    # Clamp to small passport MRZ skew only
    angle = float(max(-10.0, min(10.0, angle)))
    if abs(angle) < 0.2:
        return image
    h, w = gray.shape[:2]
    matrix = cv2.getRotationMatrix2D((w / 2.0, h / 2.0), angle, 1.0)
    if image.ndim == 2:
        return cv2.warpAffine(image, matrix, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    return cv2.warpAffine(image, matrix, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def _upscale(gray: np.ndarray, scale: float) -> np.ndarray:
    if scale <= 1.01:
        return gray
    h, w = gray.shape[:2]
    return cv2.resize(gray, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)


def _as_bgr(gray: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)


def _invert(gray: np.ndarray) -> np.ndarray:
    return cv2.bitwise_not(gray)


def _ocr_scales(image: np.ndarray, *, chars_per_line: int = 44) -> list[tuple[float, str]]:
    """Pick 1–2 upscale factors from glyph width. Avoid huge 3x on phone photos."""
    w = int(image.shape[1])
    n = max(int(chars_per_line), 8)
    char_w = w / float(n)
    if char_w >= 24:
        return [(1.0, "1x"), (1.35, "1p3x")]
    if char_w >= 16:
        return [(1.5, "1p5x"), (2.0, "2x")]
    return [(2.0, "2x"), (3.0, "3x")]


def _cap_width(image: np.ndarray, max_w: int = 2200) -> np.ndarray:
    h, w = image.shape[:2]
    if w <= max_w:
        return image
    scale = max_w / float(w)
    return cv2.resize(image, (max_w, max(1, int(h * scale))), interpolation=cv2.INTER_AREA)


def is_tight_mrz_crop(image: np.ndarray) -> bool:
    """True when the crop is roughly two OCR-B rows (safe for rec-only split)."""
    h, w = image.shape[:2]
    if h < 8 or w < 40:
        return False
    two_line = (w / 44.0) * 1.25 * 2.7
    return h <= two_line * 1.85


def build_passport_mrz_variants(
    image: np.ndarray,
    *,
    chars_per_line: int = 44,
) -> list[tuple[str, np.ndarray]]:
    """
    Per-ROI preprocess variants for TD3 OCR:
    grayscale, CLAHE, contrast, sharpen, adaptive, Otsu, invert, 2x/3x.
    Deskew/perspective are applied by the caller; this function does not
    invent MRZ characters.
    chars_per_line=44 is the passport default. TD1 callers pass 30.
    """
    gray = to_grayscale(image)
    gray = normalize_contrast(gray)
    clahe = apply_clahe(gray)
    contrast = enhance_contrast(clahe)
    sharp = sharpen(clahe)
    adaptive = adaptive_threshold(clahe, block=31, c=8)
    otsu = otsu_threshold(sharp)

    bases: list[tuple[str, np.ndarray]] = [
        ("gray", gray),
        ("clahe", clahe),
        ("contrast", contrast),
        ("sharpen", sharp),
        ("adaptive", adaptive),
        ("otsu", otsu),
        ("adaptive_inv", _invert(adaptive)),
        ("otsu_inv", _invert(otsu)),
        ("clahe_sharp", sharp),
    ]

    variants: list[tuple[str, np.ndarray]] = []
    for scale, tag in _ocr_scales(image, chars_per_line=chars_per_line):
        for base_name, base in bases:
            scaled = _cap_width(_upscale(base, scale))
            variants.append((f"{base_name}_{tag}", _as_bgr(scaled)))

    seen: set[str] = set()
    unique: list[tuple[str, np.ndarray]] = []
    # Prefer contrast-enhanced / thresholded views first (better for OCR-B '<').
    preferred = (
        "clahe_sharp_2x",
        "clahe_sharp_1p5x",
        "clahe_sharp_1x",
        "adaptive_2x",
        "adaptive_1p5x",
        "otsu_2x",
        "otsu_1p5x",
        "contrast_2x",
        "contrast_1p5x",
        "gray_2x",
        "clahe_2x",
        "sharpen_2x",
        "adaptive_inv_2x",
        "otsu_3x",
        "clahe_sharp_3x",
        "adaptive_3x",
    )
    by_name = {n: im for n, im in variants}
    for name in preferred:
        if name in by_name and name not in seen:
            seen.add(name)
            unique.append((name, by_name[name]))
    for name, img in variants:
        if name in seen:
            continue
        seen.add(name)
        unique.append((name, img))
        if len(unique) >= 14:
            break
    return unique


def maybe_perspective(image: np.ndarray) -> np.ndarray | None:
    """Light perspective correction; None if it does not change the crop."""
    try:
        warped = perspective_correct_if_possible(image)
    except Exception:
        return None
    if warped is None or warped.size == 0:
        return None
    if warped.shape != image.shape:
        return warped
    sample = cv2.absdiff(warped, image)
    if float(sample.mean()) < 1.0:
        return None
    return warped
