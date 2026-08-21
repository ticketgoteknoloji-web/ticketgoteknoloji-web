import Link from 'next/link';
import { COMPANY, displayRegistry } from '@/config/company';
import { CompanyInfoPanel } from '@/components/legal/CompanyInfoPanel';
import { LEGAL_VERSIONS, formatLegalDate } from '@/lib/legal/versions';

/**
 * Static version of the Mesafeli Satış content used in the LegalModal.
 * The full /legal/distance-sales page supports dynamic order params;
 * this modal variant shows the general template without order-specific data.
 */
export function DistanceSalesContent({ omitChrome = false }: { omitChrome?: boolean }) {
  const doc = LEGAL_VERSIONS.distanceSales;

  return (
    <div className={omitChrome ? 'legal-content-modal space-y-8 text-sm leading-7 text-ink' : 'space-y-8 text-sm leading-7 text-ink'}>
      {!omitChrome ? (
      <div className="border-b border-line pb-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
                  {COMPANY.legalName}
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                  Mesafeli Satış Sözleşmesi
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Sürüm {doc.version} · Son güncelleme: {formatLegalDate(doc.updatedAt)}
                </p>
                <p className="mt-3 text-sm leading-6 text-muted">
                  İşbu Mesafeli Satış Sözleşmesi, {COMPANY.legalName} tarafından elektronik ortamda sunulan ve
                  mesafeli olarak satın alınabilen ürün veya hizmetlere ilişkin tarafların hak ve yükümlülüklerini
                  düzenlemek amacıyla hazırlanmıştır.
                </p>
              </div>
      ) : null}

      <section>
        <h3 className="text-base font-semibold text-ink">1. Taraflar</h3>
        <div className="mt-3">
          <CompanyInfoPanel title="SATICI BİLGİLERİ" />
        </div>
        <p className="mt-3 text-muted">
          <strong className="font-medium text-ink">Alıcı:</strong> Sipariş sırasında beyan edilen ad,
          soyad, adres, telefon, e-posta ve fatura bilgileridir. Bu bilgiler ödeme formunda Alıcı
          tarafından girilir; sözleşme, ilgili sipariş kaydıyla birlikte o bilgiler üzerinden kurulmuş
          sayılır.
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-ink">2. Sözleşmenin Konusu</h3>
        <p className="mt-2 text-muted">
          İşbu sözleşme; Alıcı&apos;nın {COMPANY.websiteDisplay} üzerinden elektronik ortamda sipariş
          verdiği yazılım ürünü, dijital hizmet, abonelik veya sabit fiyatlı hizmet paketinin satışı /
          ifası ile tarafların bu işleme ilişkin hak ve yükümlülüklerini kapsar.
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-ink">3. Sözleşme Konusu Ürün veya Hizmet</h3>
        <p className="mt-2 text-muted">
          Ürün veya hizmetin adı, paketi, adedi, birim fiyatı, ara toplamı, varsa vergiler, toplam tutar
          ve para birimi sipariş özetinde yer alır. Bu belgenin ödeme sayfasından erişilen sürümünde ürün,
          adet ve tutar katalogdaki güncel fiyattan hesaplanır.
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-ink">4. Sipariş ve Sözleşmenin Kurulması</h3>
        <p className="mt-2 text-muted">
          Alıcı ürün veya hizmeti seçer, sipariş özetini ve toplam bedeli görür, işbu sözleşme ile ön
          bilgilendirme formunu inceler, siparişe ve ödeme yükümlülüğüne ilişkin kabulü verir ve QNBpay /
          QNB Sanal POS üzerinden ödemeyi tamamlar.
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-ink">5. Ödeme</h3>
        <p className="mt-2 text-muted">
          Ödeme; QNBpay / QNB Sanal POS altyapısı üzerinden, QNB&apos;nin barındırdığı güvenli 3D Host
          ödeme sayfası ile alınır. Kart numarası, CVV/CVC ve son kullanma tarihi {COMPANY.legalName}{' '}
          tarafından toplanmaz, saklanmaz, loglanmaz.
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-ink">6. Ürün veya Hizmetin İfası</h3>
        <p className="mt-2 text-muted">
          Satın alınan kalemler kural olarak fiziksel mal değil; yazılım lisansı, abonelik, dijital erişim
          veya hizmet ifasıdır. İfa yöntemi ürüne göre dijital erişim, kullanıcı hesabı, lisans/abonelik
          aktivasyonu, elektronik teslim veya hizmetin başlatılması olabilir.
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-ink">7. Cayma Hakkı</h3>
        <p className="mt-2 text-muted">
          6502 sayılı Kanun kapsamında tüketici işlemi niteliği taşıyan sözleşmelerde, uygulanabilir
          olduğu ölçüde, Alıcı on dört gün içinde herhangi bir gerekçe göstermeksizin cayma hakkına
          sahiptir. Dijital hizmet istisnalarının somut siparişe uygulanıp uygulanmayacağı ifanın
          başlatılıp başlatılmadığı ve alıcının onayına göre değerlendirilir.
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-ink">8. Cayma Bildirimi</h3>
        <p className="mt-2 text-muted">
          Cayma veya iade talebi yazılı olarak yapılabilir. Bildirim:{' '}
          <a className="email-link font-semibold text-brand-600" href={`mailto:${COMPANY.emails.support}`}>
            {COMPANY.emails.support}
          </a>
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-ink">9. İade</h3>
        <p className="mt-2 text-muted">
          İade hakkı oluşan durumlarda bedel iadesi yürürlükteki mevzuat ve kullanılan ödeme yöntemine
          uygun biçimde yapılır. Fiziksel iade adresi: {displayRegistry(COMPANY.returnAddress)}.
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-ink">10. Kişisel Veriler</h3>
        <p className="mt-2 text-muted">
          Kişisel verilerin işlenmesine ilişkin ayrıntılar KVKK Aydınlatma Metni ve Gizlilik Politikası
          belgelerindedir. Aydınlatma metni, sipariş için açık rıza yerine geçmez.
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-ink">11. Fikri Mülkiyet</h3>
        <p className="mt-2 text-muted">
          Satın alma; kaynak kodu, marka, tasarım, veri tabanı veya diğer fikri mülkiyet haklarının devri
          anlamına gelmez. Aksi yazılı olarak kararlaştırılmadıkça Alıcı&apos;ya yalnızca ilgili ürün
          veya hizmet için sınırlı bir kullanım hakkı sağlanır.
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-ink">12. Uyuşmazlıklar</h3>
        <p className="mt-2 text-muted">
          Tüketici niteliğindeki Alıcı, yürürlükteki mevzuattan doğan Tüketici Hakem Heyeti ve Tüketici
          Mahkemesi başvuru haklarını kullanabilir. Uyuşmazlıklarda Türk hukuku uygulanır.
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-ink">13. Yürürlük</h3>
        <p className="mt-2 text-muted">
          Alıcı&apos;nın ödeme sayfasında sözleşmeyi okuduğunu ve ödeme yükümlülüğünü kabul ettiğini
          işaretlemesi ile sözleşme elektronik ortamda yürürlüğe girer. Kabul edilen metin sürümü:{' '}
          {doc.version}.
        </p>
      </section>

      <div className="border-t border-line pt-6 text-xs text-muted">
        <p>
          Tam ürün/sipariş bilgisiyle görüntülemek için{' '}
          <Link href="/legal/distance-sales" className="font-semibold text-brand-600">
            sayfayı doğrudan ziyaret edin
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
