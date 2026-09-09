"""MRZ region heuristics — bottom bands + projection-based MRZ crop + upscale."""

from __future__ import annotations

import cv2
import numpy as np


def detect_mrz_band(image: np.ndarray) -> np.ndarray | None:
    """
    Detect a dense horizontal text band (typical MRZ) via horizontal projection.
    Returns a cropped BGR band or None.
    """
    h, w = image.shape[:2]
    if h < 40 or w < 80:
        return None

    if image.ndim == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image

    # Focus search on lower 55% of the document
    y_search0 = int(h * 0.45)
    roi = gray[y_search0:h, :]
    blur = cv2.GaussianBlur(roi, (3, 3), 0)
    bw = cv2.adaptiveThreshold(
        blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 10
    )
    # Emphasize horizontal runs (MRZ characters)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(15, w // 40), 2))
    bw = cv2.morphologyEx(bw, cv2.MORPH_CLOSE, kernel)

    projection = bw.sum(axis=1).astype(np.float64)
    if projection.max() <= 0:
        return None

    # Smooth projection
    k = max(3, (len(projection) // 40) | 1)
    kernel_1d = np.ones(k, dtype=np.float64) / k
    smooth = np.convolve(projection, kernel_1d, mode="same")
    thresh = smooth.max() * 0.35
    mask = smooth >= thresh
    if not mask.any():
        return None

    # Take the lowest contiguous high-energy region (MRZ is at bottom)
    indices = np.where(mask)[0]
    # Split into contiguous segments
    segments: list[tuple[int, int]] = []
    start = int(indices[0])
    prev = start
    for idx in indices[1:]:
        if int(idx) == prev + 1:
            prev = int(idx)
            continue
        segments.append((start, prev))
        start = int(idx)
        prev = start
    segments.append((start, prev))

    # Prefer segment closest to bottom with enough height for 2–3 MRZ lines
    min_band = max(28, int(h * 0.04))
    max_band = int(h * 0.35)
    candidates = []
    for a, b in segments:
        height = b - a + 1
        if height < min_band:
            continue
        if height > max_band:
            # keep bottom portion of oversized band
            a = b - max_band + 1
            height = b - a + 1
        candidates.append((a, b, height))
    if not candidates:
        return None

    a, b, _ = max(candidates, key=lambda t: (t[1], t[2]))  # lowest end, then taller
    # Add padding and map back to full image coordinates
    pad = max(8, int(0.02 * h))
    y0 = max(0, y_search0 + a - pad)
    y1 = min(h, y_search0 + b + pad)
    x0 = int(w * 0.02)
    x1 = int(w * 0.98)
    if y1 - y0 < min_band or x1 <= x0:
        return None
    return image[y0:y1, x0:x1].copy()


def crop_regions(image: np.ndarray) -> list[tuple[str, np.ndarray]]:
    """
    Return image regions likely to contain MRZ.
    Always includes full image, bottom bands, and detected MRZ crop when found.
    """
    h, w = image.shape[:2]
    regions: list[tuple[str, np.ndarray]] = [("full", image)]

    mrz_band = detect_mrz_band(image)
    if mrz_band is not None and mrz_band.size > 0:
        regions.append(("mrz_band", mrz_band))

    y0 = int(h * 0.65)
    regions.append(("bottom_35", image[y0:h, 0:w]))

    y1 = int(h * 0.55)
    regions.append(("bottom_45", image[y1:h, 0:w]))

    y2 = int(h * 0.50)
    y3 = int(h * 0.95)
    if y3 > y2:
        regions.append(("mid_bottom", image[y2:y3, 0:w]))

    x0 = int(w * 0.03)
    x1 = int(w * 0.97)
    if x1 > x0:
        regions.append(("bottom_35_inset", image[y0:h, x0:x1]))

    return regions


def upscale_if_small(image: np.ndarray, min_width: int = 1200) -> np.ndarray:
    """Upscale narrow crops so MRZ glyphs are large enough for OCR."""
    h, w = image.shape[:2]
    target_w = min_width
    # Also ensure per-character width ~>= 18px for 44-char TD3
    if w < target_w:
        scale = target_w / float(w)
        return cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)
    return image


def upscale_mrz_band(image: np.ndarray, min_char_width: float = 22.0) -> np.ndarray:
    """Force upscale assuming ~44 MRZ characters across the width."""
    h, w = image.shape[:2]
    assumed_chars = 44.0
    char_w = w / assumed_chars
    if char_w >= min_char_width:
        return image
    scale = min_char_width / max(char_w, 1e-6)
    scale = min(scale, 4.0)
    return cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)
