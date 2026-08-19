import { COMPANY } from '@/config/company';
import { LEGAL_VERSIONS, formatLegalDate } from '@/lib/legal/versions';

const categories = [
  {
    title: 'Zorunlu çerezler',
    text: 'Sitenin temel işlevlerinin çalışması, oturumun korunması ve güvenlik kontrolleri için gerekli olabilir. Bu çerezler olmadan bazı temel fonksiyonlar sunulamayabilir.',
  },
  {
    title: 'Performans çerezleri',
    text: 'Sayfa performansını ölçmek için kullanılabilir. Bu kurumsal sitede Google Analytics veya benzeri bir ölçüm aracı şu anda aktif değildir.',
  },
  {
    title: 'Tercih çerezleri',
    text: 'Dil veya arayüz tercihlerini hatırlamak için kullanılabilir. Şu anda bu sitede tercih kaydı tutan ayrı bir çerez sistemi bulunmamaktadır.',
  },
  {
    title: 'Güvenlik çerezleri',
    text: 'Yetkisiz erişim ve kötüye kullanımı azaltmaya yardımcı teknik kayıtlar için kullanılabilir.',
  },
] as const;

export function CookiesContent() {
  const doc = LEGAL_VERSIONS.privacy; // cookies uses same version style

  return (
    <div className="space-y-8 text-sm leading-7 text-ink">
      <div className="border-b border-line pb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
          {COMPANY.legalName}
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          Çerez Politikası
        </h2>
        <p className="mt-1 text-xs text-muted">Son güncelleme: {formatLegalDate(doc.updatedAt)}</p>
        <p className="mt-3 text-sm leading-6 text-muted">
          {COMPANY.legalName} kurumsal web sitesi, temel işlevlerin sunulması ve güvenliğin sağlanması
          amacıyla sınırlı teknik çerezler kullanabilir. Reklam, pazarlama veya üçüncü taraf izleme
          çerezleri kullanılmamaktadır.
        </p>
      </div>

      <div className="space-y-6">
        {categories.map((item) => (
          <section key={item.title}>
            <h3 className="text-base font-semibold text-ink">{item.title}</h3>
            <p className="mt-2 text-muted">{item.text}</p>
          </section>
        ))}

        <section>
          <h3 className="text-base font-semibold text-ink">Çerezleri nasıl yönetebilirsiniz?</h3>
          <p className="mt-2 text-muted">
            Tarayıcı ayarlarınızdan çerezleri silebilir veya engelleyebilirsiniz. Zorunlu çerezlerin
            kapatılması sitenin bazı bölümlerinin çalışmasını etkileyebilir.
          </p>
          <p className="mt-2 text-muted">
            Bu sitede reklam ve analitik çerezleri kullanılmadığı için ayrı bir pazarlama onay katmanı
            sunulmamaktadır. Çerez uygulaması değişirse bu politika güncellenir.
          </p>
          <p className="mt-2 text-muted">
            Sorularınız için{' '}
            <a href={`mailto:${COMPANY.emails.info}`} className="email-link font-semibold text-brand-600">
              {COMPANY.emails.info}
            </a>{' '}
            adresine yazabilirsiniz.
          </p>
        </section>
      </div>
    </div>
  );
}
