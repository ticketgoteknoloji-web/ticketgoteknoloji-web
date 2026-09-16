import type { Metadata } from 'next';
import { SmartDocumentReader } from '@/components/mrz/SmartDocumentReader';

export const metadata: Metadata = {
  title: 'Akıllı Belge Okuyucu',
  description: 'Pasaport, T.C. kimlik veya araç ruhsatınızı yükleyin ya da kamerayla tarayın.',
  robots: { index: false, follow: false },
};

export default function MrzHomePage() {
  return <SmartDocumentReader />;
}
