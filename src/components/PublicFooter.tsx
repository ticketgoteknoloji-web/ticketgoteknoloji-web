import Link from 'next/link';
import {
  BRAND_INFO_EMAIL,
  BRAND_KVKK_EMAIL,
  BRAND_LEGAL_NAME,
  BRAND_PHONE_DISPLAY,
  BRAND_PHONE_HREF,
  BRAND_SUPPORT_EMAIL,
  BRAND_TAGLINE,
  BRAND_WHATSAPP_NUMBER,
} from '@/lib/site';
import { createWhatsAppLink } from '@/lib/mailto';
import { BrandLogo } from './BrandLogo';

const companyLinks = [
  { href: '/about', label: 'Hakkımızda' },
  { href: '/projects', label: 'Ürünler' },
  { href: '/download', label: 'Download' },
  { href: '/pricing#hizmet', label: 'Hizmet' },
  { href: '/pricing#bakim', label: 'Bakım' },
  { href: '/pricing', label: 'Fiyatlandırma' },
  { href: '/payment', label: 'Ödeme' },
] as const;

const solutionLinks = [
  { href: '/solutions', label: 'Çözümler' },
  { href: '/#yapay-zeka', label: 'Yapay zekâ' },
  { href: '/#sektorler', label: 'Sektörler' },
] as const;

const technologyLinks = [
  { href: '/technologies', label: 'Teknoloji yaklaşımı' },
  { href: '/technologies#ai', label: 'AI & akıllı sistemler' },
  { href: '/#teknolojiler', label: 'Ekosistem' },
] as const;

const legalLinks = [
  { href: '/kvkk', label: 'KVKK' },
  { href: '/privacy', label: 'Gizlilik Politikası' },
  { href: '/terms', label: 'Kullanım Koşulları' },
  { href: '/cookies', label: 'Çerez Politikası' },
  { href: '/legal/distance-sales', label: 'Mesafeli Satış Sözleşmesi' },
  { href: '/legal/pre-information', label: 'Ön Bilgilendirme' },
  { href: '/legal/refund', label: 'İptal / İade Politikası' },
] as const;

export function PublicFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="section-wrap grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-5">
        <div className="min-w-0">
          <h4 className="text-[0.8125rem] font-bold tracking-normal text-ink">Şirket</h4>
          <div className="mt-4 max-w-[150px]">
            <BrandLogo variant="footer" />
          </div>
          <p className="mt-3 text-sm font-semibold text-ink">{BRAND_LEGAL_NAME}</p>
          <p className="mt-2 max-w-xs text-[0.9375rem] font-normal leading-[1.7] text-muted">{BRAND_TAGLINE}</p>
          <div className="mt-4 space-y-2 text-sm font-medium text-muted">
            {companyLinks.map((item) => (
              <Link key={item.href} href={item.href} className="block transition-colors hover:text-brand-600">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="min-w-0">
          <h4 className="text-[0.8125rem] font-bold tracking-normal text-ink">Çözümler</h4>
          <div className="mt-4 space-y-2 text-sm font-medium text-muted">
            {solutionLinks.map((item) => (
              <Link key={`${item.href}-${item.label}`} href={item.href} className="block transition-colors hover:text-brand-600">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="min-w-0">
          <h4 className="text-[0.8125rem] font-bold tracking-normal text-ink">Teknolojiler</h4>
          <div className="mt-4 space-y-2 text-sm font-medium text-muted">
            {technologyLinks.map((item) => (
              <Link key={item.href} href={item.href} className="block transition-colors hover:text-brand-600">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="min-w-0">
          <h4 className="text-[0.8125rem] font-bold tracking-normal text-ink">İletişim</h4>
          <div className="mt-4 space-y-2 text-sm font-medium text-muted">
            <a href={BRAND_PHONE_HREF} className="block transition-colors hover:text-brand-600">
              {BRAND_PHONE_DISPLAY}
            </a>
            <a href={`mailto:${BRAND_INFO_EMAIL}`} className="email-link block transition-colors hover:text-brand-600">
              {BRAND_INFO_EMAIL}
            </a>
            <a href={`mailto:${BRAND_SUPPORT_EMAIL}`} className="email-link block transition-colors hover:text-brand-600">
              {BRAND_SUPPORT_EMAIL}
            </a>
            <a href={`mailto:${BRAND_KVKK_EMAIL}`} className="email-link block transition-colors hover:text-brand-600">
              {BRAND_KVKK_EMAIL}
            </a>
            <Link href="/contact" className="block transition-colors hover:text-brand-600">
              İletişim formu
            </Link>
            {(() => {
              const waHref = createWhatsAppLink({
                phone: BRAND_WHATSAPP_NUMBER,
                message: 'Merhaba TicketGo Teknoloji, hizmetleriniz hakkında bilgi almak istiyorum.',
              });
              return waHref ? (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block transition-colors hover:text-brand-600"
                >
                  WhatsApp ile İletişim
                </a>
              ) : null;
            })()}
          </div>
        </div>
        <div className="min-w-0">
          <h4 className="text-[0.8125rem] font-bold tracking-normal text-ink">Yasal</h4>
          <div className="mt-4 space-y-2 text-sm font-medium text-muted">
            {legalLinks.map((item) => (
              <Link key={item.href} href={item.href} className="block transition-colors hover:text-brand-600">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-line py-5 text-center text-xs text-muted">
        © {new Date().getFullYear()} {BRAND_LEGAL_NAME}. Tüm hakları saklıdır.
      </div>
    </footer>
  );
}
