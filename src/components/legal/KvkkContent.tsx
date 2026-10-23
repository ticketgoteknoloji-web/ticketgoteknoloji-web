import Link from 'next/link';
import { COMPANY, displayRegistry, hasRegistryValue } from '@/config/company';
import { createMailto, infoRequestBody } from '@/lib/mailto';
import { CompanyInfoPanel } from '@/components/legal/CompanyInfoPanel';
import { LegalCallout, LegalSection } from '@/components/legal/LegalDocument';

export const KVKK_TOC = [
  { id: 'veri-sorumlusu', label: 'Veri Sorumlusu' },
  { id: 'islenen-kisisel-veri-kategorileri', label: 'İşlenen Kişisel Veri Kategorileri' },
  { id: 'isleme-amaclari', label: 'İşleme Amaçları' },
  { id: 'hukuki-sebepler', label: 'Hukuki Sebepler' },
  { id: 'aktarim', label: 'Aktarım' },
  { id: 'verilerin-toplanma-yontemi', label: 'Verilerin Toplanma Yöntemi' },
  { id: 'saklama-ve-guvenlik', label: 'Saklama ve Güvenlik' },
  { id: 'ilgili-kisinin-haklari', label: 'İlgili Kişinin Hakları' },
  { id: 'basvuru-yontemi', label: 'Başvuru Yöntemi' },
  { id: 'aydinlatma-ile-riza-ayrimi', label: 'Aydınlatma ile Rıza Ayrımı' },
] as const;

type Props = {
  /** Hide duplicate document chrome when wrapped by LegalPageShell or modal header. */
  omitChrome?: boolean;
};

/**
 * KvkkContent — single source of truth for KVKK Aydınlatma Metni.
 * Used both in the /kvkk full page and the LegalModal overlay.
 */
export function KvkkContent({ omitChrome = false }: Props) {
  return (
    <div className={omitChrome ? 'legal-content-modal space-y-8' : 'space-y-8'}>
      {!omitChrome ? (
        <div className="border-b border-line pb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">{COMPANY.legalName}</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            KVKK Aydınlatma Metni
          </h2>
        </div>
      ) : null}

      <LegalSection id="veri-sorumlusu" title="Veri Sorumlusu" level={3}>
        <CompanyInfoPanel title="Veri sorumlusu bilgileri" showSupport={false} showKvkk infoLabel="Genel İletişim" />
      </LegalSection>

      <LegalSection id="islenen-kisisel-veri-kategorileri" title="İşlenen Kişisel Veri Kategorileri" level={3}>
        <p>Yalnızca bu sitede gerçekten toplanan veya oluşan kategoriler:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Kimlik: ad, soyad; ödeme formunda T.C. kimlik numarası veya vergi kimlik numarası.</li>
          <li>İletişim: e-posta, telefon, fatura adresi, şehir, posta kodu.</li>
          <li>Müşteri işlem / sipariş: ürün veya paket, adet, dönem, tutar, para birimi, sipariş numarası, durum.</li>
          <li>Fatura: fatura tipi, varsa unvan.</li>
          <li>İşlem güvenliği: IP adresi ve teknik erişim kayıtları.</li>
          <li>Talep / şikâyet: destek ve KVKK başvurularında paylaştığınız içerik.</li>
          <li>
            Ödeme ile bağlantılı sınırlı işlem bilgisi: ödeme kuruluşu adı, sağlayıcı işlem/referans kimliği, ödeme
            durumu.{' '}
            <strong className="font-medium text-ink">
              Kart numarası, CVV/CVC ve son kullanma tarihi {COMPANY.legalName} sistemlerinde saklanmaz.
            </strong>
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="isleme-amaclari" title="İşleme Amaçları" level={3}>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Siparişin oluşturulması ve kaydı</li>
          <li>Sözleşmenin kurulması ve ifası</li>
          <li>Ödeme sürecinin ödeme kuruluşu üzerinden yürütülmesi</li>
          <li>Müşteri desteği</li>
          <li>Faturalandırma</li>
          <li>Yasal yükümlülüklerin yerine getirilmesi</li>
          <li>Bilgi güvenliği</li>
          <li>Uyuşmazlıkların yönetimi</li>
        </ul>
      </LegalSection>

      <LegalSection id="hukuki-sebepler" title="Hukuki Sebepler" level={3}>
        <p>Amaç ile hukuki sebep ayrı tutulur. Tüm işlemler açık rızaya bağlanmaz.</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Sipariş, sözleşme ve ifa: KVKK m.5/2-c (sözleşmenin kurulması veya ifası ile doğrudan ilgili olması).</li>
          <li>Faturalandırma ve mali kayıt: KVKK m.5/2-ç (hukuki yükümlülük).</li>
          <li>Ödeme kuruluşuna aktarım: sözleşmenin ifası ve ödeme hizmetinin yürütülmesi.</li>
          <li>Bilgi güvenliği ve uyuşmazlık: KVKK m.5/2-f (meşru menfaat) ve gerektiğinde hukuki yükümlülük.</li>
          <li>
            Kampanya / elektronik ticari ileti: yalnızca ayrı ve isteğe bağlı açık rıza varsa KVKK m.5/1. Satın alma bu
            rızaya bağlı değildir.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="aktarim" title="Aktarım" level={3}>
        <p>Gerçek aktarım yapısına göre alıcı grupları:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Ödeme hizmeti sağlayıcıları: Tami / Garanti BBVA Sanal POS — ödeme oturumu ve sonuç doğrulaması.</li>
          <li>Bankalar / finansal kuruluşlar: kartın ait olduğu kuruluş, ödeme sağlayıcısı aracılığıyla.</li>
          <li>Bilişim / altyapı hizmet sağlayıcıları: hosting ve e-posta iletimi.</li>
          <li>Mali müşavirlik: fatura ve yasal defter süreçleri gerektiğinde.</li>
          <li>Hukuken yetkili kamu kurumları: kanunî talep halinde.</li>
        </ul>
        <p>Reklam ağı veya analitik pikseli bu sitede kullanılmamaktadır.</p>
      </LegalSection>

      <LegalSection id="verilerin-toplanma-yontemi" title="Verilerin Toplanma Yöntemi" level={3}>
        <p>
          Veriler web sitesi formları, ödeme ve sipariş ekranları, elektronik posta ve teknik loglar yoluyla elektronik
          ortamda toplanır. Kart verisi ödeme kuruluşunun barındırdığı sayfada işlenir.
        </p>
      </LegalSection>

      <LegalSection id="saklama-ve-guvenlik" title="Saklama ve Güvenlik" level={3}>
        <p>
          Sipariş ve mali kayıtlar, ilgili mevzuattaki saklama süreleriyle sınırlı tutulur. Amaç ortadan kalktığında
          silinir, yok edilir veya anonim hale getirilir. Kart PAN/CVV saklama süresi tarif edilmez; bu veriler tutulmaz.
          Yetkisiz erişim, kayıp veya değiştirilmeye karşı makul güvenlik tedbirlerinin uygulanması hedeflenir.
        </p>
      </LegalSection>

      <LegalSection id="ilgili-kisinin-haklari" title="İlgili Kişinin Hakları" level={3}>
        <p>6698 sayılı Kanun m.11 kapsamında aşağıdaki haklara sahipsiniz:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
          <li>İşlenmişse buna ilişkin bilgi talep etme</li>
          <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
          <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme</li>
          <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme</li>
          <li>KVKK&apos;da öngörülen şartlar çerçevesinde silinmesini veya yok edilmesini isteme</li>
          <li>Düzeltme veya silme işlemlerinin aktarılan üçüncü kişilere bildirilmesini isteme</li>
          <li>Otomatik sistemler vasıtasıyla analiz edilmesi nedeniyle aleyhe sonuca itiraz etme</li>
          <li>Kanuna aykırı işleme nedeniyle zarara uğranması hâlinde zararın giderilmesini talep etme</li>
        </ul>
        <LegalCallout label="Başvuru Kanalı" variant="channel">
          <p>
            Başvurular{' '}
            <a className="email-link font-semibold text-brand-600" href={`mailto:${COMPANY.emails.kvkk}`}>
              {COMPANY.emails.kvkk}
            </a>{' '}
            adresine, kimliği tevsik edici bilgilerle yapılır. Talepler mevzuattaki sürelerde cevaplanır.
          </p>
        </LegalCallout>
      </LegalSection>

      <LegalSection id="basvuru-yontemi" title="Başvuru Yöntemi" level={3}>
        <p>
          KVKK kapsamındaki taleplerinizi{' '}
          <a className="email-link font-semibold text-brand-600" href={`mailto:${COMPANY.emails.kvkk}`}>
            {COMPANY.emails.kvkk}
          </a>{' '}
          adresine veya {COMPANY.legalName}&apos;nin kayıtlı şirket adresine yazılı olarak iletebilirsiniz.
        </p>
        {hasRegistryValue(COMPANY.address) ? (
          <p>
            Şirket adresi: <strong className="font-medium text-ink">{displayRegistry(COMPANY.address)}</strong>
          </p>
        ) : null}
        <p>
          Başvurularda kimlik doğrulaması için gerekli bilgiler ile talebin açık ve anlaşılır şekilde belirtilmesi
          gerekir. Başvurular yürürlükteki KVKK ve ilgili mevzuatta öngörülen süreler içerisinde değerlendirilir.
        </p>
      </LegalSection>

      <LegalSection id="aydinlatma-ile-riza-ayrimi" title="Aydınlatma ile Rıza Ayrımı" level={3}>
        <p>
          Bu metin aydınlatma yükümlülüğüne ilişkindir. Okunması, pazarlama izni veya sözleşmenin kurulması için ekstra
          bir &quot;KVKK onayı&quot; checkbox&apos;ı anlamına gelmez. Sözleşme kabulü ayrıdır. Gizlilik yaklaşımı için{' '}
          <Link href="/privacy" className="font-semibold text-brand-600">
            Gizlilik Politikası
          </Link>
          &apos;na bakınız.
        </p>
      </LegalSection>

      <div className="border-t border-line pt-6 no-print">
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
