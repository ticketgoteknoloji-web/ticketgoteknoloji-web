import { tamiConfig } from '@/lib/payments/config';
import { QnbpayPaymentProvider } from '@/lib/payments/qnbpay';
import { TamiPaymentProvider } from '@/lib/payments/tami';
import type { PaymentProvider, PaymentProviderId } from '@/lib/payments/types';

const tami = new TamiPaymentProvider();
const qnbpay = new QnbpayPaymentProvider();

function retired(id: PaymentProviderId): PaymentProvider {
  return {
    id,
    isConfigured: () => false,
    createPayment: async () => ({
      ok: false,
      code: 'provider_error',
      message: 'Bu ödeme yöntemi artık kullanılmıyor. Tami / Garanti BBVA Sanal POS ile devam edin.',
    }),
    verifyPayment: async () => ({ ok: true, status: 'failed' }),
    getPaymentStatus: async () => ({ ok: false, message: 'Bu sağlayıcı artık aktif değil.' }),
    refundPayment: async () => ({ ok: false, message: 'Bu sağlayıcı üzerinden iade yapılamaz.' }),
  };
}

export function getPaymentProvider(id: PaymentProviderId): PaymentProvider {
  if (id === 'tami') return tami;
  if (id === 'qnbpay') return qnbpay;
  return retired(id);
}

export function defaultPaymentProviderId(): PaymentProviderId {
  return tamiConfig().enabled ? 'tami' : 'qnbpay';
}
