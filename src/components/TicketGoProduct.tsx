import Link from 'next/link';

const capabilities = [
  'Modüler ürün omurgası',
  'Operasyon yönetimi',
  'Müşteri yönetimi',
  'B2B kanal yönetimi',
  'Ödeme entegrasyonları',
  'Bildirim altyapısı',
  'Raporlama',
  'API katmanı',
] as const;

type TicketGoProductProps = {
  id?: string;
  heading?: string;
  compact?: boolean;
};

/**
 * Corporate case-style block for TicketGo Teknoloji A.Ş. platform capability.
 * Must not promote third-party ferry/ticketing brands or external product domains.
 */
export function TicketGoProduct({
  id = 'dijital-platform',
  heading = 'Dijital Platform Ürün Omurgası',
  compact = false,
}: TicketGoProductProps) {
  return (
    <section id={id} className="surface-card min-w-0 scroll-section overflow-hidden p-6 sm:p-8">
      <p className="eyebrow">Geliştirdiğimiz platform yaklaşımı</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{heading}</h2>
      <p className="mt-2 max-w-3xl text-sm font-medium leading-7 text-ink">
        Rezervasyon, satış, operasyon, ödeme ve müşteri süreçlerini aynı ürün omurgasında birleştiren kurumsal yazılım
        yaklaşımı.
      </p>
      <div className="mt-5 max-w-3xl min-w-0 space-y-4 break-words text-sm leading-7 text-muted">
        <p>
          TicketGo Teknoloji A.Ş.; ölçeklenebilir mimari, güvenlik ve sürdürülebilir işletim ilkeleriyle uçtan uca dijital
          platformlar tasarlar, geliştirir ve işletir. Bu yaklaşım, sektörden bağımsız olarak iş süreçlerini
          dijitalleştirmek için kullanılır.
        </p>
        {!compact ? (
          <p>
            Şirket; özel yazılım, CRM, SaaS, web/mobil uygulama, API entegrasyonu, otomasyon ve yapay zekâ servisleriyle
            kurumsal ihtiyaçlara uçtan uca çözüm üretir. Tek bir ürünle sınırlı değildir.
          </p>
        ) : null}
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {capabilities.map((item) => (
          <span key={item} className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            {item}
          </span>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/solutions" className="btn btn-primary rounded-full">
          Çözümleri İncele
        </Link>
        <Link href="/contact?need=Dijital%20Platform" className="btn btn-secondary rounded-full">
          Benzer bir platform konuşalım
        </Link>
      </div>
    </section>
  );
}
