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


def passport_bottom_regions(image: np.ndarray) -> list[tuple[str, np.ndarray]]:
    """
    Bottom-band crops only — never use the upper visual zone as an MRZ source.
    Fractions: 35%, 40%, 45%, 50% plus projection band inside lower half.
    """
    h, w = image.shape[:2]
    regions: list[tuple[str, np.ndarray]] = []
    for name, frac in (
        ("bottom_35", 0.35),
        ("bottom_40", 0.40),
        ("bottom_45", 0.45),
        ("bottom_50", 0.50),
    ):
        y0 = max(0, int(h * (1.0 - frac)))
        crop = image[y0:h, 0:w]
        if crop.size > 0 and crop.shape[0] >= 20:
            regions.append((name, crop))

    band = _detect_mrz_band_lower_half(image)
    if band is not None and band.size > 0:
        regions.insert(0, ("mrz_band", band))

    # Slight inset on bottom 40% (card edges / shadows)
    y0 = int(h * 0.60)
    x0 = int(w * 0.02)
    x1 = int(w * 0.98)
    if x1 > x0 and h - y0 >= 20:
        regions.append(("bottom_40_inset", image[y0:h, x0:x1]))

    return regions


def _detect_mrz_band_lower_half(image: np.ndarray) -> np.ndarray | None:
    h, w = image.shape[:2]
    if h < 40 or w < 80:
        return None
    gray = to_grayscale(image)
    # Strictly lower half — ignore upper visual text
    y_search0 = int(h * 0.50)
    roi = gray[y_search0:h, :]
    blur = cv2.GaussianBlur(roi, (3, 3), 0)
    bw = cv2.adaptiveThreshold(
        blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 10
    )
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(20, w // 35), 3))
    bw = cv2.morphologyEx(bw, cv2.MORPH_CLOSE, kernel)
    projection = bw.sum(axis=1).astype(np.float64)
    if projection.max() <= 0:
        return None
    k = max(3, (len(projection) // 30) | 1)
    smooth = np.convolve(projection, np.ones(k) / k, mode="same")
    mask = smooth >= (smooth.max() * 0.30)
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

    min_band = max(24, int(h * 0.035))
    max_band = int(h * 0.28)
    scored: list[tuple[int, int, int]] = []
    for a, b in segments:
        height = b - a + 1
        if height < min_band:
            continue
        if height > max_band:
            a = b - max_band + 1
        scored.append((a, b, b))  # prefer lowest band
    if not scored:
        return None
    a, b, _ = max(scored, key=lambda t: (t[2], t[1] - t[0]))
    pad = max(6, int(0.015 * h))
    y0 = max(0, y_search0 + a - pad)
    y1 = min(h, y_search0 + b + pad)
    x0 = int(w * 0.015)
    x1 = int(w * 0.985)
    if y1 - y0 < min_band:
        return None
    return image[y0:y1, x0:x1].copy()


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


def _denoise(gray: np.ndarray) -> np.ndarray:
    return cv2.fastNlMeansDenoising(gray, None, h=8, templateWindowSize=7, searchWindowSize=21)


def _as_bgr(gray: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)


def build_passport_mrz_variants(image: np.ndarray) -> list[tuple[str, np.ndarray]]:
    """
    Passport MRZ-only preprocessing variants (A/B/C/D + invert).
    Input must already be a bottom/MRZ crop and deskewed.
    """
    gray0 = to_grayscale(image)
    variants: list[tuple[str, np.ndarray]] = []

    # A) grayscale + 2x upscale + contrast
    a = _upscale(gray0, 2.0)
    a = enhance_contrast(normalize_contrast(a))
    variants.append(("A_contrast_2x", _as_bgr(a)))

    # B) grayscale + 3x upscale + adaptive threshold
    b = _upscale(gray0, 3.0)
    b = adaptive_threshold(normalize_contrast(b), block=31, c=8)
    variants.append(("B_adaptive_3x", _as_bgr(b)))

    # C) CLAHE + sharpen + threshold
    c = apply_clahe(normalize_contrast(gray0))
    c = sharpen(c)
    c = _upscale(c, 2.0)
    c_th = adaptive_threshold(c, block=25, c=7)
    variants.append(("C_clahe_sharp", _as_bgr(c)))
    variants.append(("C_clahe_thresh", _as_bgr(c_th)))

    # D) denoise + upscale + Otsu
    try:
        d = _denoise(gray0)
    except Exception:
        d = cv2.GaussianBlur(gray0, (3, 3), 0)
    d = _upscale(d, 2.5)
    d = otsu_threshold(d)
    variants.append(("D_denoise_otsu", _as_bgr(d)))

    # Invert of strongest binary variants (white-on-black MRZ prints)
    for name in ("B_adaptive_3x", "C_clahe_thresh", "D_denoise_otsu"):
        for n, img in list(variants):
            if n == name:
                inv = cv2.bitwise_not(to_grayscale(img))
                variants.append((f"{name}_inv", _as_bgr(inv)))
                break

    # Also keep a mild gray 2x without threshold (helps Paddle on clean scans)
    mild = _upscale(normalize_contrast(gray0), 2.0)
    variants.append(("gray_2x", _as_bgr(mild)))

    seen: set[str] = set()
    unique: list[tuple[str, np.ndarray]] = []
    for name, img in variants:
        if name in seen:
            continue
        seen.add(name)
        unique.append((name, img))
    return unique
