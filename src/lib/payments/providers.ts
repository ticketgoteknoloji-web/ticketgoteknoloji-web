import { QnbpayPaymentProvider } from '@/lib/payments/qnbpay';
import type { PaymentProvider, PaymentProviderId } from '@/lib/payments/types';

const qnbpay = new QnbpayPaymentProvider();

export function getPaymentProvider(id: PaymentProviderId): PaymentProvider {
  if (id !== 'qnbpay') {
    return {
      id,
      isConfigured: () => false,
      createPayment: async () => ({
        ok: false,
        code: 'provider_error',
        message: 'Bu ödeme yöntemi artık kullanılmıyor. QNBpay ile devam edin.',
      }),
      verifyPayment: async () => ({ ok: true, status: 'failed' }),
      getPaymentStatus: async () => ({ ok: false, message: 'Bu sağlayıcı artık aktif değil.' }),
      refundPayment: async () => ({ ok: false, message: 'Bu sağlayıcı üzerinden iade yapılamaz.' }),
    };
  }
  return qnbpay;
}
