import type { Metadata } from 'next';
import { COMPANY, displayRegistry } from '@/config/company';
import { CompanyInfoPanel } from '@/components/legal/CompanyInfoPanel';
import { LegalDocument, LegalSection } from '@/components/legal/LegalDocument';
import { LEGAL_VERSIONS } from '@/lib/legal/versions';
import { BRAND_SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'İptal, Cayma ve İade Koşulları',
  description: 'TicketGo Teknoloji A.Ş. iptal, cayma ve iade koşulları. Dijital ürün ve hizmetlerde mevzuata göre değerlendirme.',
  alternates: { canonical: `${BRAND_SITE_URL}/legal/refund` },
};

export default function RefundPage() {
  return (
    <LegalDocument
      doc={LEGAL_VERSIONS.refund}
      intro="TicketGo Teknoloji A.Ş. üzerinden gerçekleştirilen satın alma işlemlerinde iptal, cayma ve iade süreçleri; satın alınan ürün veya hizmetin niteliğine ve yürürlükteki tüketici mevzuatına göre değerlendirilir."
      tableOfContents={[
        { id: 'satici-hizmet-saglayici-bilgileri', label: 'Satıcı / hizmet sağlayıcı bilgileri' },
        { id: '1-genel-ilkeler', label: '1. Genel ilkeler' },
        { id: '2-cayma-hakki', label: '2. Cayma hakkı' },
        { id: '3-dijital-urun-ve-hizmetler', label: '3. Dijital ürün ve hizmetler' },
        { id: '4-hizmetin-ifasina-baslanmasi', label: '4. Hizmetin ifasına başlanması' },
        { id: '5-cayma-hakkinin-bulunmadigi-durumlar', label: '5. Cayma hakkının bulunmadığı durumlar' },
        { id: '6-iade-talebi-nasil-yapilir', label: '6. İade talebi nasıl yapılır?' },
        { id: '7-iade-sureci', label: '7. İade süreci' },
        { id: '8-odeme-yontemine-iade', label: '8. Ödeme yöntemine iade' },
        { id: '9-kismi-iadeler', label: '9. Kısmi iadeler' },
        { id: '10-teknik-sorunlar', label: '10. Teknik sorunlar' },
        { id: '11-hatali-mukerrer-odeme', label: '11. Hatalı / mükerrer ödeme' },
        { id: '12-destek', label: '12. Destek' },
      ]}
    >
      <LegalSection title="Satıcı / hizmet sağlayıcı bilgileri">
        <CompanyInfoPanel title="Satıcı bilgileri" showInfo={false} />
      </LegalSection>

      <LegalSection title="1. Genel ilkeler">
        <p>
          Bu siteden satın alınabilen kalemler ağırlıklı olarak yazılım lisansı, abonelik, dijital erişim ve hizmet
          ifasıdır. Her talep, somut sipariş, ifanın durumu ve 6502 sayılı Kanun ile Mesafeli Sözleşmeler Yönetmeliği
          çerçevesinde incelenir. Ticari alıcı işlemleri tüketici rejiminden farklı değerlendirilebilir.
        </p>
      </LegalSection>

      <LegalSection title="2. Cayma hakkı">
        <p>
          Tüketici niteliğindeki alıcı, uygulanabilir olduğu ölçüde, sözleşmenin kurulmasından itibaren 14 gün içinde
          gerekçesiz cayma hakkına sahip olabilir. Süre, hizmet sözleşmelerinde kural olarak sözleşmenin kurulduğu tarihte
          işlemeye başlar. Cayma,{' '}
          <a className="email-link font-semibold text-brand-600" href={`mailto:${COMPANY.emails.support}`}>
            {COMPANY.emails.support}
          </a>{' '}
          adresine yazılı veya kalıcı veri saklayıcısı ile bildirilir.
        </p>
      </LegalSection>

      <LegalSection title="3. Dijital ürün ve hizmetler">
        <p>
          Dijital ürün veya hizmet satın alınması, tek başına iade hakkını ortadan kaldırmaz. “Dijital ürünlerde kesinlikle
          iade yoktur” şeklinde genel bir kural uygulanmaz. Anında ifa, anında teslim edilen gayrimaddi mal veya alıcının
          onayıyla ifaya başlanmış hizmet gibi haller, ancak mevzuattaki şartlar oluştuğunda istisna olarak devreye girebilir.
        </p>
      </LegalSection>

      <LegalSection title="4. Hizmetin ifasına başlanması">
        <p>
          Cayma süresi dolmadan hizmetin ifasına alıcının onayıyla başlanmışsa, Yönetmelik m.15/h kapsamında cayma hakkı
          kullanılamayabilir. Onay ve ifanın başladığı an sipariş/destek kayıtlarında tutulur. İfaya henüz başlanmamış
          talepler bu istisnanın dışında kalabilir.
        </p>
      </LegalSection>

      <LegalSection title="5. Cayma hakkının bulunmadığı durumlar">
        <p>
          TicketGo Teknoloji satış modeliyle ilgili olarak, taraflarca aksi kararlaştırılmadıkça şu haller değerlendirilir:
          elektronik ortamda anında ifa edilen hizmetler veya anında teslim edilen gayrimaddi mallar; süre dolmadan
          tüketicinin onayıyla ifasına başlanan hizmetler. Gıda, hijyen ürünü, konaklama veya cihaz satışı bu sitede
          yapılmaz.
        </p>
      </LegalSection>

      <LegalSection title="6. İade talebi nasıl yapılır?">
        <p>
          Sipariş numarası, e-posta ve talep konusu belirtilerek{' '}
          <a className="email-link font-semibold text-brand-600" href={`mailto:${COMPANY.emails.support}`}>
            {COMPANY.emails.support}
          </a>{' '}
          adresine yazılır. Kimliği
          tevsik edici bilgiler istenebilir. Fiziksel iade adresi (gerektiğinde): {displayRegistry(COMPANY.returnAddress)}.
        </p>
      </LegalSection>

      <LegalSection title="7. İade süreci">
        <p>
          Talebin mevzuata uygun bulunduğu hallerde, bildirimden sonra yasal süreler içinde bedel iadesi başlatılır.
          İnceleme için ek bilgi gerekebilir. Reddedilen talepler gerekçeli olarak bildirilir.
        </p>
      </LegalSection>

      <LegalSection title="8. Ödeme yöntemine iade">
        <p>
          İade, kural olarak tahsilatın yapıldığı yönteme (QNBpay / kart kuruluşu) yönlendirilir. Kart
          hesaplarına yansıma, bankanın takvimine bağlıdır. TicketGo Teknoloji kart verisi tutmadığı için iade de ödeme
          kuruluşu kanalları üzerinden yürür.
        </p>
      </LegalSection>

      <LegalSection title="9. Kısmi iadeler">
        <p>
          Kurulum bedeli ifa edilmiş, abonelik döneminin bir kısmı kullanılmış veya birden fazla kalemden yalnız biri
          iade edilebilir nitelikteyse, kısmi iade somut duruma göre hesaplanabilir. Kullanılmayan dönemlerin iadesi,
          paketin iptal kaydına ve mevzuata göre değerlendirilir.
        </p>
      </LegalSection>

      <LegalSection title="10. Teknik sorunlar">
        <p>
          Erişim, aktivasyon veya ödeme doğrulama kaynaklı teknik sorunlar destek kaydıyla giderilmeye çalışılır.
          Teknik arıza, tek başına otomatik tam iade anlamına gelmez; süreklilik ve ifa imkânı birlikte incelenir.
        </p>
      </LegalSection>

      <LegalSection title="11. Hatalı / mükerrer ödeme">
        <p>
          Aynı siparişin birden fazla tahsil edilmesi veya açıkça hatalı ödeme iddiaları incelenir. Mükerrer tahsilat
          doğrulanırsa uygun iade süreci başlatılır. İnceleme tamamlanmadan otomatik iade yapılmaz.
        </p>
      </LegalSection>

      <LegalSection title="12. Destek">
        <p>
          <a className="email-link font-semibold text-brand-600" href={`mailto:${COMPANY.emails.support}`}>
            {COMPANY.emails.support}
          </a>
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
