/**
 * Turkish vehicle plate ("plaka") normalization and validation.
 *
 * Canonical format: "NN L NNNN" / "NN LL NNN|NNNN" / "NN LLL NN|NNN"
 * (province 01–81, 1–3 letters, digit-count tied to letter-count).
 *
 * IMPORTANT — OCR ambiguity policy (per product requirement): O/0, I/1, B/8
 * confusions are never silently "corrected" into a definite answer.
 * `validatePlate` reports the plate as invalid if it doesn't match the
 * strict grammar as read, and separately surfaces a `possibleCorrection`
 * candidate ONLY as a suggestion the user must confirm — it is never
 * written into `value`/`validated: true` on its own.
 */

const PLATE_PATTERN = /^(0[1-9]|[1-7][0-9]|8[01])([A-HJ-NPR-VYZ]{1,3})(\d{2,4})$/;

// Characters PaddleOCR/Tesseract commonly confuse in this font family.
const DIGIT_TO_LETTER: Record<string, string> = { '0': 'O', '1': 'I', '8': 'B' };
const LETTER_TO_DIGIT: Record<string, string> = { O: '0', I: '1', B: '8' };

export function normalizePlate(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/İ/g, 'I')
    .replace(/[^A-Z0-9]/g, '');
}

function digitCountMatchesLetterCount(letters: string, digits: string): boolean {
  if (letters.length === 1) return digits.length === 4;
  if (letters.length === 2) return digits.length === 3 || digits.length === 4;
  if (letters.length === 3) return digits.length === 2 || digits.length === 3;
  return false;
}

export function formatPlateForDisplay(normalized: string): string {
  const match = normalized.match(PLATE_PATTERN);
  if (!match) return normalized;
  const [, province, letters, digits] = match;
  return `${province} ${letters} ${digits}`;
}

/**
 * Tries swapping each ambiguous character into its "expected slot" type
 * (digit positions want a digit, letter positions want a letter) and
 * returns a corrected candidate ONLY if that single, position-consistent
 * swap set would make the plate valid. Never mutates the original.
 */
function attemptAmbiguityCorrection(normalized: string): string | null {
  if (normalized.length < 5 || normalized.length > 8) return null;

  // Province (first 2 chars) must be digits; try digit-slot correction there,
  // then scan the remaining chars for a single plausible letters/digits split.
  const chars = normalized.split('');
  const corrected = chars.map((ch, i) => {
    if (i < 2) {
      // province: force to digit-shape if it's an ambiguous letter
      return DIGIT_TO_LETTER[ch] !== undefined ? ch : LETTER_TO_DIGIT[ch] !== undefined ? LETTER_TO_DIGIT[ch] : ch;
    }
    return ch;
  });

  // After the province, try both directions for the remaining run: letters
  // block vs digits block, since we don't know the boundary a priori.
  const rest = corrected.slice(2).join('');
  const letterRunMatch = rest.match(/^([A-Z0-9]{1,3})(\d{2,4})$/);
  if (!letterRunMatch) return null;
  const [, letterPart, digitPart] = letterRunMatch;

  const fixedLetters = letterPart
    .split('')
    .map((ch) => (DIGIT_TO_LETTER[ch] ? DIGIT_TO_LETTER[ch] : ch))
    .join('');
  const fixedDigits = digitPart
    .split('')
    .map((ch) => (LETTER_TO_DIGIT[ch] ? LETTER_TO_DIGIT[ch] : ch))
    .join('');

  const candidate = corrected.slice(0, 2).join('') + fixedLetters + fixedDigits;
  if (candidate === normalized) return null; // no actual correction was needed/applied
  return PLATE_PATTERN.test(candidate) ? candidate : null;
}

export type PlateValidation = {
  normalized: string;
  displayValue: string;
  validated: boolean;
  /** A candidate that WOULD validate after resolving known OCR ambiguity — suggestion only, never auto-applied. */
  possibleCorrection: string | null;
  issues: string[];
};

export function validatePlate(raw: string): PlateValidation {
  const normalized = normalizePlate(raw);
  const issues: string[] = [];

  const directMatch = normalized.match(PLATE_PATTERN);
  const digitCountOk = directMatch ? digitCountMatchesLetterCount(directMatch[2], directMatch[3]) : false;
  const validated = Boolean(directMatch) && digitCountOk;

  let possibleCorrection: string | null = null;
  if (!validated) {
    possibleCorrection = attemptAmbiguityCorrection(normalized);
    if (possibleCorrection) {
      issues.push('AMBIGUOUS_OCR_CHARACTERS');
    } else if (!normalized) {
      issues.push('PLATE_NOT_FOUND');
    } else {
      issues.push('INVALID_PLATE_FORMAT');
    }
  }

  return {
    normalized,
    displayValue: validated ? formatPlateForDisplay(normalized) : normalized,
    validated,
    possibleCorrection: possibleCorrection ? formatPlateForDisplay(possibleCorrection) : null,
    issues,
  };
}
