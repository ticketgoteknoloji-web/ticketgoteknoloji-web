import { COMPANY, displayRegistry } from '@/config/company';
import { CompanyInfoPanel } from '@/components/legal/CompanyInfoPanel';
import { LEGAL_VERSIONS, formatLegalDate } from '@/lib/legal/versions';

export function RefundContent({ omitChrome = false }: { omitChrome?: boolean }) {
  const doc = LEGAL_VERSIONS.refund;

  return (
    <div className={omitChrome ? 'legal-content-modal space-y-8 text-sm leading-7 text-ink' : 'space-y-8 text-sm leading-7 text-ink'}>
      {!omitChrome ? (
      <div className="border-b border-line pb-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
                  {COMPANY.legalName}
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                  İptal, Cayma ve İade Koşulları
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Sürüm {doc.version} · Son güncelleme: {formatLegalDate(doc.updatedAt)}
                </p>
                <p className="mt-3 text-sm leading-6 text-muted">
                  {COMPANY.legalName} üzerinden gerçekleştirilen satın alma işlemlerinde iptal, cayma ve iade
                  süreçleri; satın alınan ürün veya hizmetin niteliğine ve yürürlükteki tüketici mevzuatına göre
                  değerlendirilir.
                </p>
              </div>
      ) : null}

      <section>
        <h3 className="text-base font-semibold text-ink">Satıcı / Hizmet Sağlayıcı</h3>
        <div className="mt-3">
          <CompanyInfoPanel title="Satıcı bilgileri" showInfo={false} />
        </div>
      </section>

      <section>
        <h3 className="text-base font-semibold text-ink">1. Genel İlkeler</h3>
        <p className="mt-2 text-muted">
          Bu siteden satın alınabilen kalemler ağırlıklı olarak yazılım lisansı, abonelik, dijital erişim
          ve hizmet ifasıdır. Her talep, somut sipariş, ifanın durumu ve 6502 sayılı Kanun ile Mesafeli
          Sözleşmeler Yönetmeliği çerçevesinde incelenir.
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-ink">2. Cayma Hakkı</h3>
        <p className="mt-2 text-muted">
          Tüketici niteliğindeki alıcı, uygulanabilir olduğu ölçüde, sözleşmenin kurulmasından itibaren
          14 gün içinde gerekçesiz cayma hakkına sahip olabilir. Cayma,{' '}
          <a className="email-link font-semibold text-brand-600" href={`mailto:${COMPANY.emails.support}`}>
            {COMPANY.emails.support}
          </a>{' '}
          adresine yazılı bildirilir.
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-ink">3. Dijital Ürün ve Hizmetler</h3>
        <p className="mt-2 text-muted">
          Dijital ürün veya hizmet satın alınması, tek başına iade hakkını ortadan kaldırmaz. Anında ifa,
          anında teslim edilen gayrimaddi mal veya alıcının onayıyla ifaya başlanmış hizmet gibi haller
          ancak mevzuattaki şartlar oluştuğunda istisna olarak devreye girebilir.
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-ink">4. İade Talebi Nasıl Yapılır?</h3>
        <p className="mt-2 text-muted">
          Sipariş numarası, e-posta ve talep konusu belirtilerek{' '}
          <a className="email-link font-semibold text-brand-600" href={`mailto:${COMPANY.emails.support}`}>
            {COMPANY.emails.support}
          </a>{' '}
          adresine yazılır. Fiziksel iade adresi (gerektiğinde):{' '}
          {displayRegistry(COMPANY.returnAddress)}.
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-ink">5. İade Süreci</h3>
        <p className="mt-2 text-muted">
          Talebin mevzuata uygun bulunduğu hallerde, bildirimden sonra yasal süreler içinde bedel iadesi
          başlatılır. İade, kural olarak tahsilatın yapıldığı yönteme (QNBpay / kart kuruluşu)
          yönlendirilir. Kart hesaplarına yansıma bankanın takvimine bağlıdır.
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-ink">6. Hatalı / Mükerrer Ödeme</h3>
        <p className="mt-2 text-muted">
          Aynı siparişin birden fazla tahsil edilmesi veya açıkça hatalı ödeme iddiaları incelenir.
          Mükerrer tahsilat doğrulanırsa uygun iade süreci başlatılır.
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold text-ink">7. Destek</h3>
        <p className="mt-2 text-muted">
          <a className="email-link font-semibold text-brand-600" href={`mailto:${COMPANY.emails.support}`}>
            {COMPANY.emails.support}
          </a>
        </p>
      </section>
    </div>
  );
}
