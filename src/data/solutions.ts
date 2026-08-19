import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Blocks,
  ChartNoAxesCombined,
  Cpu,
  GitMerge,
  LayoutDashboard,
  LayoutGrid,
  MonitorSmartphone,
  ServerCog,
  Ticket,
  Users,
  Workflow,
} from 'lucide-react';

export type SolutionVisual = 'process' | 'dashboard' | 'architecture';

export type SolutionDetail = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  Icon: LucideIcon;
  features: string[];
  problems: string[];
  useCases: string[];
  process?: string[];
  processLabel?: string;
  architecture?: string[];
  visual?: SolutionVisual;
  problemsLabel?: string;
  featuresLabel?: string;
  introLabel?: string;
  useCasesLabel?: string;
  modalTitle?: string;
  integrations?: string[];
  benefits?: string[];
  analytics?: string[];
  automation?: string[];
  aiExtensions?: string[];
  securityNotes?: string[];
  productExample?: { title: string; text: string; href?: string };
  category?: string;
  hoverHints?: string[];
  tags?: string[];
  technicalApproach?: string;
  hoverActionLabel?: string;
  benefitsLabel?: string;
  integrationsLabel?: string;
  analyticsLabel?: string;
  exampleFlow?: string[];
  exampleFlowLabel?: string;
  footerNote?: string;
  ctaHref?: string;
  ctaLabel: string;
  contactType: string;
  ctaMessage: string;
  /** CSS class applied as a decorative background accent layer on the card. */
  cardAccent?: string;
  /** Path to the card cover image shown at the top of the card. */
  cardImage?: string;
};

export const platformSolutions: SolutionDetail[] = [
  {
    id: 'crm-platform',
    title: 'Kurumsal CRM Platformu',
    subtitle: 'Müşteri ilişkilerini, satış süreçlerini ve ekip aktivitelerini tek merkezden yönetin.',
    description:
      'Kurumsal CRM altyapısı; müşteri, firma, satış ve operasyon verilerini tek bir kayıt omurgasında birleştirir. Ekipler aynı müşteri görünümü üzerinden çalışır, fırsatlar izlenebilir hale gelir ve raporlama dağınık tablolara bağlı kalmaz.',
    Icon: Workflow,
    features: [
      'Müşteri bilgilerinin merkezi yönetimi',
      'Firma ve hesap yönetimi',
      'Potansiyel müşteri / lead yönetimi',
      'Satış fırsatları',
      'Teklif ve satış süreci',
      'Aktivite ve görev takibi',
      'İletişim geçmişi',
      'Kullanıcı yetkilendirme',
      'Dashboard',
      'Raporlama',
      'Otomasyon',
      'API entegrasyonları',
    ],
    problems: [
      'Dağınık müşteri verileri',
      'Satış fırsatlarının takip edilememesi',
      'Ekip içi bilgi kaybı',
      'Manuel takip süreçleri',
      'Raporlama eksikliği',
    ],
    useCases: ['B2B satış', 'Hizmet operasyonu', 'Kurumsal hesap yönetimi', 'Müşteri destek süreçleri'],
    process: ['Lead', 'Müşteri', 'Fırsat', 'Teklif', 'Satış', 'Takip'],
    processLabel: 'Örnek Süreç',
    visual: 'process',
    problemsLabel: 'Hangi İhtiyaçları Çözer?',
    ctaLabel: 'CRM Projenizi Konuşalım',
    contactType: 'Kurumsal CRM',
    ctaMessage: 'Kurumsal CRM çözümü hakkında bilgi almak istiyorum.',
    cardImage: '/images/solutions/crm-platform.webp',
  },
  {
    id: 'ticketing',
    title: 'Rezervasyon ve Biletleme Sistemleri',
    subtitle: 'Rezervasyondan ödemeye, biletten operasyona kadar uçtan uca dijital altyapı.',
    description:
      'Rezervasyon ve biletleme çözümleri; kapasite, satış, ödeme ve operasyon adımlarını tek ürün akışında birleştirir. Ticket-Go gibi uçtan uca dijital platform deneyimi, bu alandaki ürün geliştirme yaklaşımımızın somut bir örneğidir. Gerçek müşteri veya satış rakamı iddiası taşımadan, rezervasyon operasyonunu dijitalleştirmeye odaklanır.',
    Icon: Ticket,
    features: [
      'Online rezervasyon',
      'Kapasite / kontenjan yönetimi',
      'Sefer veya hizmet planlama',
      'Elektronik bilet',
      'QR / barkod altyapısı',
      'Müşteri yönetimi',
      'Ödeme entegrasyonu',
      'İptal / değişiklik süreçleri',
      'Acente / B2B sistemi',
      'Mobil uygulama entegrasyonu',
      'Operasyon paneli',
      'Bildirim sistemleri',
    ],
    problems: [
      'Manuel rezervasyon takibi',
      'Kapasite çakışmaları',
      'Parçalı ödeme ve bilet süreçleri',
      'Acente satışının ayrı yürütülmesi',
      'Operasyonun satış verisine geç bağlanması',
    ],
    useCases: ['Deniz ulaşımı', 'Etkinlik ve hizmet rezervasyonu', 'Acente satış kanalları', 'Yüksek işlem hacimli bilet süreçleri'],
    process: ['Arama', 'Seçim', 'Rezervasyon', 'Ödeme', 'E-Bilet', 'Operasyon'],
    processLabel: 'Örnek Akış',
    visual: 'process',
    problemsLabel: 'Hangi İhtiyaçları Çözer?',
    ctaLabel: 'Rezervasyon Sistemini Konuşalım',
    contactType: 'Rezervasyon & Biletleme',
    ctaMessage: 'Rezervasyon ve biletleme sistemi hakkında bilgi almak istiyorum.',
    cardImage: '/images/solutions/booking-ticketing.webp',
  },
  {
    id: 'operations',
    title: 'Operasyon Yönetim Platformu',
    subtitle: 'Operasyonel süreçleri merkezi, ölçülebilir ve izlenebilir hale getiren dijital yönetim altyapısı.',
    description:
      'Operasyon platformu; talebin oluşmasından tamamlanmasına kadar görev, onay, süre ve sorumlulukları tek panelde izler. Ekiplerin Excel ve mesajlaşma üzerinden yürüttüğü işler, kayıtlı ve ölçülebilir bir akışa dönüşür.',
    Icon: Activity,
    features: [
      'Görev atama',
      'İş akışları',
      'Durum yönetimi',
      'Onay mekanizmaları',
      'Departmanlar arası süreç',
      'Zaman / SLA takibi',
      'İşlem logları',
      'Rol bazlı yetki',
      'Otomatik bildirim',
      'Performans takibi',
      'Operasyon dashboardu',
    ],
    problems: [
      'Excel ve mesajlaşma üzerinden yürüyen süreçler',
      'Görevlerin kaybolması',
      'Süreç gecikmeleri',
      'Departmanlar arası kopukluk',
      'Operasyon görünürlüğü eksikliği',
    ],
    useCases: ['Saha operasyonu', 'Hizmet yürütümü', 'İç talep yönetimi', 'Destek ve kontrol süreçleri'],
    process: ['Talep', 'Atama', 'İşlem', 'Kontrol', 'Onay', 'Tamamlandı'],
    processLabel: 'Örnek Akış',
    visual: 'process',
    problemsLabel: 'Çözdüğü Problemler',
    ctaLabel: 'Operasyonunuzu Dijitalleştirelim',
    contactType: 'Operasyon Yönetimi',
    ctaMessage: 'Operasyon yönetim platformu hakkında bilgi almak istiyorum.',
    cardImage: '/images/solutions/operations-platform.webp',
  },
  {
    id: 'sales',
    title: 'Müşteri ve Satış Yönetimi',
    subtitle: 'Satış ekiplerinin müşteri yolculuğunu ilk temastan satış sonrası sürece kadar yönetmesini sağlayan sistemler.',
    description:
      'Satış ve müşteri yönetimi katmanı; potansiyel müşteri kaydından satış sonrası takibe kadar pipeline’ı görünür kılar. Temsilci atama, teklif ve aktivite kayıtları aynı süreçte tutulur, ekip performansı raporlanabilir hale gelir.',
    Icon: Users,
    features: [
      'Müşteri segmentasyonu',
      'Satış pipeline',
      'Lead takibi',
      'Satış temsilcisi atama',
      'Teklif yönetimi',
      'Fırsat yönetimi',
      'Satış hedefleri',
      'Aktivite kayıtları',
      'Hatırlatmalar',
      'Satış performans raporları',
      'Müşteri geçmişi',
    ],
    problems: [
      'Lead kayıtlarının kaybolması',
      'Teklif sürecinin dağınık ilerlemesi',
      'Satış görünürlüğünün zayıf olması',
      'Müşteri geçmişinin ekibe kapalı kalması',
    ],
    useCases: ['İç satış ekipleri', 'Bayi ağı', 'Kurumsal hesap yönetimi', 'Satış sonrası takip'],
    process: ['Lead', 'İletişim', 'İhtiyaç', 'Teklif', 'Görüşme', 'Satış'],
    processLabel: 'Örnek Satış Akışı',
    visual: 'process',
    problemsLabel: 'Hangi İhtiyaçları Çözer?',
    ctaLabel: 'Satış Sürecinizi Dijitalleştirelim',
    contactType: 'Müşteri & Satış Yönetimi',
    ctaMessage: 'Müşteri ve satış yönetimi çözümü hakkında bilgi almak istiyorum.',
    cardImage: '/images/solutions/customer-sales.webp',
  },
  {
    id: 'dashboards',
    title: 'Yönetim Dashboardları',
    subtitle: 'İşletmenizin kritik verilerini tek ekranda görün ve daha hızlı karar alın.',
    description:
      'Yönetim dashboardları; satış, operasyon ve müşteri verilerini karar ekranına taşır. Rol bazlı görünüm, filtreleme ve dışa aktarma ile yönetim ekipleri güncel duruma tek noktadan bakabilir.',
    Icon: LayoutDashboard,
    features: [
      'KPI takibi',
      'Satış raporları',
      'Operasyon performansı',
      'Müşteri analitiği',
      'Finansal göstergeler',
      'Trend analizi',
      'Tarih karşılaştırmaları',
      'Filtreleme',
      'Kullanıcı bazlı raporlar',
      'Gerçek zamanlı veri',
      'Export özellikleri',
    ],
    problems: [
      'Verinin farklı sistemlerde dağınık olması',
      'Karar için geç rapor üretimi',
      'Rol bazlı görünüm eksikliği',
      'Trendlerin izlenememesi',
    ],
    useCases: ['Yönetim raporları', 'Departman liderleri', 'Operasyon analizi', 'Satış performansı'],
    visual: 'dashboard',
    problemsLabel: 'Hangi İhtiyaçları Çözer?',
    ctaLabel: 'Dashboard Çözümünü Konuşalım',
    contactType: 'Dashboard & Raporlama',
    ctaMessage: 'Yönetim dashboardı ve raporlama çözümü hakkında bilgi almak istiyorum.',
    cardImage: '/images/solutions/management-dashboard.webp',
  },
  {
    id: 'api-platform',
    title: 'API ve Entegrasyon Platformları',
    subtitle: 'Farklı yazılımları ve servisleri güvenli bir entegrasyon katmanı üzerinden birbirine bağlayın.',
    description:
      'API ve entegrasyon katmanı; web, mobil, CRM ve kurumsal sistemler arasında kontrollü veri akışı kurar. Ödeme, bildirim ve harici servisler tek bir omurga üzerinden konuşabilir; loglama ve hata yönetimi süreç görünürlüğünü artırır.',
    Icon: GitMerge,
    features: [
      'REST API',
      'Üçüncü taraf API entegrasyonu',
      'Ödeme sistemleri',
      'CRM bağlantıları',
      'ERP bağlantıları',
      'SMS servisleri',
      'E-posta servisleri',
      'Webhook',
      'Veri senkronizasyonu',
      'Kimlik doğrulama',
      'Yetkilendirme',
      'Loglama',
      'Hata yönetimi',
      'İzleme',
    ],
    problems: [
      'Sistemlerin birbirinden kopuk çalışması',
      'Manuel veri aktarımı',
      'Güvenliği zayıf noktadan noktaya bağlantılar',
      'Hata ve log görünürlüğünün düşük olması',
    ],
    useCases: ['ERP-CRM köprüsü', 'Ödeme altyapısı', 'Bildirim servisleri', 'B2B veri paylaşımı'],
    architecture: ['ERP', 'Ödeme', 'SMS', 'E-posta', 'Harici Servis'],
    visual: 'architecture',
    problemsLabel: 'Hangi İhtiyaçları Çözer?',
    ctaLabel: 'Entegrasyon Projenizi Konuşalım',
    contactType: 'API & Entegrasyon',
    ctaMessage: 'API ve entegrasyon platformu hakkında bilgi almak istiyorum.',
    cardImage: '/images/solutions/api-integrations.webp',
  },
];

export const serviceSolutions: SolutionDetail[] = [
  {
    id: 'custom-software',
    title: 'Özel Yazılım Geliştirme',
    subtitle: 'Standart yazılımların karşılamadığı süreçler için işletmenize özel dijital ürünler.',
    description:
      'Özel yazılım yaklaşımı; mevcut paketlerin uymadığı operasyonları, sizin süreç dilinize göre tasarlanan bir ürüne dönüştürür. Analizden yayına kadar mimari, yetkilendirme, entegrasyon ve bakım aynı ürün yol haritasında ele alınır.',
    Icon: Cpu,
    features: [
      'İhtiyaç analizi',
      'Süreç tasarımı',
      'UX/UI',
      'Özel backend',
      'Yönetim paneli',
      'Kullanıcı yetkilendirme',
      'API',
      'Entegrasyon',
      'Raporlama',
      'Ölçeklenebilir mimari',
      'Bakım ve geliştirme',
    ],
    problems: [
      'Hazır yazılımın sürece uymaması',
      'Departmanların ayrı sistemlerde çalışması',
      'Esnek olmayan ürün sınırları',
      'Entegrasyonun sonradan eklenmek zorunda kalması',
    ],
    useCases: ['Operasyon yazılımları', 'Kurumsal paneller', 'Sektöre özel iş uygulamaları', 'İç süreç platformları'],
    process: ['Analiz', 'Tasarım', 'Geliştirme', 'Test', 'Yayın', 'İyileştirme'],
    processLabel: 'Süreç',
    visual: 'process',
    problemsLabel: 'Hangi İhtiyaçları Çözer?',
    ctaLabel: 'Özel Yazılım Projenizi Konuşalım',
    contactType: 'Özel Yazılım',
    ctaMessage: 'Özel yazılım çözümü hakkında bilgi almak istiyorum.',
    cardImage: '/images/solutions/custom-software.webp',
  },
  {
    id: 'crm-systems',
    title: 'CRM Sistemleri',
    subtitle: 'Müşteri, satış ve servis süreçlerini tek CRM omurgasında birleştirin.',
    description:
      'CRM sistemleri; müşteri kaydı, satış hattı ve servis etkileşimini aynı veri modelinde tutar. Ekip, müşteriye dair iletişimi ve görevleri merkezi olarak görür.',
    Icon: Workflow,
    features: [
      'Müşteri kartı',
      'Lead ve fırsat yönetimi',
      'Servis talepleri',
      'Aktivite takibi',
      'Yetkilendirme',
      'Raporlama',
      'Entegrasyon katmanı',
    ],
    problems: ['Dağınık müşteri kaydı', 'Satış-destek kopukluğu', 'Manuel hatırlatmalar'],
    useCases: ['Satış ekipleri', 'Müşteri destek', 'Kurumsal hesap yönetimi'],
    process: ['Kayıt', 'İletişim', 'Fırsat', 'Hizmet', 'Rapor'],
    processLabel: 'Örnek Süreç',
    visual: 'process',
    problemsLabel: 'Hangi İhtiyaçları Çözer?',
    ctaLabel: 'CRM Çözümünü Konuşalım',
    contactType: 'CRM Sistemleri',
    ctaMessage: 'CRM sistemi hakkında bilgi almak istiyorum.',
  },
  {
    id: 'digital-platforms',
    title: 'Dijital Platformlar',
    subtitle: 'Birden fazla iş birimini aynı ürün omurgasında buluşturan ölçeklenebilir platformlar.',
    description:
      'Dijital platformlar; kullanıcı, partner ve operasyon katmanlarını modüler bir yapıda bir araya getirir. Büyüme ihtiyacı ortaya çıktığında yeni modüller mevcut omurgaya eklenebilir.',
    Icon: LayoutGrid,
    features: [
      'Modül bazlı mimari',
      'Kullanıcı ve yetki katmanı',
      'Partner / ekosistem alanları',
      'Yönetim paneli',
      'API',
      'Bildirim',
      'Raporlama',
    ],
    problems: ['Parçalı dijital yüzeyler', 'Ortak kullanıcı deneyiminin kopması', 'Ölçeklenemeyen tekil uygulamalar'],
    useCases: ['Kurumsal portallar', 'Partner platformları', 'Çok paydaşlı iş ağları'],
    process: ['Keşif', 'Mimari', 'Modül', 'Entegrasyon', 'Yayın'],
    processLabel: 'Süreç',
    visual: 'process',
    problemsLabel: 'Hangi İhtiyaçları Çözer?',
    ctaLabel: 'Platform Projenizi Konuşalım',
    contactType: 'Dijital Platform',
    ctaMessage: 'Dijital platform geliştirme hakkında bilgi almak istiyorum.',
  },
  {
    id: 'saas',
    title: 'SaaS Ürünleri',
    subtitle: 'Birden fazla kullanıcı ve işletmeye hizmet verebilen ölçeklenebilir bulut tabanlı ürün mimarileri.',
    description:
      'SaaS yaklaşımı; abonelik, rol ve yönetim katmanlarını ürünün merkezine alır. Multi-tenant ve faturalama gibi başlıklar proje ihtiyacına göre tasarlanır; uygulanmayan bir özelliği kesin gerçekmiş gibi sunmayız.',
    Icon: ServerCog,
    features: [
      'Multi-tenant yapı',
      'Kullanıcı ve abonelik yönetimi',
      'Rol bazlı erişim',
      'Dashboard',
      'API',
      'Billing entegrasyonu',
      'Bildirim',
      'Raporlama',
      'Ölçeklenebilir altyapı',
      'Yönetim paneli',
    ],
    problems: ['Ürünü tek müşteriye kilitleyen mimari', 'Abonelik yönetiminin dağınık olması', 'Rol ve yetki modelinin zayıf kalması'],
    useCases: ['B2B yazılım ürünleri', 'Sektör dikey çözümleri', 'Abonelik tabanlı paneller'],
    process: ['Ürün modeli', 'Mimari', 'Geliştirme', 'Yayın', 'Ölçekleme'],
    processLabel: 'Süreç',
    visual: 'process',
    problemsLabel: 'Hangi İhtiyaçları Çözer?',
    ctaLabel: 'SaaS Ürününüzü Konuşalım',
    contactType: 'SaaS Platformu',
    ctaMessage: 'SaaS platformu hakkında bilgi almak istiyorum.',
    cardImage: '/images/solutions/saas-products.webp',
  },
  {
    id: 'web-mobile',
    title: 'Web ve Mobil Uygulamalar',
    subtitle: 'Kullanıcı deneyimi, performans ve ölçeklenebilirliği birlikte ele alan modern dijital uygulamalar.',
    description:
      'Web ve mobil uygulamalar; müşteri, saha ve yönetim yüzeylerini tutarlı bir deneyimde birleştirir. Kimlik doğrulama, API ve bildirim katmanları ürünün doğal parçası olarak kurgulanır.',
    Icon: MonitorSmartphone,
    features: [
      'Responsive web',
      'PWA',
      'Mobil uygulama',
      'Kullanıcı paneli',
      'Admin panel',
      'Kimlik doğrulama',
      'API entegrasyonu',
      'Bildirim',
      'Performans optimizasyonu',
      'Erişilebilirlik',
    ],
    problems: ['Masaüstü ve mobil deneyimin kopuk olması', 'Yavaş veya erişilemeyen arayüzler', 'Yönetim ile kullanıcı yüzeyinin ayrı kalması'],
    useCases: ['Müşteri uygulamaları', 'Saha ekipleri', 'Self-servis paneller'],
    process: ['UX', 'Arayüz', 'Geliştirme', 'Test', 'Yayın'],
    processLabel: 'Süreç',
    visual: 'process',
    problemsLabel: 'Hangi İhtiyaçları Çözer?',
    ctaLabel: 'Uygulama Projenizi Konuşalım',
    contactType: 'Web & Mobil Uygulama',
    ctaMessage: 'Web ve mobil uygulama projesi hakkında bilgi almak istiyorum.',
  },
  {
    id: 'api-integrations',
    title: 'API ve Sistem Entegrasyonları',
    subtitle: 'Mevcut sistemlerinizi güvenli API katmanlarıyla konuşturun.',
    description:
      'Entegrasyon hizmeti; CRM, ERP, ödeme ve bildirim sistemleri arasında veri bütünlüğü sağlar. Amaç, manuel aktarımı azaltmak ve sistemler arası akışı izlenebilir kılmaktır.',
    Icon: GitMerge,
    features: [
      'REST API',
      'Sistemler arası veri aktarımı',
      'Webhook',
      'Kimlik doğrulama',
      'Yetkilendirme',
      'Loglama',
      'Hata yönetimi',
      'İzleme',
    ],
    problems: ['Parçalı sistemler', 'Manuel veri işi', 'İzlenemeyen entegrasyon hataları'],
    useCases: ['ERP bağlantıları', 'Ödeme altyapısı', 'CRM senkronizasyonu'],
    architecture: ['ERP', 'Ödeme', 'SMS', 'E-posta', 'Harici Servis'],
    visual: 'architecture',
    problemsLabel: 'Hangi İhtiyaçları Çözer?',
    ctaLabel: 'Entegrasyon Projenizi Konuşalım',
    contactType: 'API & Entegrasyon',
    ctaMessage: 'API ve sistem entegrasyonu hakkında bilgi almak istiyorum.',
  },
  {
    id: 'reporting',
    title: 'Dashboard ve Raporlama',
    subtitle: 'Operasyon ve satış verilerini karar alınabilir ekranlara dönüştürün.',
    description:
      'Dashboard ve raporlama katmanı; KPI, filtre ve dışa aktarma ile yönetim görünürlüğünü artırır. Veri kaynakları proje ihtiyacına göre bağlanır.',
    Icon: ChartNoAxesCombined,
    features: [
      'KPI kartları',
      'Operasyon performansı',
      'Satış görünümü',
      'Filtreleme',
      'Tarih karşılaştırması',
      'Export',
      'Rol bazlı görünüm',
    ],
    problems: ['Geç ve dağınık raporlar', 'Tek ekranda özetin olmaması', 'Karar vericinin veriye geç ulaşması'],
    useCases: ['Yönetim panelleri', 'Operasyon takibi', 'Satış analizleri'],
    visual: 'dashboard',
    problemsLabel: 'Hangi İhtiyaçları Çözer?',
    ctaLabel: 'Raporlama Çözümünü Konuşalım',
    contactType: 'Dashboard & Raporlama',
    ctaMessage: 'Dashboard ve raporlama çözümü hakkında bilgi almak istiyorum.',
  },
  {
    id: 'automation',
    title: 'İş Süreçleri Otomasyonu',
    subtitle: 'Tekrarlayan operasyonları azaltan ve ekiplerin daha verimli çalışmasını sağlayan otomasyon çözümleri.',
    description:
      'Süreç otomasyonu; tetikleyici, kural ve bildirimlerle tekrarlayan işleri kayıtlı hale getirir. Onay ve veri aktarımı insan müdahalesine daha az bağlı ilerler.',
    Icon: Blocks,
    features: [
      'Otomatik görev',
      'Tetikleyici tabanlı işlemler',
      'Bildirim',
      'Onay akışları',
      'Veri aktarımı',
      'Durum değişiklikleri',
      'Zamanlanmış görevler',
      'Entegrasyon otomasyonları',
      'Raporlama',
    ],
    problems: ['Tekrarlayan manuel işler', 'Onayların gecikmesi', 'Durum güncellemelerinin unutulması'],
    useCases: ['Onay süreçleri', 'Bildirim tetikleri', 'Kayıt aktarımı', 'İç operasyon kuralları'],
    process: ['Tetikleyici', 'Kural', 'İşlem', 'Bildirim', 'Rapor'],
    processLabel: 'Akış örneği',
    visual: 'process',
    problemsLabel: 'Hangi İhtiyaçları Çözer?',
    ctaLabel: 'Süreçlerinizi Otomatikleştirelim',
    contactType: 'İş Süreçleri Otomasyonu',
    ctaMessage: 'İş süreçleri otomasyonu hakkında bilgi almak istiyorum.',
    cardImage: '/images/solutions/workflow-automation.webp',
  },
];
