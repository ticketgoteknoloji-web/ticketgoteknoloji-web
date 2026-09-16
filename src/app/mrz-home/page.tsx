import type { Metadata } from 'next';
import { MrzVerifyScreen } from '@/components/mrz/MrzVerifyScreen';

export const metadata: Metadata = {
  title: 'Pasaport / Kimlik Belgesi Okuma',
  description: 'Belgenizi yükleyin veya kamerayla tarayın.',
  robots: { index: false, follow: false },
};

export default function MrzHomePage() {
  return <MrzVerifyScreen />;
}
