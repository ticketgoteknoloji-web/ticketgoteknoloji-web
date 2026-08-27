import { isTamiReady } from '@/lib/payments/config';
import { SecurePaymentSection } from '@/components/home/SecurePaymentSection';

export function SecurePaymentModule() {
  return <SecurePaymentSection providerReady={isTamiReady()} />;
}
