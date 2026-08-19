import {
  BadgeCheck,
  CreditCard,
  GitMerge,
  Repeat,
  Server,
  ShieldCheck,
} from 'lucide-react';
import type { SolutionDetail } from '@/data/solutions';

function highlight(
  item: Omit<SolutionDetail, 'problems' | 'ctaLabel' | 'ctaMessage' | 'contactType' | 'ctaHref'> &
    Partial<Pick<SolutionDetail, 'problems'>>
): SolutionDetail {
  return {
    ...item,
    problems: item.problems ?? [],
    introLabel: '',
    hoverHints: [],
    hoverActionLabel: 'İncele →',
    ctaLabel: 'Güvenli Ödemeye Geç',
    ctaHref: '/payment',
    contactType: 'Güvenli Ödeme',
    ctaMessage: 'Güvenli ödeme altyapısı hakkında bilgi almak istiyorum.',
  };
}

export const paymentHighlights: SolutionDetail[] = [
  highlight({
    id: 'pay-3d',
    category: 'Ödeme Güvenliği',
    title: '3D Secure',
    subtitle: 'Ödeme işlemlerinde kart sahibinin banka doğrulamasının kullanılabildiği güvenli ödeme akışı.',
    description:
      'Kart sahibinin ödeme sırasında bankası üzerinden ek doğrulama yapmasına imkân veren güvenlik katmanıdır. 3D Secure, TicketGo Teknoloji’nin kart verisini sakladığı anlamına gelmez; doğrulama ödeme sağlayıcısı ve kartın bankası üzerinden yürür.',
    Icon: ShieldCheck,
    features: [
      'Kart sahibi doğrulaması',
      'Banka yönlendirmeli akış',
      'Ödeme sağlayıcısı oturumu',
      'Sonucun sunucu tarafında kontrolü',
    ],
    useCases: ['Kartlı tahsilat', 'Dijital ürün ödemesi'],
    technicalApproach:
      '3D Secure destekli entegrasyon yaklaşımıyla ödeme, sağlayıcının barındırdığı güvenli oturumda tamamlanır.',
  }),
  highlight({
    id: 'pay-server',
    category: 'Ödeme Güvenliği',
    title: 'Sunucu Tarafı Doğrulama',
    subtitle:
      'Ödeme sonucunun yalnızca tarayıcı yönlendirmesine değil, sağlayıcı yanıtlarının sunucu tarafında kontrol edilmesine göre değerlendirilmesi.',
    description:
      'Ödeme sonucu, kullanıcının tarayıcıda gördüğü yönlendirmeye indirgenmez. Sağlayıcıdan gelen yanıt ve callback bilgisi sunucu tarafında doğrulanır; sipariş durumu buna göre güncellenir.',
    Icon: Server,
    features: ['Sağlayıcı yanıt kontrolü', 'Callback doğrulama', 'Sipariş durumu güncelleme', 'Tarayıcıya bağımlı olmama'],
    useCases: ['Başarılı tahsilat', 'Başarısız / iptal sonucu'],
    technicalApproach: 'Son durum, sunucu tarafı doğrulama ile belirlenir.',
  }),
  highlight({
    id: 'pay-amount',
    category: 'Ödeme Güvenliği',
    title: 'Sipariş ve Tutar Kontrolü',
    subtitle: 'Ödeme öncesinde ürün ve sipariş tutarının güvenilir sistem kaynağından doğrulanması.',
    description:
      'Ödeme tutarı tarayıcıdan gelen serbest bir rakama bırakılmaz. Ürün ve dönem, katalogdaki güvenilir kaynaktan okunur; başlatılan oturum bu tutarla eşleşir.',
    Icon: BadgeCheck,
    features: ['Katalogdan tutar okuma', 'Ürün / dönem doğrulama', 'Oturum-tutar eşlemesi', 'Fiyat sapması kontrolü'],
    useCases: ['Paket satın alma', 'Yıllık / aylık dönem'],
    technicalApproach: 'Tutar, ödeme öncesinde sistem kaynağından doğrulanır.',
  }),
  highlight({
    id: 'pay-callback',
    category: 'Ödeme Güvenliği',
    title: 'Güvenli Callback',
    subtitle: 'Ödeme sağlayıcısından gelen işlem sonuçlarının kontrollü biçimde işlenmesine hazır altyapı.',
    description:
      'Sağlayıcıdan dönen işlem sonucu, tanımlı callback / dönüş uçlarında kontrollü işlenir. Beklenmeyen kaynak veya eksik doğrulama, siparişi başarılı saymaz.',
    Icon: GitMerge,
    features: ['Dönüş uçları', 'Kaynak kontrolü', 'Sonuç işleme', 'Sipariş güncelleme'],
    useCases: ['3D dönüşü', 'Asenkron bildirim'],
    technicalApproach: 'Callback, güvenli ödeme akışına hazır bir sonuç kanalıdır.',
  }),
  highlight({
    id: 'pay-status',
    category: 'Ödeme Güvenliği',
    title: 'İşlem Durumu Takibi',
    subtitle: 'Başarılı, başarısız, iptal veya iade gibi ödeme durumlarının sipariş bazlı yönetilebilmesi.',
    description:
      'Her ödeme girişimi sipariş kaydına bağlanır. Başarılı, başarısız, iptal veya iade durumları sipariş bazında izlenebilir; kullanıcıya gösterilen sonuç bu kayıtla uyumlu tutulur.',
    Icon: CreditCard,
    features: ['Sipariş bazlı durum', 'Başarılı / başarısız', 'İptal', 'İade takibi'],
    useCases: ['Ödeme sonucu ekranı', 'Destek incelemesi'],
    technicalApproach: 'Durum, tarayıcı mesajına değil sipariş kaydına dayanır.',
  }),
  highlight({
    id: 'pay-idempotent',
    category: 'Ödeme Güvenliği',
    title: 'Çift Tahsilat Koruması',
    subtitle: 'Aynı sipariş için tekrar ödeme başlatılmasını engellemeye yönelik idempotent işlem mantığı.',
    description:
      'Aynı sipariş için tekrarlı ödeme başlatılması, idempotent işlem anahtarı ve sipariş durumu kontrolüyle sınırlanır. Bu, sıfır risk veya bankacılık garantisi iddiası değildir; mükerrer başlatmayı azaltmaya yönelik bir uygulama kontrolüdür.',
    Icon: Repeat,
    features: ['Idempotent istek anahtarı', 'Sipariş durumu kilidi', 'Tekrar başlatma kontrolü', 'Mükerrer oturum azaltma'],
    useCases: ['Çift tıklama', 'Sayfa yenileme'],
    technicalApproach: 'Aynı sipariş için kontrollü tek tahsilat oturumu hedeflenir.',
  }),
];
