/**
 * VIN / Şasi No — format validation.
 *
 * ISO 3779: exactly 17 characters, uppercase A-Z + 0-9, excluding I, O, Q
 * (reserved because they're visually confusable with 1, 0, 0). A North
 * America-specific position-9 check digit (49 CFR 565) exists but is not
 * guaranteed to apply to a Turkish-registered vehicle, so it is not used
 * to fail validation here — only the 17-char/charset rule is enforced.
 *
 * OCR ambiguity policy: I/1, O/0, Q/0 are never silently substituted into
 * `value`. `validateVin` reports invalid if the charset rule is violated,
 * and separately offers `possibleCorrection` (I→1, O→0, Q→0) purely as a
 * suggestion for the user to confirm.
 */

const VIN_CHARSET = /^[A-HJ-NPR-Z0-9]{17}$/;
const AMBIGUOUS_VIN_CHARS: Record<string, string> = { I: '1', O: '0', Q: '0' };

export function stripToVinAlnum(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export type VinValidation = {
  normalized: string;
  validated: boolean;
  possibleCorrection: string | null;
  issues: string[];
};

export function validateVin(raw: string): VinValidation {
  const normalized = stripToVinAlnum(raw);
  const issues: string[] = [];

  if (normalized.length !== 17) {
    issues.push(normalized.length === 0 ? 'VIN_NOT_FOUND' : 'INVALID_VIN_LENGTH');
    // Still check whether resolving I/O/Q would land exactly on 17 chars and pass charset.
    const corrected = normalized
      .split('')
      .map((ch) => AMBIGUOUS_VIN_CHARS[ch] ?? ch)
      .join('');
    const possibleCorrection = corrected.length === 17 && VIN_CHARSET.test(corrected) ? corrected : null;
    if (possibleCorrection) issues.push('AMBIGUOUS_OCR_CHARACTERS');
    return { normalized, validated: false, possibleCorrection, issues };
  }

  const validated = VIN_CHARSET.test(normalized);
  if (validated) {
    return { normalized, validated: true, possibleCorrection: null, issues };
  }

  // 17 chars but contains I/O/Q (or another disallowed char) — surface a
  // correction candidate without applying it.
  const corrected = normalized
    .split('')
    .map((ch) => AMBIGUOUS_VIN_CHARS[ch] ?? ch)
    .join('');
  const possibleCorrection = VIN_CHARSET.test(corrected) ? corrected : null;
  issues.push(possibleCorrection ? 'AMBIGUOUS_OCR_CHARACTERS' : 'INVALID_VIN_CHARSET');

  return { normalized, validated: false, possibleCorrection, issues };
}
