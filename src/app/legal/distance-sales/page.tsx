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
  title: 'Mesafeli Satış Sözleşmesi',
  description:
    'TicketGo Teknoloji A.Ş. mesafeli satış sözleşmesi. Elektronik ortamda satın alınan ürün ve hizmetlere ilişkin hak ve yükümlülükler.',
  alternates: { canonical: `${BRAND_SITE_URL}/legal/distance-sales` },
};

type Search = { product?: string; productId?: string; period?: string; qty?: string; order?: string };

export default async function DistanceSalesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const order = await resolveLegalOrder(params);
  const doc = LEGAL_VERSIONS.distanceSales;

  return (
    <LegalDocument
      doc={doc}
      intro="İşbu Mesafeli Satış Sözleşmesi, TicketGo Teknoloji A.Ş. tarafından elektronik ortamda sunulan ve mesafeli olarak satın alınabilen ürün veya hizmetlere ilişkin tarafların hak ve yükümlülüklerini düzenlemek amacıyla hazırlanmıştır."
      tableOfContents={[
        { id: '1-taraflar', label: '1. Taraflar' },
        { id: '2-sozlesmenin-konusu', label: '2. Sözleşmenin konusu' },
        { id: '3-sozlesme-konusu-urun-veya-hizmet', label: '3. Sözleşme konusu ürün veya hizmet' },
        { id: '4-siparis-ve-sozlesmenin-kurulmasi', label: '4. Sipariş ve sözleşmenin kurulması' },
        { id: '5-odeme', label: '5. Ödeme' },
        { id: '6-urun-veya-hizmetin-ifasi', label: '6. Ürün veya hizmetin ifası' },
        { id: '7-cayma-hakki', label: '7. Cayma hakkı' },
        { id: '8-cayma-bildirimi', label: '8. Cayma bildirimi' },
        { id: '9-iade', label: '9. İade' },
        { id: '10-cayma-hakkinin-istisnalari', label: '10. Cayma hakkının istisnaları' },
        { id: '11-fikri-mulkiyet', label: '11. Fikri mülkiyet' },
        { id: '12-kullanim-kosullari', label: '12. Kullanım koşulları' },
        { id: '13-kisisel-veriler', label: '13. Kişisel veriler' },
        { id: '14-uyusmazliklar', label: '14. Uyuşmazlıklar' },
        { id: '15-yururluk', label: '15. Yürürlük' },
      ]}
    >
      <LegalSection title="1. Taraflar">
        <CompanyInfoPanel title="SATICI BİLGİLERİ" />
        <p>
          <strong>Alıcı:</strong> Sipariş sırasında beyan edilen ad, soyad, adres, telefon, e-posta ve fatura
          bilgileridir. Bu bilgiler, ödeme formunda Alıcı tarafından girilir; sözleşme, ilgili sipariş kaydıyla
          birlikte o bilgiler üzerinden kurulmuş sayılır.
        </p>
        {order?.buyer ? (
          <p>
            Bu görüntülemedeki alıcı: {order.buyer.name} · {order.buyer.email}
          </p>
        ) : null}
      </LegalSection>

      <LegalSection title="2. Sözleşmenin konusu">
        <p>
          İşbu sözleşme; Alıcı’nın {COMPANY.websiteDisplay} üzerinden elektronik ortamda sipariş verdiği yazılım
          ürünü, dijital hizmet, abonelik veya sabit fiyatlı hizmet paketinin satışı / ifası ile tarafların bu işleme
          ilişkin hak ve yükümlülüklerini kapsar. Sitede fiyatı tanımlanmamış kurumsal yazılım, CRM veya özel proje
          işleri bu sözleşmenin otomatik konusu değildir; bunlar teklif ve ayrı yazılı mutabakat ile yürür.
        </p>
      </LegalSection>

      <LegalSection title="3. Sözleşme konusu ürün veya hizmet">
        <p>
          Ürün veya hizmetin adı, paketi, adedi, birim fiyatı, ara toplamı, varsa vergiler, toplam tutar ve para birimi
          sipariş özetinde yer alır. Aşağıdaki özet, yalnızca seçilmiş gerçek katalog kalemi veya kayıtlı sipariş için
          doldurulur; statik örnek fiyat kullanılmaz.
        </p>
        {order ? (
          <OrderLegalSummary order={order} />
        ) : (
          <p>
            Bu görüntüleme bir siparişe bağlı değildir. Ödeme sayfasından bu belgeye geldiğinizde ürün, adet ve tutar
            katalogdaki güncel fiyattan hesaplanır.
          </p>
        )}
      </LegalSection>

      <LegalSection title="4. Sipariş ve sözleşmenin kurulması">
        <p>
          Alıcı ürün veya hizmeti seçer, sipariş özetini ve toplam bedeli görür, işbu sözleşme ile ön bilgilendirme
          formunu inceler, siparişe ve ödeme yükümlülüğüne ilişkin kabulü verir ve Tami / Garanti BBVA Sanal POS üzerinden
          ödemeyi tamamlar. Sözleşme, Alıcı’nın bu kabulü ve ödemenin ödeme kuruluşu nezdinde başlatılmasıyla elektronik
          ortamda kurulmuş olur. Sipariş kaydında kabul edilen belge sürümü ve kabul zamanı saklanır.
        </p>
      </LegalSection>

      <LegalSection title="5. Ödeme">
        <p>
          Ödeme; Tami / Garanti BBVA Sanal POS altyapısı üzerinden 3D Secure ile alınır. Kart bilgileri yalnızca
          ödeme işlemini başlatmak için Tami’ye iletilir; {COMPANY.legalName} tarafından veritabanına, loglara veya
          analitik sistemlerine kaydedilmez. CVV saklanmaz. Ödeme işleminin teknik sonucu, ilgili ödeme kuruluşundan
          sunucu tarafında doğrulanır. PCI veya benzeri sertifika iddiası bu metinde yer almaz.
        </p>
      </LegalSection>

      <LegalSection title="6. Ürün veya hizmetin ifası">
        <p>
          Satın alınan kalemler kural olarak fiziksel mal değil; yazılım lisansı, abonelik, dijital erişim veya hizmet
          ifasıdır. İfa yöntemi ürüne göre dijital erişim, kullanıcı hesabı, lisans/abonelik aktivasyonu, elektronik
          teslim veya hizmetin başlatılması olabilir. Somut yöntem ve süre, sipariş özeti ve ilgili paketin teslim
          açıklamasında belirtilir.
        </p>
        {order ? (
          <p>
            Bu sipariş için ifa: {order.fulfillment} Süre: {order.fulfillmentTime}
          </p>
        ) : null}
      </LegalSection>

      <LegalSection title="7. Cayma hakkı">
        <p>
          6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği kapsamında tüketici
          işlemi niteliği taşıyan mesafeli sözleşmelerde, uygulanabilir olduğu ölçüde, Alıcı on dört gün içinde herhangi
          bir gerekçe göstermeksizin ve cezai şart ödemeksizin sözleşmeden cayma hakkına sahiptir. Süre, hizmet ifasına
          ilişkin sözleşmelerde sözleşmenin kurulduğu gün; mal teslimine ilişkin sözleşmelerde malın teslim alındığı gün
          işlemeye başlar.
        </p>
        <p>
          Cayma hakkı her dijital ürün veya hizmet için kendiliğinden aynı şekilde uygulanmaz. Yönetmelikteki istisnalar,
          ürün veya hizmetin niteliğine, ifanın başlatılıp başlatılmadığına ve Alıcı’nın bu konuda bilgilendirilip
          onay verip vermediğine göre değerlendirilir. Ticari veya mesleki amaçla hareket eden alıcılar tüketici
          işlemi rejimine girmeyebilir.
        </p>
      </LegalSection>

      <LegalSection title="8. Cayma bildirimi">
        <p>
          Cayma veya iade talebi yazılı olarak ya da kalıcı veri saklayıcısı niteliğindeki elektronik ileti ile
          yapılabilir. Bildirim:{' '}
          <a className="email-link font-semibold text-brand-600" href={`mailto:${COMPANY.emails.support}`}>
            {COMPANY.emails.support}
          </a>
        </p>
        <p>Telefonla yapılan bildirim, mevzuattaki kalıcı veri saklayıcısı şartını tek başına karşılamayabilir.</p>
      </LegalSection>

      <LegalSection title="9. İade">
        <p>
          İade hakkı oluşan durumlarda bedel iadesi, yürürlükteki mevzuat ve kullanılan ödeme yöntemine uygun biçimde
          yapılır. Tami üzerinden tahsil edilen tutarların iadesi, ilgili ödeme altyapısının süreçlerine
          ve banka/kart kuruluşu takvimine tabi olabilir. Fiziksel mal iadesi kural olarak söz konusu değildir; iade
          iletişim adresi: {displayRegistry(COMPANY.returnAddress)}.
        </p>
      </LegalSection>

      <LegalSection title="10. Cayma hakkının istisnaları">
        <p>
          Mesafeli Sözleşmeler Yönetmeliği’nin 15. maddesi uyarınca, taraflarca aksi kararlaştırılmadıkça, TicketGo
          Teknoloji’nin bu sitede sunduğu satış modeliyle ilgili başlıca istisnalar şunlardır:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Elektronik ortamda anında ifa edilen hizmetler veya tüketiciye anında teslim edilen gayrimaddi mallara
            ilişkin sözleşmeler.
          </li>
          <li>
            Cayma hakkı süresi sona ermeden önce, tüketicinin onayı ile ifasına başlanan hizmetlere ilişkin sözleşmeler.
          </li>
        </ul>
        <p>
          Bu istisnaların somut siparişe uygulanıp uygulanmayacağı; ifanın gerçekten başlayıp başlamadığı, anında
          teslim/ifa olup olmadığı ve ön bilgilendirmenin yapılıp yapılmadığı dikkate alınarak, hukuk kontrolüne tabi
          şekilde değerlendirilir. Gıda, hijyen, konaklama, taşıt veya benzeri fiziksel mal istisnaları bu sitenin satış
          modeline uygulanmaz.
        </p>
      </LegalSection>

      <LegalSection title="11. Fikri mülkiyet">
        <p>
          Satın alma; kaynak kodu, marka, tasarım, veri tabanı veya diğer fikri mülkiyet haklarının devri anlamına
          gelmez. Aksi yazılı olarak kararlaştırılmadıkça Alıcı’ya yalnızca ilgili ürün veya hizmet için sınırlı bir
          kullanım hakkı sağlanır.
        </p>
      </LegalSection>

      <LegalSection title="12. Kullanım koşulları">
        <p>
          Hizmet hukuka aykırı amaçlarla, yetkisiz erişim, sistemin bozulması, tersine mühendislik veya kötüye kullanım
          için kullanılamaz. Aykırılık halinde Satıcı erişimi durdurabilir ve yasal yollara başvurabilir.
        </p>
      </LegalSection>

      <LegalSection title="13. Kişisel veriler">
        <p>
          Kişisel verilerin işlenmesine ilişkin ayrıntılar{' '}
          <Link href="/kvkk" className="font-semibold text-brand-600">
            KVKK Aydınlatma Metni
          </Link>{' '}
          ve{' '}
          <Link href="/privacy" className="font-semibold text-brand-600">
            Gizlilik Politikası
          </Link>{' '}
          sayfalarındadır. Aydınlatma metni, sipariş için açık rıza yerine geçmez.
        </p>
      </LegalSection>

      <LegalSection title="14. Uyuşmazlıklar">
        <p>
          Tüketici niteliğindeki Alıcı, yürürlükteki mevzuattan doğan Tüketici Hakem Heyeti ve Tüketici Mahkemesi
          başvuru haklarını kullanabilir. Bu sözleşme söz konusu hakları ortadan kaldırmaz. Uyuşmazlıklarda Türk hukuku
          uygulanır.
        </p>
      </LegalSection>

      <LegalSection title="15. Yürürlük">
        <p>
          Alıcı’nın ödeme sayfasında Mesafeli Satış Sözleşmesi ve Ön Bilgilendirme Formu’nu okuduğunu ve siparişe ilişkin
          ödeme yükümlülüğünü kabul ettiğini işaretlemesi ve ödemeyi başlatması ile sözleşme elektronik ortamda yürürlüğe
          girer. Kabul edilen metin sürümü: {doc.version}. Metin sonradan güncellenirse yeni sürüm, kabul anındaki eski
          sürümün yerine geçmez.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
