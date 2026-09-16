import 'server-only';

import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import sharp from 'sharp';
import { createWorker, type Worker } from 'tesseract.js';
import {
  cropFieldRoiRaw,
  preprocessTcIdCard,
  writeTcIdDebugImages,
  type CardPreprocessMeta,
  type FieldRoiKey,
  TC_FIELD_ROIS,
} from '@/lib/identity/card-preprocess';

const execFileAsync = promisify(execFile);

/** Relative crops on a normalized landscape card (photo left, fields right). */
const FIELD_CROPS = {
  /** Top text column — T.C. Kimlik No */
  tc: { left: 0.3, top: 0.04, width: 0.55, height: 0.2 },
  /** Birth date band */
  dob: { left: 0.3, top: 0.42, width: 0.45, height: 0.16 },
  /** Name band (soyad + ad) */
  name: { left: 0.3, top: 0.18, width: 0.62, height: 0.28 },
  /** Gender */
  gender: { left: 0.3, top: 0.55, width: 0.35, height: 0.14 },
  /** Alternate TC near top-left header */
  tcAlt: { left: 0.02, top: 0.02, width: 0.45, height: 0.22 },
} as const;

const NATIVE_CANDIDATES = [
  process.env.TESSERACT_PATH,
  'C:\\Program Files\\Tesseract-OCR\\tesseract.exe',
  'C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe',
  'tesseract',
].filter(Boolean) as string[];

let nativePath: string | null | undefined;
let workerPromise: Promise<Worker> | null = null;
let langsCached: string | null = null;

function resolveNative(): string | null {
  if (nativePath !== undefined) return nativePath;
  for (const candidate of NATIVE_CANDIDATES) {
    if (candidate === 'tesseract') {
      nativePath = candidate;
      return nativePath;
    }
    if (fs.existsSync(candidate)) {
      nativePath = candidate;
      return nativePath;
    }
  }
  nativePath = null;
  return null;
}

function resolveTessdata(): string {
  const candidates = [
    path.join(process.cwd(), 'assets', 'tessdata'),
    path.join(process.cwd(), 'node_modules', 'tesseract.js', 'tessdata'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'eng.traineddata'))) return dir;
  }
  throw new Error('eng.traineddata not found');
}

async function getJsWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const langPath = resolveTessdata();
      const worker = await createWorker('eng', 1, {
        langPath,
        cachePath: langPath,
        gzip: false,
      });
      await worker.setParameters({
        tessedit_pageseg_mode: '6' as unknown as never,
        preserve_interword_spaces: '1',
      });
      return worker;
    })().catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

export async function warmLocalTcIdOcr(): Promise<void> {
  const tasks: Promise<unknown>[] = [getJsWorker()];
  const native = resolveNative();
  if (native) {
    tasks.push(
      execFileAsync(native, ['--version'], { timeout: 5000, windowsHide: true }).catch(() => undefined),
    );
  }
  await Promise.all(tasks);
}

async function resolveNativeLangs(): Promise<string> {
  if (langsCached) return langsCached;
  const bin = resolveNative();
  if (!bin) {
    langsCached = 'eng';
    return langsCached;
  }
  try {
    const { stdout, stderr } = await execFileAsync(bin, ['--list-langs'], {
      timeout: 5000,
      windowsHide: true,
    });
    const text = `${stdout}\n${stderr}`;
    const hasTur = /\btur\b/i.test(text);
    langsCached = hasTur ? 'tur+eng' : 'eng';
  } catch {
    langsCached = 'eng';
  }
  return langsCached;
}

type Rect = { left: number; top: number; width: number; height: number };

function clampRect(r: Rect, w: number, h: number): Rect {
  const left = Math.min(Math.max(0, Math.floor(r.left)), Math.max(0, w - 8));
  const top = Math.min(Math.max(0, Math.floor(r.top)), Math.max(0, h - 8));
  const width = Math.min(Math.max(8, Math.floor(r.width)), w - left);
  const height = Math.min(Math.max(8, Math.floor(r.height)), h - top);
  return { left, top, width, height };
}

/**
 * Detect / normalize ID card: EXIF rotate, trim borders, force landscape,
 * upscale, contrast. Best-effort without OpenCV.
 */
export async function cropAndEnhanceCard(bytes: Buffer): Promise<{ jpeg: Buffer; cropped: boolean }> {
  const base = sharp(bytes).rotate();
  const meta = await base.metadata();
  let w = meta.width || 1;
  let h = meta.height || 1;
  let img = base;
  let cropped = false;

  // Trim near-uniform background (desk) when possible.
  try {
    const trimmed = await sharp(bytes).rotate().trim({ threshold: 28 }).toBuffer({ resolveWithObject: true });
    if (
      trimmed.info.width > 80 &&
      trimmed.info.height > 80 &&
      trimmed.info.width * trimmed.info.height < w * h * 0.98
    ) {
      img = sharp(trimmed.data);
      w = trimmed.info.width;
      h = trimmed.info.height;
      cropped = true;
    }
  } catch {
    // keep original
  }

  // Prefer landscape (Turkish ID is landscape).
  if (h > w * 1.15) {
    const buf = await img.rotate(90).toBuffer({ resolveWithObject: true });
    img = sharp(buf.data);
    w = buf.info.width || h;
    h = buf.info.height || w;
    cropped = true;
  }

  // Mild center crop if very tall margins remain (photo-of-desk).
  if (w / h > 2.2) {
    const targetH = Math.floor(w / 1.586);
    if (targetH < h) {
      const top = Math.floor((h - targetH) / 2);
      img = img.extract(clampRect({ left: 0, top, width: w, height: targetH }, w, h));
      h = targetH;
      cropped = true;
    }
  } else if (w / h < 1.2) {
    // Already handled rotate; leave as-is.
  }

  const jpeg = await img
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: false })
    .normalize()
    .sharpen({ sigma: 0.8 })
    .jpeg({ quality: 92 })
    .toBuffer();

  return { jpeg, cropped };
}

async function extractRelativeCrop(cardJpeg: Buffer, rel: Rect): Promise<Buffer> {
  const { data, info } = await sharp(cardJpeg).toBuffer({ resolveWithObject: true });
  const w = info.width || 1;
  const h = info.height || 1;
  const rect = clampRect(
    {
      left: w * rel.left,
      top: h * rel.top,
      width: w * rel.width,
      height: h * rel.height,
    },
    w,
    h,
  );
  return sharp(data)
    .extract(rect)
    .resize({ width: 1000, withoutEnlargement: false })
    .grayscale()
    .normalize()
    .sharpen()
    .jpeg({ quality: 95 })
    .toBuffer();
}

async function runNative(imageJpeg: Buffer, psm: string, whitelist?: string): Promise<string> {
  const bin = resolveNative();
  if (!bin) throw new Error('native tesseract missing');
  const langs = await resolveNativeLangs();

  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'tg-ocr-'));
  const imgPath = path.join(dir, 'in.jpg');
  const outBase = path.join(dir, 'out');
  try {
    await fs.promises.writeFile(imgPath, imageJpeg);
    const args = [imgPath, outBase, '-l', langs, '--oem', '1', '--psm', psm];
    if (whitelist) {
      args.push('-c', `tessedit_char_whitelist=${whitelist}`);
    }
    await execFileAsync(bin, args, {
      timeout: 20_000,
      windowsHide: true,
      maxBuffer: 2 * 1024 * 1024,
    });
    return await fs.promises.readFile(`${outBase}.txt`, 'utf8');
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function runJsRecognize(imageJpeg: Buffer, psm: string): Promise<{ text: string; confidence: number }> {
  const worker = await getJsWorker();
  await worker.setParameters({
    tessedit_pageseg_mode: psm as unknown as never,
    preserve_interword_spaces: '1',
  });
  const result = await worker.recognize(imageJpeg);
  const confidenceRaw = typeof result.data.confidence === 'number' ? result.data.confidence : 0;
  // tesseract.js reports confidence on a 0-100 scale.
  return { text: String(result.data.text || ''), confidence: Math.max(0, Math.min(1, confidenceRaw / 100)) };
}

async function runJs(imageJpeg: Buffer, psm: string): Promise<string> {
  const { text } = await runJsRecognize(imageJpeg, psm);
  return text;
}

function toLines(text: string): string[] {
  return String(text || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Per-ROI OCR result — text + confidence for one of the five calibrated
 *  T.C. kimlik ön yüz field regions defined in card-preprocess.ts. */
export type FieldRoiOcr = {
  key: FieldRoiKey;
  text: string;
  confidence: number;
};

export type LocalOcrResult = {
  engine: 'native+js' | 'tesseract.js';
  fieldRois: FieldRoiOcr[];
  meta: CardPreprocessMeta;
  debugDir: string;
};

export type FieldCropKind = 'tc' | 'dob' | 'name' | 'gender';

/**
 * Local OCR for T.C. kimlik ön yüz.
 *
 * Uses the calibrated card detection / perspective-normalization /
 * per-field ROI geometry from card-preprocess.ts (preprocessTcIdCard,
 * TC_FIELD_ROIS, cropFieldRoiRaw, writeTcIdDebugImages) — that module
 * already computed the right card meta and ROI boxes, it just was not
 * wired into this function yet.
 *
 * Each ROI's confidence always comes from a genuine tesseract.js
 * recognize() pass (result.data.confidence). The native tesseract.exe CLI
 * path (when available) is used only to try to improve the recognized
 * TEXT for a region — its plain-text output has no per-word confidence,
 * so it is never used to invent a confidence score.
 */
export async function recognizeTcIdFrontLocal(imageBytes: Buffer): Promise<LocalOcrResult> {
  const { cardJpeg, originalJpeg, detectedJpeg, meta } = await preprocessTcIdCard(imageBytes);

  const nativeAvailable = Boolean(resolveNative());
  const engine: 'native+js' | 'tesseract.js' = nativeAvailable ? 'native+js' : 'tesseract.js';

  const keys = Object.keys(TC_FIELD_ROIS) as FieldRoiKey[];
  const fieldRois: FieldRoiOcr[] = await Promise.all(
    keys.map(async (key) => {
      const crop = await cropFieldRoiRaw(cardJpeg, meta.width, meta.height, key);
      const psm = key === 'tcNo' || key === 'dogumTarihi' ? '7' : '6';

      const js = await runJsRecognize(crop, psm);
      let text = js.text;

      if (nativeAvailable) {
        const whitelist = key === 'tcNo' ? '0123456789' : key === 'dogumTarihi' ? '0123456789./-' : undefined;
        try {
          const nativeText = await runNative(crop, psm, whitelist);
          if (nativeText.trim()) text = nativeText;
        } catch {
          // Keep the tesseract.js text already captured above.
        }
      }

      return { key, text, confidence: js.confidence };
    }),
  );

  const debugDir = await writeTcIdDebugImages({
    originalJpeg,
    detectedJpeg,
    cardJpeg,
    cardW: meta.width,
    cardH: meta.height,
  });

  return { engine, fieldRois, meta, debugDir };
}


/** Second-pass OCR on a specific field region of an already-cropped card. */
export async function recognizeTcIdFieldCrop(
  cardJpeg: Buffer,
  kind: FieldCropKind,
): Promise<{ lines: string[]; text: string }> {
  const rel =
    kind === 'tc'
      ? FIELD_CROPS.tc
      : kind === 'dob'
        ? FIELD_CROPS.dob
        : kind === 'gender'
          ? FIELD_CROPS.gender
          : FIELD_CROPS.name;
  const crop = await extractRelativeCrop(cardJpeg, rel);
  const whitelist =
    kind === 'tc' ? '0123456789' : kind === 'dob' ? '0123456789./-' : undefined;

  let text = '';
  if (resolveNative()) {
    text = await runNative(crop, kind === 'tc' || kind === 'dob' ? '7' : '6', whitelist);
    if (kind === 'tc') {
      const alt = await extractRelativeCrop(cardJpeg, FIELD_CROPS.tcAlt);
      text += '\n' + (await runNative(alt, '7', '0123456789'));
    }
  } else {
    text = await runJs(crop, kind === 'tc' || kind === 'dob' ? '7' : '6');
  }
  const lines = toLines(text);
  return { lines, text: lines.join('\n') };
}
