export type CardNetwork = 'visa' | 'mastercard' | 'troy';

/** Checkout accepts a 16-digit PAN only (Visa / Mastercard / TROY). */
export const UI_CARD_NUMBER_MIN = 16;
export const UI_CARD_NUMBER_DIGITS = 16;
/** 16 digits grouped as `xxxx xxxx xxxx xxxx`. */
export const UI_CARD_NUMBER_INPUT_MAX = 19;

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatCardNumber(value: string): string {
  return digitsOnly(value)
    .slice(0, UI_CARD_NUMBER_DIGITS)
    .replace(/(\d{4})(?=\d)/g, '$1 ')
    .trim();
}

export function maskCardNumber(value: string): string {
  const digits = digitsOnly(value);
  if (digits.length < 4) return '•••• •••• •••• ••••';
  const last4 = digits.slice(-4);
  const rest = '•'.repeat(Math.max(0, digits.length - 4));
  return `${rest}${last4}`.replace(/(.{4})/g, '$1 ').trim();
}

export function detectCardNetwork(value: string): CardNetwork | null {
  const digits = digitsOnly(value);
  if (!digits) return null;
  if (digits.startsWith('9792')) return 'troy';
  if (digits.startsWith('4')) return 'visa';
  const two = Number(digits.slice(0, 2));
  const four = Number(digits.slice(0, 4));
  if ((two >= 51 && two <= 55) || (four >= 2221 && four <= 2720)) return 'mastercard';
  return null;
}

export function luhnOk(value: string): boolean {
  const digits = digitsOnly(value);
  if (digits.length < UI_CARD_NUMBER_MIN || digits.length > UI_CARD_NUMBER_DIGITS) return false;
  let sum = 0;
  let doubleDigit = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

export function cardNumberValid(value: string): boolean {
  const digits = digitsOnly(value);
  if (digits.length !== UI_CARD_NUMBER_DIGITS) return false;
  return luhnOk(digits) || detectCardNetwork(digits) !== null;
}

export function formatExpiry(value: string): string {
  const digits = digitsOnly(value).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)} / ${digits.slice(2)}`;
}

/** True when the field just reached its full digit length so focus can move to the next input. */
export function shouldAdvanceCardField(previous: string, next: string, filledLength: number): boolean {
  return digitsOnly(previous).length < filledLength && digitsOnly(next).length >= filledLength;
}

export function expiryValid(value: string, now = new Date()): boolean {
  const digits = digitsOnly(value);
  if (digits.length !== 4) return false;
  const month = Number(digits.slice(0, 2));
  const year = 2000 + Number(digits.slice(2, 4));
  if (!Number.isInteger(month) || month < 1 || month > 12) return false;
  const current = now.getFullYear() * 12 + now.getMonth();
  const entered = year * 12 + (month - 1);
  return entered >= current;
}

export function cvvValid(value: string, network: CardNetwork | null): boolean {
  const digits = digitsOnly(value);
  if (network === 'visa' || network === 'mastercard' || network === 'troy' || !network) {
    return digits.length === 3;
  }
  return digits.length === 3 || digits.length === 4;
}

export function networkLabel(network: CardNetwork | null): string | null {
  if (network === 'visa') return 'Visa';
  if (network === 'mastercard') return 'Mastercard';
  if (network === 'troy') return 'TROY';
  return null;
}
