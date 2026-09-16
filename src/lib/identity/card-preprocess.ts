import 'server-only';

import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';

export type CardPreprocessMeta = {
  cardDetected: boolean;
  perspectiveFixed: boolean;
  cardCropped: boolean;
  width: number;
  height: number;
  areaRatio: number;
};

const STANDARD_WIDTH = 1000;

/**
 * Detect ID card content, drop background, force landscape, standardize to width=1000.
 * True 4-point homography needs OpenCV; here we use tight content bbox +
 * EXIF orientation + landscape normalize.
 */
export async function preprocessTcIdCard(imageBytes: Buffer): Promise<{
  cardJpeg: Buffer;
  originalJpeg: Buffer;
  detectedJpeg: Buffer | null;
  meta: CardPreprocessMeta;
}> {
  const rotated = await sharp(imageBytes).rotate().toBuffer({ resolveWithObject: true });
  const originalJpeg = await sharp(rotated.data).jpeg({ quality: 92 }).toBuffer();
  let working = rotated.data;
  let w = rotated.info.width || 1;
  let h = rotated.info.height || 1;
  let perspectiveFixed = true;
  let cardCropped = false;
  let cardDetected = false;
  let areaRatio = 1;
  let detectedJpeg: Buffer | null = null;

  const gray = await sharp(working).grayscale().normalize().raw().toBuffer({ resolveWithObject: true });
  const gw = gray.info.width;
  const gh = gray.info.height;
  const data = gray.data;

  const threshold = 242;
  let minX = gw;
  let minY = gh;
  let maxX = 0;
  let maxY = 0;
  let hits = 0;
  for (let y = 0; y < gh; y += 2) {
    for (let x = 0; x < gw; x += 2) {
      if (data[y * gw + x] < threshold) {
        hits++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  areaRatio = hits > 0 ? ((maxX - minX) * (maxY - minY)) / (gw * gh) : 1;
  if (hits > 150 && areaRatio > 0.08 && areaRatio < 0.92) {
    const padX = Math.floor((maxX - minX) * 0.02);
    const padY = Math.floor((maxY - minY) * 0.02);
    const left = Math.max(0, minX - padX);
    const top = Math.max(0, minY - padY);
    const width = Math.min(gw - left, maxX - minX + 1 + padX * 2);
    const height = Math.min(gh - top, maxY - minY + 1 + padY * 2);
    if (width > 40 && height > 40) {
      const extracted = await sharp(working)
        .extract({ left, top, width, height })
        .toBuffer({ resolveWithObject: true });
      working = extracted.data;
      w = extracted.info.width || width;
      h = extracted.info.height || height;
      cardCropped = left > 2 || top > 2 || width < gw - 2 || height < gh - 2;
      cardDetected = true;
      detectedJpeg = await sharp(working).jpeg({ quality: 90 }).toBuffer();
    }
  }

  if (h > w * 1.05) {
    const flipped = await sharp(working).rotate(90).toBuffer({ resolveWithObject: true });
    working = flipped.data;
    w = flipped.info.width || h;
    h = flipped.info.height || w;
    perspectiveFixed = true;
  }

  // Standard template size: width=1000, height keeps card aspect (no stretch).
  const targetH = Math.max(1, Math.round((STANDARD_WIDTH * h) / w));
  const resized = await sharp(working)
    .resize({
      width: STANDARD_WIDTH,
      height: targetH,
      fit: 'fill',
      kernel: sharp.kernel.lanczos3,
    })
    .jpeg({ quality: 95 })
    .toBuffer({ resolveWithObject: true });

  return {
    cardJpeg: resized.data,
    originalJpeg,
    detectedJpeg,
    meta: {
      cardDetected: cardDetected || cardCropped,
      perspectiveFixed,
      cardCropped,
      width: resized.info.width || STANDARD_WIDTH,
      height: resized.info.height || targetH,
      areaRatio,
    },
  };
}

/**
 * Calibrated from live TSV anchors on a warped T.C. kimlik ön yüz (1000×~631):
 * TC=13208986748 @ (66,157), GORAL @ (354,259), MURAT @ (358,351),
 * 15.12.1999 @ (361,426), E/M @ (627,422).
 * ROIs target VALUE bands only (not labels alone).
 */
export const TC_FIELD_ROIS = {
  tcNo: { left: 0.03, top: 0.22, width: 0.32, height: 0.12 },
  soyad: { left: 0.33, top: 0.40, width: 0.42, height: 0.11 },
  ad: { left: 0.33, top: 0.53, width: 0.42, height: 0.10 },
  dogumTarihi: { left: 0.33, top: 0.65, width: 0.26, height: 0.13 },
  cinsiyet: { left: 0.58, top: 0.64, width: 0.16, height: 0.11 },
} as const;

export type FieldRoiKey = keyof typeof TC_FIELD_ROIS;

export function roiPixelBox(cardW: number, cardH: number, key: FieldRoiKey) {
  const roi = TC_FIELD_ROIS[key];
  const left = Math.min(Math.floor(cardW * roi.left), Math.max(0, cardW - 16));
  const top = Math.min(Math.floor(cardH * roi.top), Math.max(0, cardH - 16));
  const width = Math.min(Math.max(16, Math.floor(cardW * roi.width)), cardW - left);
  const height = Math.min(Math.max(16, Math.floor(cardH * roi.height)), cardH - top);
  return { left, top, width, height };
}

/** Raw ROI crop (no filter) — variants applied later. */
export async function cropFieldRoiRaw(
  cardJpeg: Buffer,
  cardW: number,
  cardH: number,
  key: FieldRoiKey,
): Promise<Buffer> {
  const box = roiPixelBox(cardW, cardH, key);
  return sharp(cardJpeg).extract(box).jpeg({ quality: 95 }).toBuffer();
}

export async function writeTcIdDebugImages(opts: {
  originalJpeg: Buffer;
  detectedJpeg: Buffer | null;
  cardJpeg: Buffer;
  cardW: number;
  cardH: number;
}): Promise<string> {
  const dir = path.join(os.tmpdir(), 'tc-id-debug');
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(dir, 'debug-original.jpg'), opts.originalJpeg);
  await fs.promises.writeFile(
    path.join(dir, 'debug-card-detected.jpg'),
    opts.detectedJpeg || opts.cardJpeg,
  );
  await fs.promises.writeFile(path.join(dir, 'debug-card-warped.jpg'), opts.cardJpeg);

  const map: Record<FieldRoiKey, string> = {
    tcNo: 'debug-tc-no.jpg',
    soyad: 'debug-surname.jpg',
    ad: 'debug-name.jpg',
    dogumTarihi: 'debug-dob.jpg',
    cinsiyet: 'debug-gender.jpg',
  };
  for (const key of Object.keys(map) as FieldRoiKey[]) {
    const crop = await cropFieldRoiRaw(opts.cardJpeg, opts.cardW, opts.cardH, key);
    await fs.promises.writeFile(path.join(dir, map[key]), crop);
  }
  return dir;
}
