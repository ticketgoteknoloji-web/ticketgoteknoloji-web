import assert from 'node:assert/strict';
import { test } from 'node:test';

// ---------------------------------------------------------------------------
// These test doubles mirror src/lib/vehicle-registration/plate-validator.ts,
// vin-validator.ts and normalize-registration.ts, following this repo's
// existing test convention (see scripts/pricing.test.mjs, and this branch's
// ticketgo-mrz-service/tests/*.py): pure algorithmic logic is exercised
// directly via `node --test` without a TypeScript build step. Any change to
// the real algorithm should be mirrored here.
// ---------------------------------------------------------------------------

// --- Plate validator ---------------------------------------------------------

const PLATE_PATTERN = /^(0[1-9]|[1-7][0-9]|8[01])([A-HJ-NPR-VYZ]{1,3})(\d{2,4})$/;
const DIGIT_TO_LETTER = { 0: 'O', 1: 'I', 8: 'B' };
const LETTER_TO_DIGIT = { O: '0', I: '1', B: '8' };

function normalizePlate(raw) {
  return raw.toUpperCase().replace(/İ/g, 'I').replace(/[^A-Z0-9]/g, '');
}

function digitCountMatchesLetterCount(letters, digits) {
  if (letters.length === 1) return digits.length === 4;
  if (letters.length === 2) return digits.length === 3 || digits.length === 4;
  if (letters.length === 3) return digits.length === 2 || digits.length === 3;
  return false;
}

function formatPlateForDisplay(normalized) {
  const match = normalized.match(PLATE_PATTERN);
  if (!match) return normalized;
  const [, province, letters, digits] = match;
  return `${province} ${letters} ${digits}`;
}

function attemptAmbiguityCorrection(normalized) {
  if (normalized.length < 5 || normalized.length > 8) return null;
  const chars = normalized.split('');
  const corrected = chars.map((ch, i) => {
    if (i < 2) return DIGIT_TO_LETTER[ch] !== undefined ? ch : LETTER_TO_DIGIT[ch] !== undefined ? LETTER_TO_DIGIT[ch] : ch;
    return ch;
  });
  const rest = corrected.slice(2).join('');
  const m = rest.match(/^([A-Z0-9]{1,3})(\d{2,4})$/);
  if (!m) return null;
  const [, letterPart, digitPart] = m;
  const fixedLetters = letterPart.split('').map((ch) => DIGIT_TO_LETTER[ch] ?? ch).join('');
  const fixedDigits = digitPart.split('').map((ch) => LETTER_TO_DIGIT[ch] ?? ch).join('');
  const candidate = corrected.slice(0, 2).join('') + fixedLetters + fixedDigits;
  if (candidate === normalized) return null;
  return PLATE_PATTERN.test(candidate) ? candidate : null;
}

function validatePlate(raw) {
  const normalized = normalizePlate(raw);
  const issues = [];
  const directMatch = normalized.match(PLATE_PATTERN);
  const digitCountOk = directMatch ? digitCountMatchesLetterCount(directMatch[2], directMatch[3]) : false;
  const validated = Boolean(directMatch) && digitCountOk;
  let possibleCorrection = null;
  if (!validated) {
    possibleCorrection = attemptAmbiguityCorrection(normalized);
    if (possibleCorrection) issues.push('AMBIGUOUS_OCR_CHARACTERS');
    else if (!normalized) issues.push('PLATE_NOT_FOUND');
    else issues.push('INVALID_PLATE_FORMAT');
  }
  return {
    normalized,
    displayValue: validated ? formatPlateForDisplay(normalized) : normalized,
    validated,
    possibleCorrection: possibleCorrection ? formatPlateForDisplay(possibleCorrection) : null,
    issues,
  };
}

test('Plaka: valid plate with 1 letter / 4 digits', () => {
  const r = validatePlate('34 A 1234');
  assert.equal(r.validated, true);
  assert.equal(r.displayValue, '34 A 1234');
});

test('Plaka: valid plate with 3 letters / 2 digits', () => {
  const r = validatePlate('06 ABC 12');
  assert.equal(r.validated, true);
});

test('Plaka: invalid — out-of-range province code', () => {
  const r = validatePlate('99 A 1234');
  assert.equal(r.validated, false);
  assert.ok(r.issues.includes('INVALID_PLATE_FORMAT'));
});

test('Plaka: invalid — letter/digit-count mismatch', () => {
  const r = validatePlate('34 A 12'); // 1 letter needs 4 digits
  assert.equal(r.validated, false);
});

test('Plaka: normalization strips separators/lowercase/Turkish İ', () => {
  assert.equal(normalizePlate('34 abc 123'), '34ABC123');
  assert.equal(normalizePlate('34-abc-123'), '34ABC123');
  assert.equal(normalizePlate('34abc123'), '34ABC123');
});

test('Plaka: ambiguous OCR characters are surfaced as a suggestion, never silently applied', () => {
  // "34 A8C 123" -> OCR likely misread the letter 'B' as the digit '8'
  // (Turkish plates never use the letter O, so a misread "0" has no valid
  // letter target and correctly yields no correction — this case uses the
  // one digit/letter pair, 8/B, that IS a real Turkish-plate letter).
  const r = validatePlate('34 A8C 123');
  assert.equal(r.validated, false, 'must not silently accept the ambiguous reading as valid');
  assert.equal(r.displayValue, '34A8C123', 'raw normalized value is preserved, not silently corrected');
  assert.equal(r.possibleCorrection, '34 ABC 123');
  assert.ok(r.issues.includes('AMBIGUOUS_OCR_CHARACTERS'));
});

test('Plaka: a digit with no valid Turkish-plate letter target (0->O, 1->I) yields no correction', () => {
  // O and I are never used on Turkish plates, so a misread "0"/"1" in a
  // letter slot cannot be resolved to a valid plate — this must not be
  // reported as a correctable ambiguity.
  const r = validatePlate('34 A0C 123');
  assert.equal(r.validated, false);
  assert.equal(r.possibleCorrection, null);
  assert.ok(r.issues.includes('INVALID_PLATE_FORMAT'));
});

// --- VIN validator ------------------------------------------------------------

const VIN_CHARSET = /^[A-HJ-NPR-Z0-9]{17}$/;
const AMBIGUOUS_VIN_CHARS = { I: '1', O: '0', Q: '0' };

function stripToVinAlnum(raw) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function validateVin(raw) {
  const normalized = stripToVinAlnum(raw);
  const issues = [];
  if (normalized.length !== 17) {
    issues.push(normalized.length === 0 ? 'VIN_NOT_FOUND' : 'INVALID_VIN_LENGTH');
    const corrected = normalized.split('').map((ch) => AMBIGUOUS_VIN_CHARS[ch] ?? ch).join('');
    const possibleCorrection = corrected.length === 17 && VIN_CHARSET.test(corrected) ? corrected : null;
    if (possibleCorrection) issues.push('AMBIGUOUS_OCR_CHARACTERS');
    return { normalized, validated: false, possibleCorrection, issues };
  }
  const validated = VIN_CHARSET.test(normalized);
  if (validated) return { normalized, validated: true, possibleCorrection: null, issues };
  const corrected = normalized.split('').map((ch) => AMBIGUOUS_VIN_CHARS[ch] ?? ch).join('');
  const possibleCorrection = VIN_CHARSET.test(corrected) ? corrected : null;
  issues.push(possibleCorrection ? 'AMBIGUOUS_OCR_CHARACTERS' : 'INVALID_VIN_CHARSET');
  return { normalized, validated: false, possibleCorrection, issues };
}

test('VIN: accepts a well-formed 17-character VIN', () => {
  const r = validateVin('1HGCM82633A123456');
  assert.equal(r.validated, true);
  assert.equal(r.normalized, '1HGCM82633A123456');
});

test('VIN: rejects wrong length', () => {
  const r = validateVin('1HGCM8263');
  assert.equal(r.validated, false);
  assert.ok(r.issues.includes('INVALID_VIN_LENGTH'));
});

test('VIN: forbidden characters I, O, Q are rejected, never silently accepted', () => {
  // A 17-char string containing an 'O' where a real VIN never has one.
  const withO = 'WVWZZZ1KZAWO23456'; // 17 chars, contains O
  const r = validateVin(withO);
  assert.equal(r.validated, false);
  assert.ok(r.issues.includes('AMBIGUOUS_OCR_CHARACTERS') || r.issues.includes('INVALID_VIN_CHARSET'));
});

test('VIN: ambiguity correction is offered as a suggestion, not applied to normalized/value', () => {
  const withO = 'WVWZZZ1KZAWO23456';
  const r = validateVin(withO);
  assert.equal(r.normalized, withO, 'normalized must preserve the original reading, not the corrected one');
  assert.equal(r.possibleCorrection, 'WVWZZZ1KZAW023456');
});

test('VIN: multiple ambiguous characters (I and O together) are corrected in the suggestion only', () => {
  // 17 chars, contains both an 'I' and an 'O' where digits were likely intended.
  const withIandO = 'WVWZZZIKZAWO23456'; // 17 chars
  const r = validateVin(withIandO);
  assert.equal(r.validated, false);
  assert.equal(r.normalized, withIandO);
  assert.equal(r.possibleCorrection, 'WVWZZZ1KZAW023456');
  assert.ok(r.issues.includes('AMBIGUOUS_OCR_CHARACTERS'));
});

// --- Registration parser field mapping (mirrors parse-registration.ts) ------

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function buildField({ rawValue, normalizedValue, validated }) {
  const value = normalizedValue && normalizedValue.length > 0 ? normalizedValue : null;
  const status = value === null ? 'missing' : validated === null ? 'unvalidated' : validated ? 'valid' : 'invalid';
  return {
    value,
    originalValue: rawValue && rawValue.length > 0 ? rawValue : null,
    confidence: null,
    validated: validated === true,
    status,
  };
}

function mapRawFields(raw) {
  const plateResult = raw.plate ? validatePlate(raw.plate) : null;
  const vinResult = raw.vin ? validateVin(raw.vin) : null;
  return {
    plate: buildField({ rawValue: raw.plate, normalizedValue: plateResult ? plateResult.displayValue : null, validated: raw.plate ? plateResult.validated : null }),
    vin: buildField({ rawValue: raw.vin, normalizedValue: vinResult ? vinResult.normalized : null, validated: raw.vin ? vinResult.validated : null }),
    brand: buildField({ rawValue: raw.brand, normalizedValue: raw.brand ? normalizeWhitespace(raw.brand) : null, validated: null }),
    model: buildField({ rawValue: raw.model, normalizedValue: raw.model ? normalizeWhitespace(raw.model) : null, validated: null }),
    vehicleType: buildField({ rawValue: raw.vehicleType, normalizedValue: raw.vehicleType, validated: null }),
    vehicleClass: buildField({ rawValue: raw.vehicleClass, normalizedValue: raw.vehicleClass, validated: null }),
    modelYear: buildField({ rawValue: raw.modelYear, normalizedValue: raw.modelYear, validated: null }),
    engineNumber: buildField({ rawValue: raw.engineNumber, normalizedValue: raw.engineNumber, validated: null }),
    fuelType: buildField({ rawValue: raw.fuelType, normalizedValue: raw.fuelType, validated: null }),
    color: buildField({ rawValue: raw.color, normalizedValue: raw.color, validated: null }),
    seatCount: buildField({ rawValue: raw.seatCount, normalizedValue: raw.seatCount, validated: null }),
    firstRegistrationDate: buildField({ rawValue: raw.firstRegistrationDate, normalizedValue: raw.firstRegistrationDate, validated: null }),
    registrationDate: buildField({ rawValue: raw.registrationDate, normalizedValue: raw.registrationDate, validated: null }),
    documentSerialNumber: buildField({ rawValue: raw.documentNumber, normalizedValue: raw.documentNumber, validated: null }),
    ownerName: buildField({ rawValue: raw.ownerName, normalizedValue: raw.ownerName, validated: null }),
  };
}

const SYNTHETIC_RAW_FIELDS = {
  plate: '34 ABC 123',
  vehicleType: 'CAR',
  vehicleClass: 'M1',
  brand: 'TOYOTA',
  model: 'COROLLA',
  modelYear: '2022',
  vin: '1HGCM82633A123456',
  engineNumber: 'AB1234567',
  fuelType: 'GASOLINE',
  color: 'Beyaz',
  seatCount: '5',
  firstRegistrationDate: '01.01.2022',
  registrationDate: '15.03.2022',
  ownerName: 'SENTETIK KULLANICI',
  documentNumber: 'TEST0001',
};

test('Registration parser: every requested field maps to the canonical output name', () => {
  const fields = mapRawFields(SYNTHETIC_RAW_FIELDS);
  assert.equal(fields.plate.value, '34 ABC 123');
  assert.equal(fields.plate.validated, true);
  assert.equal(fields.brand.value, 'TOYOTA');
  assert.equal(fields.model.value, 'COROLLA');
  assert.equal(fields.vehicleType.value, 'CAR');
  assert.equal(fields.vehicleClass.value, 'M1');
  assert.equal(fields.modelYear.value, '2022');
  assert.equal(fields.vin.value, '1HGCM82633A123456');
  assert.equal(fields.vin.validated, true);
  assert.equal(fields.engineNumber.value, 'AB1234567');
  assert.equal(fields.fuelType.value, 'GASOLINE');
  assert.equal(fields.color.value, 'Beyaz');
  assert.equal(fields.seatCount.value, '5');
  assert.equal(fields.firstRegistrationDate.value, '01.01.2022');
  assert.equal(fields.registrationDate.value, '15.03.2022');
  // documentSerialNumber is the canonical TS-side name for Python's documentNumber.
  assert.equal(fields.documentSerialNumber.value, 'TEST0001');
  assert.equal(fields.ownerName.value, 'SENTETIK KULLANICI');
});

test('Registration parser: originalValue is preserved separately from the validated/normalized value', () => {
  const fields = mapRawFields({ ...SYNTHETIC_RAW_FIELDS, plate: '34 a0c 123' });
  assert.equal(fields.plate.originalValue, '34 a0c 123');
  assert.equal(fields.plate.validated, false);
});

test('Registration parser: missing fields stay null with status "missing", never invented', () => {
  const fields = mapRawFields({
    plate: null,
    vehicleType: null,
    vehicleClass: null,
    brand: null,
    model: null,
    modelYear: null,
    vin: null,
    engineNumber: null,
    fuelType: null,
    color: null,
    seatCount: null,
    firstRegistrationDate: null,
    registrationDate: null,
    ownerName: null,
    documentNumber: null,
  });
  for (const key of Object.keys(fields)) {
    assert.equal(fields[key].value, null, `${key} should be null`);
    assert.equal(fields[key].status, 'missing');
  }
});
