import Link from 'next/link';
import { COMPANY } from '@/config/company';
import { createMailto, infoRequestBody } from '@/lib/mailto';
import { CompanyInfoPanel } from '@/components/legal/CompanyInfoPanel';
import { LEGAL_VERSIONS, formatLegalDate } from '@/lib/legal/versions';

/**
 * KvkkContent — single source of truth for KVKK Aydınlatma Metni.
 * Used both in the /kvkk full page and the KvkkModal overlay.
 */
export function KvkkContent() {
  const doc = LEGAL_VERSIONS.kvkk;

  return (
    <div className="space-y-8 text-sm leading-7 text-ink">
      {/* ── Meta ── */}
      <div className="border-b border-line pb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
          {COMPANY.legalName}
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          KVKK Aydınlatma Metni
        </h2>
        <p className="mt-1 text-xs text-muted">
          Sürüm {doc.version} · Son güncelleme: {formatLegalDate(doc.updatedAt)}
        </p>
        <p className="mt-3 text-sm leading-6 text-muted">
          6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında veri sorumlusu sıfatıyla{' '}
          <strong className="font-semibold text-ink">{COMPANY.legalName}</strong> tarafından kişisel
          verilerinizin işlenmesine ilişkin olarak işbu Aydınlatma Metni hazırlanmıştır. Bu metin{' '}
          <a href={COMPANY.websiteUrl} className="font-semibold text-brand-600">
            {COMPANY.websiteDisplay}
          </a>{' '}
          üzerindeki iletişim, sipariş ve ödeme süreçleri içindir.
        </p>
      </div>

      {/* ── Veri Sorumlusu ── */}
      <section>
        <h3 className="text-base font-semibold text-ink">Veri Sorumlusu</h3>
        <div className="mt-3">
          <CompanyInfoPanel
            title="Veri sorumlusu bilgileri"
            showSupport={false}
            showKvkk
            infoLabel="Genel İletişim"
          />
        </div>
      </section>

      {/* ── İşlenen Kategoriler ── */}
      <section>
        <h3 className="text-base font-semibold text-ink">İşlenen Kişisel Veri Kategorileri</h3>
        <p className="mt-2 text-muted">Yalnızca bu sitede gerçekten toplanan veya oluşan kategoriler:</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted">
          <li>Kimlik: ad, soyad; ödeme formunda T.C. kimlik numarası veya vergi kimlik numarası.</li>
          <li>İletişim: e-posta, telefon, fatura adresi, şehir, posta kodu.</li>
          <li>Müşteri işlem / sipariş: ürün veya paket, adet, dönem, tutar, para birimi, sipariş numarası, durum.</li>
          <li>Fatura: fatura tipi, varsa unvan.</li>
          <li>İşlem güvenliği: IP adresi ve teknik erişim kayıtları.</li>
          <li>Talep / şikâyet: destek ve KVKK başvurularında paylaştığınız içerik.</li>
          <li>
            Ödeme ile bağlantılı sınırlı işlem bilgisi: ödeme kuruluşu adı, sağlayıcı işlem/referans kimliği,
            ödeme durumu.{' '}
            <strong className="font-medium text-ink">
              Kart numarası, CVV/CVC ve son kullanma tarihi {COMPANY.legalName} sistemlerinde saklanmaz.
            </strong>
          </li>
        </ul>
      </section>

      {/* ── İşleme Amaçları ── */}
      <section>
        <h3 className="text-base font-semibold text-ink">İşleme Amaçları</h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted">
          <li>Siparişin oluşturulması ve kaydı</li>
          <li>Sözleşmenin kurulması ve ifası</li>
          <li>Ödeme sürecinin ödeme kuruluşu üzerinden yürütülmesi</li>
          <li>Müşteri desteği</li>
          <li>Faturalandırma</li>
          <li>Yasal yükümlülüklerin yerine getirilmesi</li>
          <li>Bilgi güvenliği</li>
          <li>Uyuşmazlıkların yönetimi</li>
        </ul>
      </section>

      {/* ── Hukuki Sebepler ── */}
      <section>
        <h3 className="text-base font-semibold text-ink">Hukuki Sebepler</h3>
        <p className="mt-2 text-muted">Amaç ile hukuki sebep ayrı tutulur. Tüm işlemler açık rızaya bağlanmaz.</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted">
          <li>Sipariş, sözleşme ve ifa: KVKK m.5/2-c (sözleşmenin kurulması veya ifası ile doğrudan ilgili olması).</li>
          <li>Faturalandırma ve mali kayıt: KVKK m.5/2-ç (hukuki yükümlülük).</li>
          <li>Ödeme kuruluşuna aktarım: sözleşmenin ifası ve ödeme hizmetinin yürütülmesi.</li>
          <li>Bilgi güvenliği ve uyuşmazlık: KVKK m.5/2-f (meşru menfaat) ve gerektiğinde hukuki yükümlülük.</li>
          <li>
            Kampanya / elektronik ticari ileti: yalnızca ayrı ve isteğe bağlı açık rıza varsa KVKK m.5/1. Satın
            alma bu rızaya bağlı değildir.
          </li>
        </ul>
      </section>

      {/* ── Aktarım ── */}
      <section>
        <h3 className="text-base font-semibold text-ink">Aktarım</h3>
        <p className="mt-2 text-muted">Gerçek aktarım yapısına göre alıcı grupları:</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted">
          <li>Ödeme hizmeti sağlayıcıları: QNBpay / QNB Sanal POS — ödeme oturumu ve sonuç doğrulaması.</li>
          <li>Bankalar / finansal kuruluşlar: kartın ait olduğu kuruluş, ödeme sağlayıcısı aracılığıyla.</li>
          <li>Bilişim / altyapı hizmet sağlayıcıları: hosting ve e-posta iletimi.</li>
          <li>Mali müşavirlik: fatura ve yasal defter süreçleri gerektiğinde.</li>
          <li>Hukuken yetkili kamu kurumları: kanunî talep halinde.</li>
        </ul>
        <p className="mt-2 text-muted">Reklam ağı veya analitik pikseli bu sitede kullanılmamaktadır.</p>
      </section>

      {/* ── Toplama Yöntemi ── */}
      <section>
        <h3 className="text-base font-semibold text-ink">Verilerin Toplanma Yöntemi</h3>
        <p className="mt-2 text-muted">
          Veriler web sitesi formları, ödeme ve sipariş ekranları, elektronik posta ve teknik loglar yoluyla
          elektronik ortamda toplanır. Kart verisi ödeme kuruluşunun barındırdığı sayfada işlenir.
        </p>
      </section>

      {/* ── Saklama ── */}
      <section>
        <h3 className="text-base font-semibold text-ink">Saklama ve Güvenlik</h3>
        <p className="mt-2 text-muted">
          Sipariş ve mali kayıtlar, ilgili mevzuattaki saklama süreleriyle sınırlı tutulur. Amaç ortadan
          kalktığında silinir, yok edilir veya anonim hale getirilir. Kart PAN/CVV saklama süresi tarif edilmez;
          bu veriler tutulmaz. Yetkisiz erişim, kayıp veya değiştirilmeye karşı makul güvenlik tedbirlerinin
          uygulanması hedeflenir.
        </p>
      </section>

      {/* ── İlgili Kişinin Hakları ── */}
      <section>
        <h3 className="text-base font-semibold text-ink">İlgili Kişinin Hakları</h3>
        <p className="mt-2 text-muted">
          6698 sayılı Kanun m.11 kapsamında aşağıdaki haklara sahipsiniz:
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted">
          <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
          <li>İşlenmişse buna ilişkin bilgi talep etme</li>
          <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
          <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme</li>
          <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme</li>
          <li>KVKK&apos;da öngörülen şartlar çerçevesinde silinmesini veya yok edilmesini isteme</li>
          <li>
            Düzeltme veya silme işlemlerinin aktarılan üçüncü kişilere bildirilmesini isteme
          </li>
          <li>
            Otomatik sistemler vasıtasıyla analiz edilmesi nedeniyle aleyhe sonuca itiraz etme
          </li>
          <li>Kanuna aykırı işleme nedeniyle zarara uğranması hâlinde zararın giderilmesini talep etme</li>
        </ul>
        <p className="mt-3 text-muted">
          Başvurular{' '}
          <a className="email-link font-semibold text-brand-600" href={`mailto:${COMPANY.emails.kvkk}`}>
            {COMPANY.emails.kvkk}
          </a>{' '}
          adresine, kimliği tevsik edici bilgilerle yapılır. Talepler mevzuattaki sürelerde cevaplanır.
        </p>
      </section>

      {/* ── Başvuru Yöntemi ── */}
      <section>
        <h3 className="text-base font-semibold text-ink">Başvuru Yöntemi</h3>
        <p className="mt-2 text-muted">
          KVKK kapsamındaki taleplerinizi{' '}
          <a className="email-link font-semibold text-brand-600" href={`mailto:${COMPANY.emails.kvkk}`}>
            {COMPANY.emails.kvkk}
          </a>{' '}
          adresine veya {COMPANY.legalName}&apos;nin kayıtlı şirket adresine yazılı olarak iletebilirsiniz.
        </p>
        <p className="mt-2 text-muted">
          Şirket adresi: <strong className="font-medium text-ink">Gümbet Mah. Mister Hadi Sok. No:2-A1 Bodrum/MUĞLA</strong>
        </p>
        <p className="mt-2 text-muted">
          Başvurularda kimlik doğrulaması için gerekli bilgiler ile talebin açık ve anlaşılır şekilde belirtilmesi
          gerekir. Başvurular yürürlükteki KVKK ve ilgili mevzuatta öngörülen süreler içerisinde değerlendirilir.
        </p>
      </section>

      {/* ── Aydınlatma/Rıza Ayrımı ── */}
      <section>
        <h3 className="text-base font-semibold text-ink">Aydınlatma ile Rıza Ayrımı</h3>
        <p className="mt-2 text-muted">
          Bu metin aydınlatma yükümlülüğüne ilişkindir. Okunması, pazarlama izni veya sözleşmenin kurulması için
          ekstra bir &quot;KVKK onayı&quot; checkbox&apos;ı anlamına gelmez. Sözleşme kabulü ayrıdır. Gizlilik
          yaklaşımı için{' '}
          <Link href="/privacy" className="font-semibold text-brand-600">
            Gizlilik Politikası
          </Link>
          &apos;na bakınız.
        </p>
      </section>

      {/* ── CTA ── */}
      <div className="border-t border-line pt-6">
        <a
          href={createMailto({
            to: COMPANY.emails.kvkk,
            subject: 'TicketGo Teknoloji | KVKK Başvurusu',
            body: infoRequestBody('KVKK', 'Talebim (öğrenme/düzeltme/silme/itiraz vb.):'),
          })}
          className="btn btn-secondary inline-flex items-center gap-2 text-sm"
        >
          KVKK Başvurusu Gönder
        </a>
      </div>
    </div>
  );
}
