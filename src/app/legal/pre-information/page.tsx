import type { Metadata } from 'next';
import Link from 'next/link';
import { COMPANY, displayRegistry } from '@/config/company';
import { CompanyInfoPanel } from '@/components/legal/CompanyInfoPanel';
import { LegalDocument, LegalSection } from '@/components/legal/LegalDocument';
import { OrderLegalSummary } from '@/components/legal/OrderLegalSummary';
import { resolveLegalOrder } from '@/lib/legal/order-context';
import { LEGAL_VERSIONS } from '@/lib/legal/versions';
import { BRAND_SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata: Metadata = {
  title: 'Mesafeli Satış Ön Bilgilendirme Formu',
  description: 'TicketGo Teknoloji A.Ş. mesafeli satış ön bilgilendirme formu. Ödeme öncesi satıcı, fiyat, ifa ve cayma bilgileri.',
  alternates: { canonical: `${BRAND_SITE_URL}/legal/pre-information` },
};

type Search = { product?: string; productId?: string; period?: string; qty?: string; order?: string };

export default async function PreInformationPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const order = await resolveLegalOrder(params);
  const doc = LEGAL_VERSIONS.preInformation;

  return (
    <LegalDocument
      doc={doc}
      intro="Bu form, ödeme yükümlülüğü doğmadan önce satıcı, bedel, ifa ve cayma konularında özet bilgi vermek üzere hazırlanmıştır. Ayrıntılar Mesafeli Satış Sözleşmesi’ndedir."
      tableOfContents={[
        { id: 'satici-hizmet-saglayici', label: 'SATICI / HİZMET SAĞLAYICI' },
        { id: 'satin-alinan-urun-veya-hizmet', label: 'Satın alınan ürün veya hizmet' },
        { id: 'toplam-fiyat', label: 'Toplam fiyat' },
        { id: 'vergiler', label: 'Vergiler' },
        { id: 'varsa-ilave-masraflar', label: 'Varsa ilave masraflar' },
        { id: 'odeme-yontemi', label: 'Ödeme yöntemi' },
        { id: 'ifa-teslim-sekli', label: 'İfa / teslim şekli' },
        { id: 'ifa-teslim-suresi', label: 'İfa / teslim süresi' },
        { id: 'cayma-hakki', label: 'Cayma hakkı' },
        { id: 'cayma-bildiriminin-yapilacagi-iletisim-kanali', label: 'Cayma bildiriminin yapılacağı iletişim kanalı' },
        { id: 'cayma-hakkinin-istisnalari', label: 'Cayma hakkının istisnaları' },
        { id: 'iade-sureci', label: 'İade süreci' },
        { id: 'sikayet-ve-destek', label: 'Şikâyet ve destek' },
      ]}
    >
      <LegalSection title="SATICI / HİZMET SAĞLAYICI">
        <CompanyInfoPanel title="Satıcı bilgileri" />
      </LegalSection>

      <LegalSection title="Satın alınan ürün veya hizmet">
        {order ? (
          <>
            <p>
              {order.productName} — {order.description}
            </p>
            <OrderLegalSummary order={order} />
          </>
        ) : (
          <p>
            Ürün veya hizmet, ödeme sayfasında seçtiğiniz katalog kalemidir. Bu sayfa ürüne bağlı açıldığında ad, paket
            ve adet gerçek katalog kaydından gelir.
          </p>
        )}
      </LegalSection>

      <LegalSection title="Toplam fiyat">
        <p>
          {order
            ? `Ödenecek toplam: ${order.totalLabel} (${order.currency}). Bu tutar katalog fiyatından sunucu tarafında hesaplanır; tarayıcıdan gelen fiyat parametresine dayanmaz.`
            : 'Toplam bedel, ödeme sayfasındaki sipariş özetinde vergiler ve varsa ek kalemlerle birlikte gösterilir.'}
        </p>
      </LegalSection>

      <LegalSection title="Vergiler">
        <p>{order ? `${order.vatLabel} (${order.vatRateLabel})` : 'Katalog fiyatlarına KDV ayrıca uygulanabilir; sipariş özetinde ayrı satır yoksa bu durum açıkça belirtilir.'}</p>
      </LegalSection>

      <LegalSection title="Varsa ilave masraflar">
        <p>
          {order
            ? order.extrasLabel
            : 'Belirtilmediği sürece kargo, kapıda ödeme veya montaj ücreti yoktur. Kurulum/onboarding bedeli pakette tanımlıysa sipariş özetinde ayrı satır olarak yer alır.'}
        </p>
      </LegalSection>

      <LegalSection title="Ödeme yöntemi">
        <p>
          {order ? order.paymentMethod : 'QNBpay / QNB Sanal POS. Kart verileri TicketGo Teknoloji sisteminde tutulmaz.'}
        </p>
      </LegalSection>

      <LegalSection title="İfa / teslim şekli">
        <p>{order ? order.fulfillment : 'Dijital erişim, hesap/lisans aktivasyonu, elektronik teslim veya hizmetin başlatılması — satın alınan kalemin niteliğine göre.'}</p>
      </LegalSection>

      <LegalSection title="İfa / teslim süresi">
        <p>{order ? order.fulfillmentTime : 'Süre, ilgili paketin teslim açıklamasına ve ödemenin onaylanmasına bağlıdır. Anında indirme taahhüdü, siparişte açıkça yazılmadıkça yoktur.'}</p>
      </LegalSection>

      <LegalSection title="Cayma hakkı">
        <p>
          Tüketici işlemi niteliği varsa, uygulanabilir olduğu ölçüde 14 günlük cayma hakkı söz konusu olabilir. Dijital
          hizmet ve anında ifa istisnaları her ürüne otomatik uygulanmaz; niteliğe göre değerlendirilir. Ayrıntı:{' '}
          <Link href="/legal/refund" className="font-semibold text-brand-600">
            İptal, Cayma ve İade Koşulları
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Cayma bildiriminin yapılacağı iletişim kanalı">
        <p>
          <a className="email-link font-semibold text-brand-600" href={`mailto:${COMPANY.emails.support}`}>
            {COMPANY.emails.support}
          </a>
        </p>
      </LegalSection>

      <LegalSection title="Cayma hakkının istisnaları">
        <p>
          Yönetmelik m.15 kapsamında, elektronik ortamda anında ifa edilen hizmetler / anında teslim edilen gayrimaddi
          mallar ile, süre dolmadan tüketicinin onayıyla ifasına başlanan hizmetler istisna olabilir. Uygulama, somut
          ifa ve bilgilendirmeye bağlıdır.
        </p>
      </LegalSection>

      <LegalSection title="İade süreci">
        <p>
          İade hakkı doğduğunda bedel, ödeme yöntemine uygun iade edilir. QNBpay iadeleri ilgili kuruluş
          süreçlerine tabi olabilir. Fiziksel iade adresi: {displayRegistry(COMPANY.returnAddress)}.
        </p>
      </LegalSection>

      <LegalSection title="Şikâyet ve destek">
        <p>
          Destek:{' '}
          <a className="email-link font-semibold text-brand-600" href={`mailto:${COMPANY.emails.support}`}>
            {COMPANY.emails.support}
          </a>
          . Tüketici, Tüketici Hakem Heyeti ve Tüketici Mahkemesi yollarını kullanabilir.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
