import Link from 'next/link';
import { PRODUCT_TICKET_GO, PRODUCT_TICKET_GO_URL } from '@/lib/site';

const capabilities = [
  'Feribot biletleme',
  'Rezervasyon yönetimi',
  'Elektronik bilet',
  'B2B acente sistemi',
  'Operasyon yönetimi',
  'Müşteri yönetimi',
  'Ödeme entegrasyonları',
  'Bildirim altyapısı',
] as const;

type TicketGoProductProps = {
  id?: string;
  heading?: string;
  compact?: boolean;
};

export function TicketGoProduct({
  id = 'ticket-go',
  heading = PRODUCT_TICKET_GO,
  compact = false,
}: TicketGoProductProps) {
  return (
    <section id={id} className="surface-card min-w-0 scroll-section overflow-hidden p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">Geliştirdiğimiz platform örneği</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{heading}</h2>
      <p className="mt-2 max-w-3xl text-sm font-medium leading-7 text-ink">
        Rezervasyon, elektronik biletleme, B2B, operasyon, ödeme ve müşteri süreçlerini dijital ortamda bir araya getiren
        platform.
      </p>
      <div className="mt-5 max-w-3xl min-w-0 space-y-4 break-words text-sm leading-7 text-muted">
        <p>
          Ticket-Go, TicketGo Teknoloji A.Ş. tarafından geliştirilen bir ürün platformudur. Deniz ulaşımı ve feribot
          biletleme süreçlerini rezervasyondan operasyona kadar merkezi biçimde yönetmek üzere tasarlanmıştır.
        </p>
        {!compact ? (
          <>
            <p>
              Platform; seferlerin görüntülenmesi, elektronik bilet, kapasite, acente satışı, ödeme ve müşteri yönetimini
              aynı ürün omurgasında birleştirir. TicketGo Teknoloji A.Ş. bu ürünle sınırlı değildir; Ticket-Go, şirketin
              uçtan uca dijital platform üretme kabiliyetini gösteren örneklerden biridir.
            </p>
            <p>
              Canlı ürün ortamı ticket-go.net üzerinden yürür. Kurumsal şirket sitemiz ise yazılım, CRM, SaaS, web/mobil,
              API ve otomasyon çözümlerini anlatır.
            </p>
          </>
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
        <a
          href={PRODUCT_TICKET_GO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary rounded-full"
        >
          Ticket-Go’yu İncele
        </a>
        <Link href="/contact?need=Ticket-Go" className="btn btn-secondary rounded-full">
          Benzer bir platform konuşalım
        </Link>
      </div>
    </section>
  );
}
