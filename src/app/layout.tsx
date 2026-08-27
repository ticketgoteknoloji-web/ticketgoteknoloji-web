import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import { AnimatedLineBackground } from '@/components/AnimatedLineBackground';
import { AppChrome } from '@/components/AppChrome';
import { FloatingWhatsApp } from '@/components/FloatingWhatsApp';
import { FxProvider } from '@/components/price/FxProvider';
import { getUsdTryQuote } from '@/services/exchange-rate';
import { BRAND_LEGAL_NAME, BRAND_SITE_URL } from '@/lib/site';
import './globals.css';

const sansFont = DM_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

export const revalidate = 3600;

export const metadata: Metadata = {
  metadataBase: new URL(BRAND_SITE_URL),
  title: {
    default: 'TicketGo Teknoloji A.Ş. | Yazılım, CRM, SaaS ve Dijital Platform Geliştirme',
    template: `%s | ${BRAND_LEGAL_NAME}`,
  },
  description:
    'TicketGo Teknoloji A.Ş.; özel yazılım, kurumsal yazılım, CRM, SaaS, dijital platform, web ve mobil uygulama, API entegrasyonu, iş süreçleri otomasyonu ve yapay zekâ entegrasyonu geliştiren bir teknoloji şirketidir.',
  alternates: { canonical: BRAND_SITE_URL },
  keywords: [
    'teknoloji şirketi',
    'yazılım geliştirme',
    'özel yazılım',
    'kurumsal yazılım',
    'CRM',
    'SaaS',
    'dijital platform',
    'yapay zekâ entegrasyonu',
    'API entegrasyonu',
    'iş süreçleri otomasyonu',
    'web uygulama geliştirme',
    'mobil uygulama geliştirme',
    'dijital dönüşüm',
  ],
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    url: BRAND_SITE_URL,
    siteName: BRAND_LEGAL_NAME,
    title: 'TicketGo Teknoloji A.Ş. | Yazılım, CRM, SaaS ve Dijital Platform Geliştirme',
    description:
      'Özel yazılım, CRM, SaaS, dijital platform ve yapay zekâ entegrasyonu ihtiyaçları için ölçeklenebilir teknoloji çözümleri.',
  },
  icons: {
    icon: '/favicon.svg',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const fx = await getUsdTryQuote();
  return (
    <html lang="tr" className={sansFont.variable}>
      <body className="font-sans antialiased">
        <AnimatedLineBackground />
        <FxProvider initial={fx}>
          <AppChrome>{children}</AppChrome>
        </FxProvider>
        <FloatingWhatsApp />
      </body>
    </html>
  );
}
