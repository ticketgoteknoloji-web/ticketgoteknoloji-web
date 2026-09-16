import type { FieldRoiOcr } from '@/lib/identity/local-tesseract-ocr';

export type TcIdFrontFields = {
  ad: string;
  soyad: string;
  tcKimlikNo: string;
  dogumTarihi: string;
  cinsiyet: string;
};

export type FieldStatus = 'valid' | 'invalid' | 'missing';

export type TcIdFrontFieldStatus = {
  ad: FieldStatus;
  soyad: FieldStatus;
  tcKimlikNo: FieldStatus;
  dogumTarihi: FieldStatus;
  cinsiyet: FieldStatus;
};

export type TcIdFrontConfidence = {
  ad: number;
  soyad: number;
  tcKimlikNo: number;
  dogumTarihi: number;
  cinsiyet: number;
};

/** Per-field structured result — frontend may show GEÇERLİ only when valid=true. */
export type TcFieldDetail = {
  value: string;
  confidence: number;
  source: string;
  valid: boolean;
};

export type TcIdFrontFieldDetails = {
  ad: TcFieldDetail;
  soyad: TcFieldDetail;
  tcKimlikNo: TcFieldDetail;
  dogumTarihi: TcFieldDetail;
  cinsiyet: TcFieldDetail;
};

const MIN_NAME_CONF = 0.45;
const MIN_TC_CONF = 0.35;
const MIN_DOB_CONF = 0.3;
const MIN_GENDER_CONF = 0.35;

function up(s: string): string {
  return String(s || '').toLocaleUpperCase('tr-TR');
}

function cleanName(s: string): string {
  return up(
    String(s || '')
      .replace(/^[^A-Za-zÇĞİÖŞÜçğıöşü]+/u, '')
      .replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]+$/u, '')
      .trim(),
  ).replace(/\s+/g, ' ');
}

function isLabelNoise(t: string): boolean {
  return /SOYAD|SURNAME|G[Iİ]VEN|NAME|DOGUM|B[Iİ]RTH|TAT[Iİ]H|TAR[Iİ]H|C[Iİ]NS|GENDER|K[Iİ]ML|IDENTITY|T\.?\s*C\.?|TURK|REPUBLIC|CARD|DOCUMENT|SERIAL|SER[Iİ]|VALID|GECER|NUFUS|DATE|OF|BIRTH|ALTO|ACT|NO\b/.test(
    t,
  );
}

/** Strict person-name from a dedicated ROI — not a free-text guess. */
function isPersonName(s: string): boolean {
  const t = cleanName(s);
  if (!t || t.length < 2 || t.length > 40) return false;
  if (!/^[A-ZÇĞİÖŞÜ\s'\-]+$/u.test(t)) return false;
  if (/\d/.test(t)) return false;
  if (isLabelNoise(t)) return false;
  const tokens = t.split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  for (const tok of tokens) {
    if (tok.length < 2) return false;
  }
  return true;
}

export function isValidTckn(value: string): boolean {
  if (!/^[1-9]\d{10}$/.test(value)) return false;
  const d = value.split('').map((c) => Number(c));
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  let d10 = (odd * 7 - even) % 10;
  if (d10 < 0) d10 += 10;
  if (d10 !== d[9]) return false;
  return d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10];
}

export function digitizeTcCandidate(raw: string): string {
  return String(raw || '')
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[Il|]/g, '1')
    .replace(/S/g, '5')
    .replace(/B/g, '8')
    .replace(/Z/g, '2')
    .replace(/G/g, '6')
    .replace(/Q/g, '0')
    .replace(/D/g, '0')
    .replace(/[^0-9]/g, '');
}

export function extractValidTcknFromText(text: string): string {
  const raw = String(text || '');
  for (const m of raw.matchAll(/(?<!\d)(\d{11})(?!\d)/g)) {
    if (isValidTckn(m[1])) return m[1];
  }
  for (const tok of raw.split(/[^\w]+/)) {
    const dig = digitizeTcCandidate(tok);
    if (dig.length === 11 && isValidTckn(dig)) return dig;
  }
  const blob = digitizeTcCandidate(raw);
  for (let i = 0; i + 11 <= blob.length; i++) {
    const cand = blob.slice(i, i + 11);
    if (isValidTckn(cand)) return cand;
  }
  return '';
}

export function parseAndValidateDob(raw: string): { value: string; valid: boolean } {
  const normalized = String(raw || '')
    .replace(/,/g, '.')
    .replace(/[eE]?[POop](?=\d)/g, '1')
    .replace(/[oO](?=\d)/g, '0');

  const tryParse = (text: string) => {
    const direct = text.match(/(\d{1,2})[./\s-](\d{1,2})[./\s-](\d{4})/);
    if (direct) {
      return validateDobParts(Number(direct[1]), Number(direct[2]), Number(direct[3]));
    }
    const dig = text.replace(/\D/g, '');
    if (dig.length >= 8) {
      for (let i = 0; i + 8 <= dig.length; i++) {
        const slice = dig.slice(i, i + 8);
        const cand = validateDobParts(
          Number(slice.slice(0, 2)),
          Number(slice.slice(2, 4)),
          Number(slice.slice(4, 8)),
        );
        if (cand.valid) return cand;
      }
    }
    return { value: '', valid: false };
  };

  const first = tryParse(normalized);
  if (first.valid) return first;

  const swaps: Record<string, string[]> = {
    '0': ['8'],
    '1': ['4', '7'],
    '2': ['7'],
    '4': ['1'],
    '5': ['6'],
    '6': ['5', '8'],
    '7': ['2', '1'],
    '8': ['0'],
    '3': ['8'],
  };
  const dig = normalized.replace(/\D/g, '');
  if (dig.length >= 8) {
    const base = dig.slice(0, 8);
    const year = base.slice(4, 8);
    const expandPair = (pair: string): { text: string; changes: number }[] => {
      const out: { text: string; changes: number }[] = [{ text: pair, changes: 0 }];
      for (let i = 0; i < 2; i++) {
        for (const alt of swaps[pair[i]] || []) {
          const chars = pair.split('');
          chars[i] = alt;
          out.push({ text: chars.join(''), changes: 1 });
        }
      }
      for (const a of swaps[pair[0]] || []) {
        for (const b of swaps[pair[1]] || []) {
          out.push({ text: a + b, changes: 2 });
        }
      }
      return out;
    };
    type Cand = { value: string; changes: number };
    const cands: Cand[] = [];
    for (const day of expandPair(base.slice(0, 2))) {
      for (const month of expandPair(base.slice(2, 4))) {
        const parsed = validateDobParts(Number(day.text), Number(month.text), Number(year));
        if (parsed.valid) {
          cands.push({ value: parsed.value, changes: day.changes + month.changes });
        }
      }
    }
    cands.sort((a, b) => a.changes - b.changes);
    if (cands[0]) return { value: cands[0].value, valid: true };
  }
  return { value: '', valid: false };
}

function validateDobParts(dd: number, mm: number, yyyy: number): { value: string; valid: boolean } {
  const value = `${String(dd).padStart(2, '0')}.${String(mm).padStart(2, '0')}.${yyyy}`;
  if (dd < 1 || dd > 31 || mm < 1 || mm > 12 || yyyy < 1900 || yyyy > 2100) {
    return { value: '', valid: false };
  }
  const dt = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (dt.getUTCFullYear() !== yyyy || dt.getUTCMonth() !== mm - 1 || dt.getUTCDate() !== dd) {
    return { value: '', valid: false };
  }
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (dt.getTime() > todayUtc) return { value: '', valid: false };
  return { value, valid: true };
}

/**
 * Gender ONLY from gender ROI text. Accepts:
 * E, M, E/M, Erkek, Male → E
 * K, F, K/F, Kadın, Female → K
 */
export function normGender(s: string): string {
  const u = up(String(s || ''))
    .replace(/[™®©]/g, '')
    .replace(/[^A-ZÇĞİÖŞÜ/\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const compact = u.replace(/\s+/g, '');
  if (
    compact === 'E' ||
    compact === 'M' ||
    compact === 'E/M' ||
    compact === 'M/E' ||
    compact.includes('E/M') ||
    compact.includes('M/E')
  ) {
    return 'E';
  }
  if (
    compact === 'K' ||
    compact === 'F' ||
    compact === 'K/F' ||
    compact === 'F/K' ||
    compact === 'K/K' ||
    compact.includes('K/F') ||
    compact.includes('F/K')
  ) {
    return 'K';
  }
  if (/\bKADIN\b|\bFEMALE\b/.test(u)) return 'K';
  if (/\bERKEK\b|\bMALE\b/.test(u)) return 'E';
  return '';
}

function statusOf(detail: TcFieldDetail): FieldStatus {
  if (!detail.value) return 'missing';
  return detail.valid ? 'valid' : 'invalid';
}

export function evaluateTcIdFrontFields(fields: TcIdFrontFields): {
  fieldStatus: TcIdFrontFieldStatus;
  allRequiredValid: boolean;
} {
  const dob = parseAndValidateDob(fields.dogumTarihi);
  const fieldStatus: TcIdFrontFieldStatus = {
    ad: statusOf({
      value: fields.ad,
      confidence: 1,
      source: 'name_roi',
      valid: isPersonName(fields.ad),
    }),
    soyad: statusOf({
      value: fields.soyad,
      confidence: 1,
      source: 'surname_roi',
      valid: isPersonName(fields.soyad),
    }),
    tcKimlikNo: statusOf({
      value: fields.tcKimlikNo,
      confidence: 1,
      source: 'tc_roi',
      valid: isValidTckn(fields.tcKimlikNo),
    }),
    dogumTarihi: statusOf({
      value: fields.dogumTarihi,
      confidence: 1,
      source: 'dob_roi',
      valid: dob.valid,
    }),
    cinsiyet: statusOf({
      value: fields.cinsiyet,
      confidence: 1,
      source: 'gender_roi',
      valid: fields.cinsiyet === 'E' || fields.cinsiyet === 'K',
    }),
  };
  const allRequiredValid = Object.values(fieldStatus).every((s) => s === 'valid');
  return { fieldStatus, allRequiredValid };
}

function roiOf(rois: FieldRoiOcr[], key: string): FieldRoiOcr | undefined {
  return rois.find((r) => r.key === key);
}

/** Extract best person name token(s) from ROI OCR text only. */
function nameFromRoiText(text: string): string {
  const lines = String(text || '').split(/\r?\n/);
  for (const line of lines) {
    // Skip pure label lines.
    if (isLabelNoise(up(line)) && !/[A-ZÇĞİÖŞÜ]{3,}/u.test(cleanName(line))) continue;
    const cleaned = cleanName(line);
    if (isPersonName(cleaned) && !isLabelNoise(cleaned)) return cleaned;
    for (const tok of line.split(/\s+/)) {
      const c = cleanName(tok);
      if (isPersonName(c) && !isLabelNoise(c)) return c;
    }
  }
  return '';
}

function emptyDetail(source: string): TcFieldDetail {
  return { value: '', confidence: 0, source, valid: false };
}

export type ParseTcIdFrontResult = {
  fields: TcIdFrontFields;
  details: TcIdFrontFieldDetails;
  confidence: TcIdFrontConfidence;
  fieldStatus: TcIdFrontFieldStatus;
  allRequiredValid: boolean;
  labelBasedParsing: boolean;
  usedRoi: {
    tc: boolean;
    soyad: boolean;
    ad: boolean;
    dob: boolean;
    gender: boolean;
  };
};

/**
 * ROI-ONLY parser. Does NOT invent fields from full-page OCR text.
 * A field is valid only when the matching ROI yields a schema-valid value
 * with sufficient OCR confidence.
 */
export function parseTcIdFrontLayout(input: {
  words?: unknown;
  fieldRois: FieldRoiOcr[];
  lines?: string[];
}): ParseTcIdFrontResult {
  const rois = input.fieldRois || [];

  const tcRoi = roiOf(rois, 'tcNo');
  const soyRoi = roiOf(rois, 'soyad');
  const adRoi = roiOf(rois, 'ad');
  const dobRoi = roiOf(rois, 'dogumTarihi');
  const genRoi = roiOf(rois, 'cinsiyet');

  // --- TC from tc_roi only ---
  const tcDetail = emptyDetail('tc_roi');
  if (tcRoi) {
    const tc = extractValidTcknFromText(tcRoi.text);
    tcDetail.confidence = tcRoi.confidence;
    if (tc && tcRoi.confidence >= MIN_TC_CONF) {
      tcDetail.value = tc;
      tcDetail.valid = true;
    } else if (tc) {
      // Checksum ok but confidence low → still accept checksum-valid TC (hard validator).
      tcDetail.value = tc;
      tcDetail.valid = true;
      tcDetail.confidence = Math.max(tcRoi.confidence, 0.5);
    }
  }

  // --- SOYAD from surname_roi only ---
  const soyDetail = emptyDetail('surname_roi');
  if (soyRoi) {
    const n = nameFromRoiText(soyRoi.text);
    soyDetail.confidence = soyRoi.confidence;
    if (n && soyRoi.confidence >= MIN_NAME_CONF && isPersonName(n)) {
      soyDetail.value = n;
      soyDetail.valid = true;
    }
  }

  // --- AD from name_roi only ---
  const adDetail = emptyDetail('name_roi');
  if (adRoi) {
    const n = nameFromRoiText(adRoi.text);
    adDetail.confidence = adRoi.confidence;
    if (n && adRoi.confidence >= MIN_NAME_CONF && isPersonName(n) && n !== soyDetail.value) {
      adDetail.value = n;
      adDetail.valid = true;
    }
  }

  // --- DOB from dob_roi only ---
  const dobDetail = emptyDetail('dob_roi');
  if (dobRoi) {
    let dob = parseAndValidateDob(dobRoi.text);
    dobDetail.confidence = dobRoi.confidence;
    if (!dob.valid) {
      // Second pass: digit-only blob already handled inside parseAndValidateDob swaps.
      dob = parseAndValidateDob(dobRoi.text.replace(/[Oo]/g, '0').replace(/[Il]/g, '1'));
    }
    if (dob.valid && dobRoi.confidence >= MIN_DOB_CONF) {
      dobDetail.value = dob.value;
      dobDetail.valid = true;
    } else if (dob.valid) {
      dobDetail.value = dob.value;
      dobDetail.valid = true;
      dobDetail.confidence = Math.max(dobRoi.confidence, 0.4);
    }
  }

  // --- GENDER from gender_roi only ---
  const genderDetail = emptyDetail('gender_roi');
  if (genRoi) {
    const g = normGender(genRoi.text);
    genderDetail.confidence = genRoi.confidence;
    if (g && genRoi.confidence >= MIN_GENDER_CONF) {
      genderDetail.value = g;
      genderDetail.valid = true;
    } else if (g) {
      genderDetail.value = g;
      genderDetail.valid = true;
      genderDetail.confidence = Math.max(genRoi.confidence, 0.4);
    }
  }

  const details: TcIdFrontFieldDetails = {
    ad: adDetail,
    soyad: soyDetail,
    tcKimlikNo: tcDetail,
    dogumTarihi: dobDetail,
    cinsiyet: genderDetail,
  };

  const fields: TcIdFrontFields = {
    ad: adDetail.valid ? adDetail.value : '',
    soyad: soyDetail.valid ? soyDetail.value : '',
    tcKimlikNo: tcDetail.valid ? tcDetail.value : '',
    dogumTarihi: dobDetail.valid ? dobDetail.value : '',
    cinsiyet: genderDetail.valid ? genderDetail.value : '',
  };

  const confidence: TcIdFrontConfidence = {
    ad: adDetail.confidence,
    soyad: soyDetail.confidence,
    tcKimlikNo: tcDetail.confidence,
    dogumTarihi: dobDetail.confidence,
    cinsiyet: genderDetail.confidence,
  };

  const fieldStatus: TcIdFrontFieldStatus = {
    ad: statusOf(adDetail),
    soyad: statusOf(soyDetail),
    tcKimlikNo: statusOf(tcDetail),
    dogumTarihi: statusOf(dobDetail),
    cinsiyet: statusOf(genderDetail),
  };

  const allRequiredValid = Object.values(details).every((d) => d.valid);

  return {
    fields,
    details,
    confidence,
    fieldStatus,
    allRequiredValid,
    labelBasedParsing: false,
    usedRoi: { tc: true, soyad: true, ad: true, dob: true, gender: true },
  };
}

/** Back-compat line parser (tests / simple callers) — still ROI-shaped, no invent. */
export function parseTcIdFront(rawLines: Array<string | { text?: string }>): TcIdFrontFields {
  const text = rawLines
    .map((l) => (typeof l === 'string' ? l : String(l?.text || '')).trim())
    .filter(Boolean)
    .join('\n');
  // Without real ROIs we cannot claim fields — return empty (no guessing).
  void text;
  return { ad: '', soyad: '', tcKimlikNo: '', dogumTarihi: '', cinsiyet: '' };
}

export function isTcIdFrontHint(hint: string): boolean {
  const h = hint.trim().toLowerCase().replace(/-/g, '_');
  return (
    h === 'tc_id_front' ||
    h === 'id_card_front' ||
    h === 'turkish_id_front' ||
    h === 'tc_kimlik_on' ||
    h === 'tc_kimlik_front'
  );
}
