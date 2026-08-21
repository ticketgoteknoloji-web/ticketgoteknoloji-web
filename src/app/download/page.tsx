import type { Metadata } from 'next';
import { ShieldCheck, BadgeCheck, Lock, PackageCheck } from 'lucide-react';
import { DownloadTable } from '@/components/download/DownloadTable';
import { DownloadSupportCta } from '@/components/download/DownloadSupportCta';
import { BRAND_LEGAL_NAME, BRAND_SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Download Center',
  description:
    'TicketGo Teknoloji A.Ş. tarafından yayınlanan uygulama ve yazılımların güncel sürümlerine güvenli şekilde erişin.',
  alternates: { canonical: `${BRAND_SITE_URL}/download` },
  openGraph: {
    title: `Download Center | ${BRAND_LEGAL_NAME}`,
    description:
      'TicketGo Teknoloji A.Ş. tarafından yayınlanan uygulama ve yazılımların güncel sürümlerine güvenli şekilde erişin.',
    url: `${BRAND_SITE_URL}/download`,
  },
};

const trustSignals = [
  { label: 'Güvenli İndirme', Icon: ShieldCheck },
  { label: 'Güncel Sürümler', Icon: BadgeCheck },
  { label: 'Doğrulanmış Paketler', Icon: PackageCheck },
] as const;

const securityCards = [
  {
    title: 'Doğrulanmış Paketler',
    body: 'Yayınlanan paketler yalnızca TicketGo Teknoloji A.Ş. tarafından onaylanan kaynaklardan listelenir. Checksum ve imza alanları gerçek değerler girildiğinde kayıtlarla birlikte saklanır.',
    Icon: PackageCheck,
  },
  {
    title: 'Sürüm Kontrolü',
    body: 'Her paket için sürüm, platform ve yayın tarihi admin yüklemesi sırasında kaydedilir. Böylece kullanıcılar güncel sürümü kolayca ayırt edebilir.',
    Icon: BadgeCheck,
  },
  {
    title: 'Güvenli Dağıtım',
    body: 'Dosyalar public klasöründe tutulmaz. İndirme, server-side ödeme doğrulaması ve yetki kontrolünden sonra güvenli endpoint üzerinden yapılır.',
    Icon: Lock,
  },
] as const;

export default function DownloadPage() {
  return (
    <main>
      <section className="hero-section hero-accent">
        <div className="section-wrap section-y">
          <p className="eyebrow">DOWNLOAD CENTER</p>
          <h1 className="section-title mt-3 max-w-3xl">
            TicketGo Teknoloji Yazılımlarını İndirin
          </h1>
          <p className="section-subtitle">
            TicketGo Teknoloji A.Ş. tarafından geliştirilen uygulama, masaüstü yazılımı ve yardımcı
            araçların güncel sürümlerine güvenli şekilde erişin.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2.5" aria-label="Güven göstergeleri">
            {trustSignals.map(({ label, Icon }) => (
              <li
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-soft"
              >
                <Icon size={14} className="text-brand-600" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section-muted">
        <div className="section-wrap section-y">
          <DownloadTable />
        </div>
      </section>

      <section className="section-wrap section-y" aria-labelledby="secure-distribution-title">
        <div className="max-w-2xl">
          <h2 id="secure-distribution-title" className="section-title">
            Güvenli Yazılım Dağıtımı
          </h2>
          <p className="section-subtitle">
            TicketGo Teknoloji, yayınladığı yazılımları kontrollü bir katalog üzerinden sunmayı
            hedefler. Paket doğrulama alanları gerçek teknik değerler hazır olduğunda şeffaf biçimde
            paylaşılır; henüz doğrulanmamış iddialar öne sürülmez.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {securityCards.map(({ title, body, Icon }) => (
            <article key={title} className="site-card">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-[var(--bg-accent)] text-brand-600">
                <Icon size={18} aria-hidden />
              </div>
              <h3 className="mt-4 text-base font-semibold tracking-[-0.02em] text-ink">{title}</h3>
              <p className="mt-2 text-sm font-normal leading-[1.7] text-muted">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <DownloadSupportCta />
    </main>
  );
}
