export type QnbCardProgramId = 'qnb' | 'bonus' | 'world' | 'paraf' | 'axess' | 'maximum';

export type QnbCardProgram = {
  id: QnbCardProgramId;
  displayName: string;
  enabled: boolean;
  installmentsEnabled: boolean;
  /** Merchant-defined installment counts. Empty until QNBpay panel confirms them. */
  installments: number[];
};

function envFlag(name: string): boolean | null {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return null;
  if (raw === '1' || raw === 'true' || raw === 'on') return true;
  if (raw === '0' || raw === 'false' || raw === 'off') return false;
  return null;
}

function envInstallments(name: string): number[] | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  const values = raw
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item >= 1 && item <= 12);
  return values.length ? Array.from(new Set(values)).sort((a, b) => a - b) : [];
}

/**
 * TicketGo merchant card programs. Defaults are OFF until QNBpay workplace settings are confirmed.
 * Flip via env, e.g. QNBPAY_PROGRAM_BONUS=true and QNBPAY_PROGRAM_BONUS_INSTALLMENTS=1,3,6
 */
export const QNB_CARD_PROGRAMS: Record<QnbCardProgramId, Omit<QnbCardProgram, 'enabled' | 'installments' | 'installmentsEnabled'>> = {
  qnb: { id: 'qnb', displayName: 'QNB' },
  bonus: { id: 'bonus', displayName: 'Bonus' },
  world: { id: 'world', displayName: 'World' },
  paraf: { id: 'paraf', displayName: 'Paraf' },
  axess: { id: 'axess', displayName: 'Axess' },
  maximum: { id: 'maximum', displayName: 'Maximum' },
};

export function getQnbCardPrograms(): QnbCardProgram[] {
  return (Object.keys(QNB_CARD_PROGRAMS) as QnbCardProgramId[]).map((id) => {
    const enabled = envFlag(`QNBPAY_PROGRAM_${id.toUpperCase()}`) === true;
    const installments = envInstallments(`QNBPAY_PROGRAM_${id.toUpperCase()}_INSTALLMENTS`) ?? [];
    const installmentsEnabled = enabled && (envFlag(`QNBPAY_PROGRAM_${id.toUpperCase()}_INSTALLMENTS_ENABLED`) ?? installments.length > 0);
    return {
      ...QNB_CARD_PROGRAMS[id],
      enabled,
      installmentsEnabled,
      installments: installmentsEnabled ? installments : [],
    };
  });
}

export function getEnabledQnbCardPrograms(): QnbCardProgram[] {
  return getQnbCardPrograms().filter((item) => item.enabled);
}

export function merchantInstallmentCounts(): number[] {
  const global = envInstallments('QNBPAY_INSTALLMENTS');
  if (global?.length) return global.includes(1) ? global : [1, ...global];
  const fromPrograms = getEnabledQnbCardPrograms().flatMap((item) => item.installments);
  const unique = Array.from(new Set(fromPrograms)).sort((a, b) => a - b);
  return unique.length ? (unique.includes(1) ? unique : [1, ...unique]) : [1];
}

export const CARD_NETWORKS = ['Visa', 'Mastercard', 'TROY'] as const;
