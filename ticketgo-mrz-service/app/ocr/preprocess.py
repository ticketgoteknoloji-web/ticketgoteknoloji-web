"""Image preprocessing variants for MRZ OCR."""

from __future__ import annotations

import math

import cv2
import numpy as np


def _ensure_bgr(image: np.ndarray) -> np.ndarray:
    if image.ndim == 2:
        return cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
    if image.shape[2] == 4:
        return cv2.cvtColor(image, cv2.COLOR_BGRA2BGR)
    return image


def to_grayscale(image: np.ndarray) -> np.ndarray:
    bgr = _ensure_bgr(image)
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)


def apply_clahe(gray: np.ndarray) -> np.ndarray:
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    return clahe.apply(gray)


def enhance_contrast(gray: np.ndarray) -> np.ndarray:
    return cv2.convertScaleAbs(gray, alpha=1.5, beta=8)


def normalize_contrast(gray: np.ndarray) -> np.ndarray:
    """Percentile-based contrast stretch."""
    lo, hi = np.percentile(gray, (2, 98))
    if hi <= lo:
        return gray
    scaled = np.clip((gray.astype(np.float32) - lo) * (255.0 / (hi - lo)), 0, 255)
    return scaled.astype(np.uint8)


def sharpen(gray: np.ndarray) -> np.ndarray:
    blur = cv2.GaussianBlur(gray, (0, 0), 1.0)
    return cv2.addWeighted(gray, 1.7, blur, -0.7, 0)


def adaptive_threshold(gray: np.ndarray, block: int = 31, c: int = 10) -> np.ndarray:
    block = block if block % 2 == 1 else block + 1
    return cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        block,
        c,
    )


def otsu_threshold(gray: np.ndarray) -> np.ndarray:
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    _, bw = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return bw


def estimate_skew_angle(gray: np.ndarray) -> float:
    edges = cv2.Canny(gray, 50, 150)
    lines = cv2.HoughLinesP(
        edges, 1, np.pi / 180, threshold=80, minLineLength=gray.shape[1] // 4, maxLineGap=20
    )
    if lines is None:
        return 0.0
    angles: list[float] = []
    for line in lines[:, 0]:
        x1, y1, x2, y2 = map(int, line)
        if x2 == x1:
            continue
        ang = math.degrees(math.atan2(y2 - y1, x2 - x1))
        if -45 < ang < 45:
            angles.append(ang)
    if not angles:
        return 0.0
    return float(np.median(angles))


def deskew(gray: np.ndarray) -> np.ndarray:
    angle = estimate_skew_angle(gray)
    if abs(angle) < 0.25:
        return gray
    h, w = gray.shape[:2]
    matrix = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    return cv2.warpAffine(gray, matrix, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def normalize_size(image: np.ndarray, max_side: int = 2400) -> np.ndarray:
    h, w = image.shape[:2]
    side = max(h, w)
    if side <= max_side:
        return image
    scale = max_side / float(side)
    new_w = max(1, int(w * scale))
    new_h = max(1, int(h * scale))
    return cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)


def perspective_correct_if_possible(image: np.ndarray) -> np.ndarray:
    """Attempt document quad detection; return original if not confident."""
    bgr = _ensure_bgr(image)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edged = cv2.Canny(blur, 50, 150)
    contours, _ = cv2.findContours(edged, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:8]
    h, w = gray.shape[:2]
    min_area = 0.2 * h * w
    for cnt in contours:
        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)
        if len(approx) == 4 and cv2.contourArea(approx) >= min_area:
            pts = approx.reshape(4, 2).astype(np.float32)
            s = pts.sum(axis=1)
            diff = np.diff(pts, axis=1).reshape(-1)
            ordered = np.zeros((4, 2), dtype=np.float32)
            ordered[0] = pts[np.argmin(s)]
            ordered[2] = pts[np.argmax(s)]
            ordered[1] = pts[np.argmin(diff)]
            ordered[3] = pts[np.argmax(diff)]
            width_a = np.linalg.norm(ordered[2] - ordered[3])
            width_b = np.linalg.norm(ordered[1] - ordered[0])
            height_a = np.linalg.norm(ordered[1] - ordered[2])
            height_b = np.linalg.norm(ordered[0] - ordered[3])
            max_w = int(max(width_a, width_b))
            max_h = int(max(height_a, height_b))
            if max_w < 100 or max_h < 100:
                continue
            dst = np.array(
                [[0, 0], [max_w - 1, 0], [max_w - 1, max_h - 1], [0, max_h - 1]],
                dtype=np.float32,
            )
            matrix = cv2.getPerspectiveTransform(ordered, dst)
            return cv2.warpPerspective(bgr, matrix, (max_w, max_h))
    return bgr


def build_variants(image: np.ndarray) -> list[tuple[str, np.ndarray]]:
    """
    Produce multiple preprocessed views for OCR attempts:
    perspective, deskew, grayscale, contrast normalization, adaptive threshold, upscale-ready.
    """
    bgr = _ensure_bgr(image)
    bgr = normalize_size(bgr)
    try:
        warped = perspective_correct_if_possible(bgr)
    except Exception:
        warped = bgr

    variants: list[tuple[str, np.ndarray]] = [("original", bgr)]
    if warped is not bgr:
        variants.append(("perspective", warped))

    for base_name, base in list(variants):
        gray = to_grayscale(base)
        deskewed = deskew(gray)
        stretched = normalize_contrast(deskewed)
        clahe = apply_clahe(stretched)
        contrast = enhance_contrast(clahe)
        sharp = sharpen(contrast)
        thresh = adaptive_threshold(sharp, block=31, c=8)
        thresh2 = adaptive_threshold(stretched, block=21, c=5)
        otsu = otsu_threshold(sharp)

        variants.append((f"{base_name}_gray", cv2.cvtColor(deskewed, cv2.COLOR_GRAY2BGR)))
        variants.append((f"{base_name}_contrast", cv2.cvtColor(contrast, cv2.COLOR_GRAY2BGR)))
        variants.append((f"{base_name}_sharp", cv2.cvtColor(sharp, cv2.COLOR_GRAY2BGR)))
        variants.append((f"{base_name}_thresh", cv2.cvtColor(thresh, cv2.COLOR_GRAY2BGR)))
        variants.append((f"{base_name}_thresh2", cv2.cvtColor(thresh2, cv2.COLOR_GRAY2BGR)))
        variants.append((f"{base_name}_otsu", cv2.cvtColor(otsu, cv2.COLOR_GRAY2BGR)))

    seen: set[str] = set()
    unique: list[tuple[str, np.ndarray]] = []
    for name, img in variants:
        if name in seen:
            continue
        seen.add(name)
        unique.append((name, img))
        if len(unique) >= 12:
            break
    return unique
