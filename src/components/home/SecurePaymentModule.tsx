import { tamiConfig } from '@/config/payment';
import { SecurePaymentSection } from '@/components/home/SecurePaymentSection';

export function SecurePaymentModule() {
  return <SecurePaymentSection providerReady={tamiConfig().configured} />;
}
