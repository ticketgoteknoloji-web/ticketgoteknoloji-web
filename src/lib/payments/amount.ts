import { fromMinorUnits, toMinorUnits } from '@/lib/money';

export function providerAmountMatches(paidPrice: string | number | undefined, orderMinor: number): boolean {
  if (paidPrice == null || paidPrice === '') return false;
  const asNumber = typeof paidPrice === 'number' ? paidPrice : Number(String(paidPrice).replace(',', '.'));
  if (!Number.isFinite(asNumber)) return false;
  return toMinorUnits(asNumber) === orderMinor;
}

export function formatProviderMoney(minor: number): string {
  return fromMinorUnits(minor).toFixed(2);
}
