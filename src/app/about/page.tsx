import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ShieldCheck,
  Layers,
  GitMerge,
  Database,
  BrainCircuit,
  TrendingUp,
  RefreshCw,
  Globe,
  ExternalLink,
} from 'lucide-react';
import {
  AboutWhatWeDo,
  AboutTechPrinciples,
  AboutProcess,
} from '@/components/AboutFeatureGrids';
import { SurfaceCard } from '@/components/SurfaceCard';
import { TicketGoProduct } from '@/components/TicketGoProduct';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { createMailto } from '@/lib/mailto';
import {
  BRAND_LEGAL_NAME,
  BRAND_SITE_URL,
  BRAND_INFO_EMAIL,
} from '@/lib/site';

export const metadata: Metadata = {
  title: 'Hakkımızda',
  description:
    'TicketGo Teknoloji A.Ş.; kurumsal yazılım, CRM, SaaS, dijital platform, web ve mobil uygulama, API entegrasyonu, yapay zekâ ve otomasyon çözümleri geliştiren bir teknoloji şirketidir.',
  alternates: { canonical: `${BRAND_SITE_URL}/about` },
};

const visionMissionItems = [
  'Güvenli sistemler geliştirmek',
  'Ölçeklenebilir mimari kurmak',
  'Gerçek iş problemini anlamak',
  'İhtiyaca uygun teknolojiyi seçmek',
  'Kullanıcı deneyimini tasarımın parçası yapmak',
  'Entegrasyona açık sistemler oluşturmak',
  'Sürdürülebilir kod üretmek',
] as const;

const sectorList = [
  'Ulaşım & Mobilite',
  'Turizm & Konaklama',
  'Perakende & E-Ticaret',
  'Finans & Ödeme',
  'Sağlık Teknolojileri',
  'Lojistik & Dağıtım',
  'Gayrimenkul',
  'Üretim & Sanayi',
  'Eğitim Teknolojileri',
  'Kurumsal Hizmetler',
  'B2B Platformları',
  'Rezervasyon & Hizmet',
] as const;

export default function AboutPage() {
  return (
    <main>
      {/* ── HERO ──────────────────────────────────────────────────── */}
      <section className="hero-section hero-accent">
        <div className="section-wrap section-y scroll-section">
          <p className="mb-4 inline-flex rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-semibold text-ink">
            {BRAND_LEGAL_NAME}
          </p>
          <h1 className="section-title">Teknolojiyi İşinize Dönüştürüyoruz</h1>
          <p className="section-subtitle max-w-3xl">
            TicketGo Teknoloji A.Ş., işletmelerin dijital dönüşüm süreçlerini hızlandıran, ölçeklenebilir yazılım
            ürünleri ve kurumsal teknoloji çözümleri geliştiren yeni nesil bir teknoloji şirketidir.
          </p>
          <p className="mt-3 text-sm text-muted">
            <Globe size={13} className="mr-1 inline-block align-middle opacity-70" aria-hidden />
            www.ticketgoteknoloji.com
          </p>
        </div>
      </section>

      {/* ── BİZ KİMİZ ─────────────────────────────────────────────── */}
      <section className="section-wrap pb-16 lg:pb-20">
        <SurfaceCard className="p-8 md:p-12">
          <h2 className="text-2xl font-semibold text-ink md:text-3xl">Biz Kimiz?</h2>
          <div className="mt-5 max-w-4xl space-y-4 text-sm leading-7 text-muted">
            <p>
              TicketGo Teknoloji A.Ş., işletmelerin teknoloji ihtiyaçlarını analiz eden; yazılım, dijital platform,
              otomasyon ve entegrasyon çözümleri geliştiren yenilikçi bir teknoloji şirketidir.
            </p>
            <p>
              Modern yazılım mimarileri ve ölçeklenebilir teknoloji altyapıları kullanarak farklı sektörlerde faaliyet
              gösteren işletmeler için güvenli, sürdürülebilir ve yüksek performanslı dijital sistemler geliştiriyoruz.
            </p>
            <p>
              Kurumsal yazılım geliştirmeden CRM sistemlerine, web ve mobil uygulamalardan API entegrasyonlarına, veri
              analitiğinden yapay zekâ destekli çözümlere kadar geniş bir teknoloji alanında uçtan uca hizmet sunuyoruz.
            </p>
            <p>
              Amacımız yalnızca yazılım geliştirmek değil; işletmelerin operasyonlarını daha verimli yönetmesini,
              müşterilerine daha iyi dijital deneyimler sunmasını ve teknolojiyi sürdürülebilir bir büyüme aracına
              dönüştürmesini sağlamaktır.
            </p>
            <p>
              Modüler ve API odaklı yazılım mimarimiz sayesinde geliştirdiğimiz platformlar farklı sistemler, ödeme
              altyapıları, üçüncü taraf servisler, mobil uygulamalar, CRM çözümleri ve kurumsal yazılımlarla entegre
              çalışabilecek şekilde yapılandırılabilir.
            </p>
            <p>
              Kendi teknoloji ürünlerimizi geliştirmenin yanında, işletmeler için özel yazılım ve dijital platformlar da
              tasarlıyoruz. TicketGo Teknoloji bünyesinde geliştirilen ürünlerden elde edilen gerçek operasyon
              deneyimini kurumsal müşterilerimiz için geliştirdiğimiz sistemlere aktarıyoruz.
            </p>
          </div>
        </SurfaceCard>
      </section>

      {/* ── VİZYON & MİSYON ──────────────────────────────────────── */}
      <section className="section-wrap grid gap-5 pb-16 lg:pb-20 md:grid-cols-2">
        <SurfaceCard className="p-8">
          <h2 className="text-xl font-semibold text-ink">Vizyonumuz</h2>
          <p className="mt-4 text-sm leading-7 text-muted">
            Türkiye&apos;den geliştirilen yenilikçi teknoloji ürünlerini ulusal ve uluslararası pazarlara taşıyan;
            yazılım, yapay zekâ, otomasyon ve dijital platform teknolojilerinde güvenilir ve sürdürülebilir bir
            teknoloji markası olmak.
          </p>
        </SurfaceCard>
        <SurfaceCard className="p-8">
          <h2 className="text-xl font-semibold text-ink">Misyonumuz</h2>
          <p className="mt-3 mb-4 text-sm leading-7 text-muted">
            İşletmelerin karmaşık teknoloji ihtiyaçlarını sade, güvenli ve ölçeklenebilir dijital çözümlere
            dönüştürmek; geliştirdiğimiz yazılım ve teknoloji altyapılarıyla müşterilerimizin operasyonel verimliliğini
            ve dijital rekabet gücünü artırmak.
          </p>
          <ul className="space-y-2 text-sm text-muted">
            {visionMissionItems.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 shrink-0 text-brand-600" size={15} aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </SurfaceCard>
      </section>

      {/* ── NE GELİŞTİRİYORUZ ─────────────────────────────────────── */}
      <section className="section-wrap pb-16 lg:pb-20">
        <h2 className="section-title">Ne Geliştiriyoruz?</h2>
        <p className="section-subtitle">
          Kurumsal yazılımdan yapay zekâ entegrasyonuna, CRM sistemlerinden ödeme teknolojilerine kadar geniş bir
          teknoloji alanında çözümler üretiyoruz.
        </p>
        <AboutWhatWeDo />
      </section>

      {/* ── TEKNOLOJİ PRENSİPLERİ ────────────────────────────────── */}
      <section className="section-muted">
        <div className="section-wrap section-y">
          <h2 className="section-title">Teknoloji Prensipleri</h2>
          <p className="section-subtitle">
            Her projede önce iş ihtiyacını anlar; ardından güvenlik, entegrasyon ve ölçeklenebilirliği aynı mimaride
            ele alırız.
          </p>
          <AboutTechPrinciples />
        </div>
      </section>

      {/* ── NASIL ÇALIŞIYORUZ ─────────────────────────────────────── */}
      <section className="section-wrap section-y">
        <h2 className="section-title">Nasıl Çalışıyoruz?</h2>
        <p className="section-subtitle">
          Keşiften yayına, bakımdan sürekli gelişime kadar teknoloji yolculuğunun tamamında çözüm ortağı olarak
          çalışıyoruz.
        </p>
        <AboutProcess />
      </section>

      {/* ── SEKTÖREL YAKLAŞIM ─────────────────────────────────────── */}
      <section className="section-muted">
        <div className="section-wrap section-y">
          <h2 className="section-title">Teknolojiyi Farklı Sektörlerin İhtiyaçlarına Uyarlıyoruz</h2>
          <p className="section-subtitle max-w-3xl">
            Her sektörün operasyonel yapısı, kullanıcı beklentileri ve teknoloji ihtiyaçları farklıdır. TicketGo
            Teknoloji, geliştirdiği modüler yazılım mimarilerini sektörlerin gerçek iş süreçlerine göre uyarlayarak
            ihtiyaca özel dijital çözümler oluşturur.
          </p>
          <div className="mt-10 flex flex-wrap gap-2">
            {sectorList.map((sector) => (
              <span
                key={sector}
                className="rounded-full border border-line bg-surface px-4 py-1.5 text-sm font-medium text-ink"
              >
                {sector}
              </span>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted">
            Sektöre özel çözümler için{' '}
            <Link href="/solutions" className="font-medium text-brand-600 underline-offset-2 hover:underline">
              Çözümlerimiz
            </Link>{' '}
            sayfasını inceleyebilirsiniz.
          </p>
        </div>
      </section>

      {/* ── GELİŞTİRDİĞİMİZ PLATFORMLAR: Ticket-Go ───────────────── */}
      <section className="section-wrap pb-16 lg:pb-20">
        <h2 className="section-title">Geliştirdiğimiz Platformlar</h2>
        <p className="section-subtitle">
          Kendi ürün geliştirme süreçlerimiz, kurumsal müşterilerimiz için ürettiğimiz sistemlerin kalitesini doğrudan
          besler.
        </p>
        <div className="mt-10">
          <TicketGoProduct compact />
        </div>
      </section>

      {/* ── KURUMSAL CTA ──────────────────────────────────────────── */}
      <section className="section-muted">
        <div className="section-wrap section-y">
          <div className="relative overflow-hidden rounded-2xl border border-line bg-surface px-8 py-10 shadow-soft md:px-12 md:py-14">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(640px_240px_at_0%_0%,rgba(213,189,138,0.18),transparent_60%)]" />
            <div className="relative">
              <h2 className="text-2xl font-semibold text-ink md:text-3xl">
                Teknoloji İhtiyacınızı Birlikte Tasarlayalım
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
                Yeni bir dijital ürün geliştirmek, mevcut sistemlerinizi modernize etmek veya operasyonlarınıza özel
                bir teknoloji çözümü oluşturmak için TicketGo Teknoloji ekibiyle iletişime geçin.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/contact" className="btn btn-primary">
                  Projenizi Konuşalım
                </Link>
                <a
                  href={createMailto({
                    to: BRAND_INFO_EMAIL,
                    subject: 'TicketGo Teknoloji | Proje Görüşmesi',
                    body: 'Merhaba TicketGo Teknoloji Ekibi,\n\nTeknolojiyle ilgili bir proje görüşmek istiyorum.\n\nProjem hakkında:\n',
                  })}
                  className="btn btn-secondary"
                >
                  E-posta ile İletişim
                </a>
                <WhatsAppButton
                  message="Merhaba TicketGo Teknoloji, teknoloji projem hakkında bilgi almak istiyorum."
                  label="WhatsApp ile Görüş"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
