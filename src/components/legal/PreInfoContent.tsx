import Link from 'next/link';
import { COMPANY, displayRegistry } from '@/config/company';
import { CompanyInfoPanel } from '@/components/legal/CompanyInfoPanel';
import { LEGAL_VERSIONS, formatLegalDate } from '@/lib/legal/versions';

/**
 * Static Mesafeli Satış Ön Bilgilendirme content for the LegalModal.
 * Dynamic order-aware version is at /legal/pre-information (server component).
 */
export function PreInfoContent({ omitChrome = false }: { omitChrome?: boolean }) {
  const doc = LEGAL_VERSIONS.preInformation;

  return (
    <div className={omitChrome ? 'legal-content-modal space-y-8 text-sm leading-7 text-ink' : 'space-y-8 text-sm leading-7 text-ink'}>
      {!omitChrome ? (
      <div className="border-b border-line pb-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
                  {COMPANY.legalName}
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                  Mesafeli Satış Ön Bilgilendirme Formu
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Sürüm {doc.version} · Son güncelleme: {formatLegalDate(doc.updatedAt)}
                </p>
                <p className="mt-3 text-sm leading-6 text-muted">
                  Bu form, ödeme yükümlülüğü doğmadan önce satıcı, bedel, ifa ve cayma konularında özet bilgi
                  vermek üzere hazırlanmıştır. Ayrıntılar Mesafeli Satış Sözleşmesi&apos;ndedir.
                </p>
              </div>
      ) : null}

      <section>
        <h3 className="text-base font-semibold text-ink">Satıcı / Hizmet Sağlayıcı</h3>
        <div className="mt-3">
          <CompanyInfoPanel title="Satıcı bilgileri" />
        </div>
      </section>

      <section>
        <h3 className="text-base font-semibold text-ink">Satın Alınan Ürün veya Hizmet</h3>
        <p className="mt-2 text-muted">
          Ürün veya hizmet, ödeme sayfasında seçtiğiniz katalog kalemidir. Bu sayfa ürüne bağlı
          açıldığında ad, paket ve adet gerçek katalog kaydından gelir.
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-ink">Toplam Fiyat</h3>
        <p className="mt-2 text-muted">
          Toplam bedel, ödeme sayfasındaki sipariş özetinde vergiler ve varsa ek kalemlerle birlikte
          gösterilir.
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-ink">Vergiler</h3>
        <p className="mt-2 text-muted">
          Katalog fiyatlarına KDV ayrıca uygulanabilir; sipariş özetinde ayrı satır olarak gösterilir.
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-ink">İlave Masraflar</h3>
        <p className="mt-2 text-muted">
          Belirtilmediği sürece kargo, kapıda ödeme veya montaj ücreti yoktur.
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-ink">Ödeme Yöntemi</h3>
        <p className="mt-2 text-muted">
          Tami / Garanti BBVA Sanal POS. Kart verileri {COMPANY.legalName} sisteminde tutulmaz.
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-ink">İfa / Teslim Şekli</h3>
        <p className="mt-2 text-muted">
          Dijital erişim, hesap/lisans aktivasyonu, elektronik teslim veya hizmetin başlatılması — satın
          alınan kalemin niteliğine göre.
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-ink">Cayma Hakkı</h3>
        <p className="mt-2 text-muted">
          Tüketici işlemi niteliği varsa, uygulanabilir olduğu ölçüde 14 günlük cayma hakkı söz konusu
          olabilir. Dijital hizmet ve anında ifa istisnaları her ürüne otomatik uygulanmaz; niteliğe göre
          değerlendirilir.
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-ink">Cayma Bildirimi</h3>
        <p className="mt-2 text-muted">
          <a className="email-link font-semibold text-brand-600" href={`mailto:${COMPANY.emails.support}`}>
            {COMPANY.emails.support}
          </a>
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-ink">İade Süreci</h3>
        <p className="mt-2 text-muted">
          İade hakkı doğduğunda bedel, ödeme yöntemine uygun iade edilir. Fiziksel iade adresi:{' '}
          {displayRegistry(COMPANY.returnAddress)}.
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-ink">Şikâyet ve Destek</h3>
        <p className="mt-2 text-muted">
          Destek:{' '}
          <a className="email-link font-semibold text-brand-600" href={`mailto:${COMPANY.emails.support}`}>
            {COMPANY.emails.support}
          </a>
          . Tüketici, Tüketici Hakem Heyeti ve Tüketici Mahkemesi yollarını kullanabilir.
        </p>
      </section>

      <div className="border-t border-line pt-6 text-xs text-muted">
        <p>
          Tam ürün/sipariş bilgisiyle görüntülemek için{' '}
          <Link href="/legal/pre-information" className="font-semibold text-brand-600">
            sayfayı doğrudan ziyaret edin
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
