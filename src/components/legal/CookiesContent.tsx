import { COMPANY } from '@/config/company';
import { LegalSection } from '@/components/legal/LegalDocument';

export const COOKIES_TOC = [
  { id: 'zorunlu-cerezler', label: 'Zorunlu çerezler' },
  { id: 'performans-cerezleri', label: 'Performans çerezleri' },
  { id: 'tercih-cerezleri', label: 'Tercih çerezleri' },
  { id: 'guvenlik-cerezleri', label: 'Güvenlik çerezleri' },
  { id: 'cerezleri-nasil-yonetebilirsiniz', label: 'Çerezleri nasıl yönetebilirsiniz?' },
] as const;

const categories = [
  {
    id: 'zorunlu-cerezler',
    title: 'Zorunlu çerezler',
    text: 'Sitenin temel işlevlerinin çalışması, oturumun korunması ve güvenlik kontrolleri için gerekli olabilir. Bu çerezler olmadan bazı temel fonksiyonlar sunulamayabilir.',
  },
  {
    id: 'performans-cerezleri',
    title: 'Performans çerezleri',
    text: 'Sayfa performansını ölçmek için kullanılabilir. Bu kurumsal sitede Google Analytics veya benzeri bir ölçüm aracı şu anda aktif değildir.',
  },
  {
    id: 'tercih-cerezleri',
    title: 'Tercih çerezleri',
    text: 'Dil veya arayüz tercihlerini hatırlamak için kullanılabilir. Şu anda bu sitede tercih kaydı tutan ayrı bir çerez sistemi bulunmamaktadır.',
  },
  {
    id: 'guvenlik-cerezleri',
    title: 'Güvenlik çerezleri',
    text: 'Yetkisiz erişim ve kötüye kullanımı azaltmaya yardımcı teknik kayıtlar için kullanılabilir.',
  },
] as const;

export function CookiesContent({ omitChrome = false }: { omitChrome?: boolean }) {
  return (
    <div className={omitChrome ? 'legal-content-modal space-y-8' : 'space-y-8'}>
      {!omitChrome ? (
        <div className="border-b border-line pb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">{COMPANY.legalName}</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink sm:text-2xl">Çerez Politikası</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            {COMPANY.legalName} kurumsal web sitesi, temel işlevlerin sunulması ve güvenliğin sağlanması amacıyla sınırlı
            teknik çerezler kullanabilir. Reklam, pazarlama veya üçüncü taraf izleme çerezleri kullanılmamaktadır.
          </p>
        </div>
      ) : null}

      {categories.map((item) => (
        <LegalSection key={item.id} id={item.id} title={item.title} level={3}>
          <p>{item.text}</p>
        </LegalSection>
      ))}

      <LegalSection id="cerezleri-nasil-yonetebilirsiniz" title="Çerezleri nasıl yönetebilirsiniz?" level={3}>
        <p>
          Tarayıcı ayarlarınızdan çerezleri silebilir veya engelleyebilirsiniz. Zorunlu çerezlerin kapatılması sitenin
          bazı bölümlerinin çalışmasını etkileyebilir.
        </p>
        <p>
          Bu sitede reklam ve analitik çerezleri kullanılmadığı için ayrı bir pazarlama onay katmanı sunulmamaktadır.
          Çerez uygulaması değişirse bu politika güncellenir.
        </p>
        <p>
          Sorularınız için{' '}
          <a href={`mailto:${COMPANY.emails.info}`} className="email-link font-semibold text-brand-600">
            {COMPANY.emails.info}
          </a>{' '}
          adresine yazabilirsiniz.
        </p>
      </LegalSection>
    </div>
  );
}
