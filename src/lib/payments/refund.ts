import { refundPaidOrder } from '@/lib/payments/service';
import { getPaymentProvider } from '@/lib/payments/providers';
import { getOrderById } from '@/lib/payments/orders';

/** Server/admin only. Do not expose as a public API route. */
export async function refundOrderInternal(orderId: string) {
  return refundPaidOrder(orderId);
}

export async function voidOrderInternal(orderId: string) {
  const order = await getOrderById(orderId);
  if (!order?.paymentProvider) return { ok: false, message: 'Sipariş bulunamadı.' };
  const voidFn = getPaymentProvider(order.paymentProvider).voidPayment;
  if (!voidFn) return { ok: false, message: 'Bu sağlayıcıda void yok.' };
  return voidFn(order);
}
