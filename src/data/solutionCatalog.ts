import {
  Bot,
  Building2,
  LayoutPanelTop,
  Monitor,
  ShoppingBag,
  Smartphone,
  Store,
} from 'lucide-react';
import { platformSolutions, serviceSolutions, type SolutionDetail } from '@/data/solutions';

function findSolution(id: string): SolutionDetail {
  const item = [...platformSolutions, ...serviceSolutions].find((entry) => entry.id === id);
  if (!item) throw new Error(`Solution not found: ${id}`);
  return item;
}

function enrich(
  item: SolutionDetail,
  extras: Pick<SolutionDetail, 'integrations' | 'benefits'> & { ctaLabel?: string }
): SolutionDetail {
  return {
    ...item,
    integrations: extras.integrations,
    benefits: extras.benefits,
    ctaLabel: extras.ctaLabel ?? 'Bu Çözümü Konuşalım',
  };
}

const extraSolutions: SolutionDetail[] = [
  {
    id: 'web-apps',
    title: 'Web Uygulamaları',
    subtitle: 'Tarayıcı üzerinden erişilen, yönetilebilir ve ölçeklenebilir iş uygulamaları.',
    description:
      'Web uygulamaları; kullanıcı paneli, yönetim ekranı ve operasyon süreçlerini tek bir erişilebilir yüzeyde birleştirir. Performans, güvenlik ve responsive deneyim aynı tasarımda ele alınır.',
    Icon: Monitor,
    features: ['Responsive arayüz', 'Kullanıcı paneli', 'Yönetim ekranı', 'Kimlik doğrulama', 'API bağlantısı', 'Bildirim'],
    problems: ['Dağınık masaüstü araçlar', 'Mobilde kırılan ekranlar', 'Güncellenmesi zor arayüzler'],
    useCases: ['Kurumsal portallar', 'Self-servis paneller', 'İç operasyon uygulamaları'],
    process: ['Keşif', 'UX', 'Geliştirme', 'Test', 'Yayın'],
    processLabel: 'Örnek süreç',
    visual: 'process',
    integrations: ['REST API', 'Kimlik sağlayıcıları', 'E-posta', 'Analitik'],
    benefits: ['Tek noktadan erişim', 'Cihaz bağımsız kullanım', 'Merkezi güncelleme'],
    ctaLabel: 'Bu Çözümü Konuşalım',
    contactType: 'Web Uygulaması',
    ctaMessage: 'Web uygulaması geliştirme hakkında bilgi almak istiyorum.',
    cardImage: '/images/solutions/web-applications.webp',
  },
  {
    id: 'mobile-apps',
    title: 'Mobil Uygulamalar',
    subtitle: 'Saha ekipleri ve müşteriler için erişilebilir mobil deneyimler.',
    description:
      'Mobil uygulamalar; saha, müşteri ve operasyon süreçlerini cep telefonuna taşır. Kimlik doğrulama, bildirim ve API katmanı ürünün doğal parçası olarak kurgulanır.',
    Icon: Smartphone,
    features: ['iOS / Android yaklaşımı', 'Bildirim', 'Çevrimdışı senaryolar', 'Kimlik doğrulama', 'API entegrasyonu', 'Saha paneli'],
    problems: ['Saha verisinin geç iletilmesi', 'Masaüstü bağımlılığı', 'Kopuk müşteri deneyimi'],
    useCases: ['Saha operasyonu', 'Müşteri uygulamaları', 'Acente ekipleri'],
    process: ['İhtiyaç', 'UX', 'Geliştirme', 'Test', 'Yayın'],
    processLabel: 'Örnek süreç',
    visual: 'process',
    integrations: ['Push bildirim', 'REST API', 'Konum servisleri', 'Ödeme'],
    benefits: ['Sahada hızlı kayıt', 'Anlık bildirim', 'Müşteriye yakın deneyim'],
    ctaLabel: 'Bu Çözümü Konuşalım',
    contactType: 'Mobil Uygulama',
    ctaMessage: 'Mobil uygulama projesi hakkında bilgi almak istiyorum.',
    cardImage: '/images/solutions/mobile-applications.webp',
  },
  {
    id: 'ai-integrations',
    title: 'AI Entegrasyonları',
    subtitle: 'Mevcut iş sistemlerine bağlanabilen yapay zekâ servis katmanı.',
    description:
      'Yapay zekâyı ayrı bir gösteri katmanı olarak değil; arama, sınıflandırma, özetleme ve asistan senaryolarını mevcut ürüne ekleyen bir servis olarak ele alırız. Hangi yeteneğin uygulanacağı proje ihtiyacına göre belirlenir.',
    Icon: Bot,
    features: [
      'AI servis entegrasyonu',
      'Doğal dil arama',
      'Sınıflandırma',
      'Özetleme',
      'Asistan senaryoları',
      'Workflow tetikleri',
    ],
    problems: ['Manuel sınıflandırma yükü', 'Bilgiye geç ulaşma', 'Tekrarlayan destek soruları'],
    useCases: ['Destek süreçleri', 'Doküman işleme', 'İç bilgi tabanı', 'Rapor özeti'],
    process: ['Veri', 'Servis seçimi', 'Entegrasyon', 'Kontrol', 'İyileştirme'],
    processLabel: 'Örnek süreç',
    visual: 'process',
    integrations: ['LLM servisleri', 'Kurumsal bilgi tabanı', 'CRM', 'Destek paneli'],
    benefits: ['Tekrarlayan işlerin azalması', 'Daha hızlı bilgiye erişim', 'Mevcut sistemle birlikte çalışma'],
    ctaLabel: 'Bu Çözümü Konuşalım',
    contactType: 'AI Entegrasyonu',
    ctaMessage: 'Yapay zekâ entegrasyonu hakkında bilgi almak istiyorum.',
    cardImage: '/images/solutions/ai-integrations.webp',
  },
  {
    id: 'b2b-platforms',
    title: 'B2B Platformları',
    subtitle: 'İş ortakları, acenteler ve tedarik kanalları için ortak çalışma yüzeyi.',
    description:
      'B2B platformları; fiyat, stok, sipariş veya rezervasyon gibi iş ortağı süreçlerini yetkili bir kanalda toplar. Rol bazlı erişim ve raporlama, kanalın kontrolünü kolaylaştırır.',
    Icon: Building2,
    features: ['İş ortağı paneli', 'Rol bazlı erişim', 'Sipariş / rezervasyon', 'Fiyat görünümü', 'Raporlama', 'API'],
    problems: ['E-posta ile yürüyen bayi süreçleri', 'Fiyat ve kontenjan karmaşası', 'Kanal görünürlüğünün zayıf olması'],
    useCases: ['Acente ağı', 'Bayi satış', 'Tedarikçi portalı'],
    process: ['Kayıt', 'Yetki', 'İşlem', 'Onay', 'Rapor'],
    processLabel: 'Örnek süreç',
    visual: 'process',
    integrations: ['CRM', 'ERP', 'Ödeme', 'Bildirim'],
    benefits: ['Kanalın tek yerden izlenmesi', 'Yetkili satış', 'Daha az manuel mutabakat'],
    ctaLabel: 'Bu Çözümü Konuşalım',
    contactType: 'B2B Platformu',
    ctaMessage: 'B2B platform çözümü hakkında bilgi almak istiyorum.',
    cardImage: '/images/solutions/b2b-platform.webp',
  },
  {
    id: 'customer-portals',
    title: 'Müşteri Portalları',
    subtitle: 'Müşterinin talep, belge ve süreçlerini self-servis olarak yönetebileceği dijital alan.',
    description:
      'Müşteri portalları; kayıt, talep, doküman ve durum takibini müşteriye açar. Destek ekibi aynı kaydı içeriden görür; tekrarlayan sorular azalır.',
    Icon: Store,
    features: ['Self-servis kayıt', 'Talep takibi', 'Doküman paylaşımı', 'Bildirim', 'Durum görünümü', 'Destek paneli'],
    problems: ['Müşterinin sürece kör kalması', 'Tekrarlayan destek çağrıları', 'Belge paylaşımının dağınık olması'],
    useCases: ['Hizmet müşterileri', 'Abonelik panelleri', 'Proje paydaşları'],
    process: ['Giriş', 'Talep', 'İşlem', 'Bilgilendirme', 'Kapanış'],
    processLabel: 'Örnek süreç',
    visual: 'process',
    integrations: ['CRM', 'E-posta', 'SMS', 'Doküman deposu'],
    benefits: ['Müşteriye şeffaflık', 'Destek yükünün azalması', 'Kayıtlı iletişim'],
    ctaLabel: 'Bu Çözümü Konuşalım',
    contactType: 'Müşteri Portalı',
    ctaMessage: 'Müşteri portalı hakkında bilgi almak istiyorum.',
    cardImage: '/images/solutions/customer-portal.webp',
  },
  {
    id: 'admin-panels',
    title: 'Yönetim Panelleri',
    subtitle: 'İç ekiplerin kullanıcı, içerik, süreç ve yetkileri yönettiği kontrol katmanı.',
    description:
      'Yönetim panelleri; ürünün arkasındaki operasyonu görünür kılar. Kullanıcı, içerik, onay ve raporlama aynı yetki modelinde tutulur.',
    Icon: LayoutPanelTop,
    features: ['Kullanıcı yönetimi', 'Rol ve yetki', 'İçerik / kayıt yönetimi', 'Onay ekranları', 'Loglama', 'Rapor'],
    problems: ['Veritabanına doğrudan müdahale', 'Yetkisiz işlem riski', 'Operasyonun görünmemesi'],
    useCases: ['Ürün yönetimi', 'İç operasyon', 'Destek ekipleri'],
    process: ['Yetki', 'İşlem', 'Onay', 'Kayıt', 'Rapor'],
    processLabel: 'Örnek süreç',
    visual: 'process',
    integrations: ['Kimlik katmanı', 'API', 'Log servisi', 'Bildirim'],
    benefits: ['Kontrollü operasyon', 'İzlenebilir işlem', 'Ekibin kendi başına yönetmesi'],
    ctaLabel: 'Bu Çözümü Konuşalım',
    contactType: 'Yönetim Paneli',
    ctaMessage: 'Yönetim paneli çözümü hakkında bilgi almak istiyorum.',
    cardImage: '/images/solutions/admin-panel.webp',
  },
  {
    id: 'ecommerce-integrations',
    title: 'E-Ticaret Entegrasyonları',
    subtitle: 'Sipariş, stok, ödeme ve müşteri verisini mevcut sistemlerle bağlayan entegrasyon katmanı.',
    description:
      'E-ticaret entegrasyonları; mağaza, ERP, kargo veya ödeme servisleri arasında veri bütünlüğü kurar. Amaç, siparişin manuel aktarılmadan ilgili sistemlere ulaşmasıdır.',
    Icon: ShoppingBag,
    features: ['Sipariş aktarımı', 'Stok senkronu', 'Ödeme bildirimi', 'Müşteri kaydı', 'Webhook', 'Hata logu'],
    problems: ['Çift kayıt', 'Stok gecikmesi', 'Manuel sipariş aktarımı'],
    useCases: ['Online mağaza', 'Pazaryeri köprüsü', 'ERP bağlantısı'],
    architecture: ['Mağaza', 'Ödeme', 'ERP', 'Kargo', 'Bildirim'],
    visual: 'architecture',
    integrations: ['Ödeme', 'ERP', 'Kargo', 'SMS', 'E-posta'],
    benefits: ['Siparişin doğru sisteme düşmesi', 'Stok görünürlüğü', 'Daha az manuel iş'],
    ctaLabel: 'Bu Çözümü Konuşalım',
    contactType: 'E-Ticaret Entegrasyonu',
    ctaMessage: 'E-ticaret entegrasyonu hakkında bilgi almak istiyorum.',
    cardImage: '/images/solutions/ecommerce-integrations.webp',
  },
];

export const solutionCatalog: SolutionDetail[] = [
  enrich(findSolution('crm-platform'), {
    integrations: ['REST API', 'E-posta', 'SMS', 'Muhasebe / ERP', 'Webhook'],
    benefits: ['Tek müşteri görünümü', 'Satış hattının izlenmesi', 'Ekip içi bilgi kaybının azalması'],
  }),
  enrich(findSolution('custom-software'), {
    integrations: ['Mevcut ERP / CRM', 'REST API', 'Kimlik sağlayıcıları', 'Rapor katmanı'],
    benefits: ['Sürece uygun ürün', 'Hazır paketin sınırlarına takılmama', 'Kontrollü büyüme'],
  }),
  enrich(findSolution('saas'), {
    integrations: ['Billing', 'E-posta', 'API', 'Kimlik doğrulama'],
    benefits: ['Çok kullanıcılı yapı', 'Abonelik yönetimine hazır mimari', 'Rol bazlı erişim'],
  }),
  enrich(findSolution('ticketing'), {
    integrations: ['Ödeme', 'SMS', 'E-posta', 'Acente API', 'Mobil uygulama'],
    benefits: ['Uçtan uca rezervasyon akışı', 'Kapasite kontrolü', 'Operasyonun satışla bağlanması'],
  }),
  enrich(findSolution('operations'), {
    integrations: ['Bildirim', 'CRM', 'E-posta', 'Dosya / log katmanı'],
    benefits: ['Görev kaybının azalması', 'SLA takibi', 'Departmanlar arası görünürlük'],
  }),
  enrich(findSolution('sales'), {
    integrations: ['CRM', 'E-posta', 'Takvim', 'Teklif şablonları'],
    benefits: ['Pipeline görünürlüğü', 'Teklif sürecinin kayıt altına alınması', 'Satış performansının izlenmesi'],
  }),
  extraSolutions[0],
  extraSolutions[1],
  enrich(findSolution('dashboards'), {
    integrations: ['Veri kaynakları', 'Export', 'Rol bazlı görünüm', 'API'],
    benefits: ['Tek ekranda özet', 'Daha hızlı karar desteği', 'Rolüne göre rapor'],
  }),
  enrich(findSolution('api-platform'), {
    integrations: ['ERP', 'Ödeme', 'SMS', 'E-posta', 'Harici servis'],
    benefits: ['Sistemlerin konuşması', 'Manuel aktarımın azalması', 'İzlenebilir entegrasyon'],
  }),
  enrich(findSolution('automation'), {
    integrations: ['Webhook', 'E-posta', 'CRM', 'Zamanlanmış görevler'],
    benefits: ['Tekrarlayan işlerin azalması', 'Onayların gecikmemesi', 'Durum güncellemelerinin kaydı'],
  }),
  extraSolutions[2],
  extraSolutions[3],
  extraSolutions[4],
  extraSolutions[5],
  extraSolutions[6],
];
