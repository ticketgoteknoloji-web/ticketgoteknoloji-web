import Link from 'next/link';
import { COMPANY, displayRegistry, displayRegistryPreferValue, hasRegistryValue } from '@/config/company';
import { LEGAL_VERSIONS, formatLegalDate } from '@/lib/legal/versions';

export const PRIVACY_TOC = [
  { id: 'veri-sorumlusu', label: '1. Veri Sorumlusu' },
  { id: 'islenabilecek-kisisel-veri-kategorileri', label: '2. İşlenebilecek Kişisel Veri Kategorileri' },
  { id: 'odeme-ve-finansal-islem-bilgileri', label: '3. Ödeme ve Finansal İşlem Bilgileri' },
  { id: 'kisisel-verilerin-islenme-amaclari', label: '4. Kişisel Verilerin İşlenme Amaçları' },
  { id: 'kisisel-verilerin-aktarilmasi', label: '5. Kişisel Verilerin Aktarılması' },
  { id: 'kisisel-verilerin-toplanma-yontemi', label: '6. Kişisel Verilerin Toplanma Yöntemi' },
  { id: 'kisisel-verilerin-islenmesinin-hukuki-sebepleri', label: '7. Hukuki Sebepler' },
  { id: 'cerez-cookie-kullanimi', label: '8. Çerez (Cookie) Kullanımı' },
  { id: 'kisisel-verilerin-saklanmasi', label: '9. Kişisel Verilerin Saklanması' },
  { id: 'veri-guvenligi', label: '10. Veri Güvenliği' },
  { id: 'ilgili-kisinin-haklari', label: '11. İlgili Kişinin Hakları' },
  { id: 'kvkk-kapsaminda-basvuru', label: '12. KVKK Kapsamında Başvuru' },
  { id: 'ucuncu-taraf-hizmet-ve-baglantilar', label: '13. Üçüncü Taraf Hizmet ve Bağlantılar' },
  { id: 'politika-guncellemeleri', label: '14. Politika Güncellemeleri' },
] as const;

/**
 * PrivacyContent — single source of truth for Gizlilik Politikası.
 * Used in both /privacy page and LegalModal overlay.
 */
export function PrivacyContent({ omitChrome = false }: { omitChrome?: boolean }) {
  const doc = LEGAL_VERSIONS.privacy;

  return (
    <div className={omitChrome ? 'legal-content-modal space-y-8 text-sm leading-7 text-ink' : 'space-y-8 text-sm leading-7 text-ink'}>
      {!omitChrome ? (
      <div className="border-b border-line pb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">
          {COMPANY.legalName}
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          Gizlilik ve Kişisel Verilerin Korunması Politikası
        </h2>
        <p className="mt-1 text-xs text-muted">
          Sürüm {doc.version} · Son güncelleme: {formatLegalDate(doc.updatedAt)}
        </p>
        <p className="mt-3 text-sm leading-6 text-muted">
          {COMPANY.legalName} olarak kişisel verilerin gizliliğine, güvenliğine ve yürürlükteki veri koruma
          mevzuatına uygun biçimde işlenmesine önem veriyoruz. İşbu politika,{' '}
          <a href={COMPANY.websiteUrl} className="font-semibold text-brand-600">
            {COMPANY.websiteDisplay}
          </a>{' '}
          üzerinden sunulan dijital hizmetler kapsamında kişisel verilerin hangi amaçlarla ve hangi esaslara göre
          işlenebileceğine ilişkin genel bilgilendirmeyi içermektedir.
        </p>
      </div>
      ) : null}

      {/* ── 1. Veri Sorumlusu ── */}
      <section id="veri-sorumlusu" className="scroll-mt-28">
        <h3 className="legal-h3">1. Veri Sorumlusu</h3>
        <p className="mt-2 text-muted">
          6698 sayılı Kişisel Verilerin Korunması Kanunu (&ldquo;KVKK&rdquo;) uyarınca,{' '}
          <a href={COMPANY.websiteUrl} className="font-semibold text-brand-600">
            {COMPANY.websiteDisplay}
          </a>{' '}
          üzerinden yürütülen kişisel veri işleme faaliyetleri bakımından veri sorumlusu{' '}
          <strong className="font-semibold text-ink">{COMPANY.legalName}</strong>&apos;dir.
        </p>
        <div className="mt-4 rounded-lg border border-line bg-canvas px-5 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand-600">İletişim Bilgileri</p>
          <dl className="space-y-2">
            <div className="grid gap-1 sm:grid-cols-[160px_1fr]">
              <dt className="font-medium text-ink">Şirket Ünvanı</dt>
              <dd className="text-muted">{COMPANY.legalName}</dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[160px_1fr]">
              <dt className="font-medium text-ink">Adres</dt>
              <dd className="text-muted">{displayRegistry(COMPANY.address)}</dd>
            </div>
            {hasRegistryValue(COMPANY.phone) ? (
            <div className="grid gap-1 sm:grid-cols-[160px_1fr]">
              <dt className="font-medium text-ink">Telefon</dt>
              <dd className="text-muted">
                <a href={COMPANY.phoneHref} className="font-semibold text-brand-600">
                  {displayRegistryPreferValue(COMPANY.phone)}
                </a>
              </dd>
            </div>
            ) : null}
            <div className="grid gap-1 sm:grid-cols-[160px_1fr]">
              <dt className="font-medium text-ink">Web Sitesi</dt>
              <dd className="text-muted">
                <a href={COMPANY.websiteUrl} className="font-semibold text-brand-600">
                  {COMPANY.websiteDisplay}
                </a>
              </dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[160px_1fr]">
              <dt className="font-medium text-ink">Genel E-posta</dt>
              <dd className="text-muted">
                <a href={`mailto:${COMPANY.emails.info}`} className="email-link font-semibold text-brand-600">
                  {COMPANY.emails.info}
                </a>
              </dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[160px_1fr]">
              <dt className="font-medium text-ink">KVKK Başvuru</dt>
              <dd className="text-muted">
                <a href={`mailto:${COMPANY.emails.kvkk}`} className="email-link font-semibold text-brand-600">
                  {COMPANY.emails.kvkk}
                </a>
              </dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[160px_1fr]">
              <dt className="font-medium text-ink">Teknik Destek</dt>
              <dd className="text-muted">
                <a href={`mailto:${COMPANY.emails.support}`} className="email-link font-semibold text-brand-600">
                  {COMPANY.emails.support}
                </a>
              </dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[160px_1fr]">
              <dt className="font-medium text-ink">Vergi Dairesi</dt>
              <dd className="text-muted">{displayRegistry(COMPANY.taxOffice)}</dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[160px_1fr]">
              <dt className="font-medium text-ink">Vergi Numarası</dt>
              <dd className="text-muted">{displayRegistry(COMPANY.taxNumber)}</dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[160px_1fr]">
              <dt className="font-medium text-ink">MERSİS Numarası</dt>
              <dd className="text-muted">{displayRegistry(COMPANY.mersis)}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ── 2. İşlenebilecek Kişisel Veri Kategorileri ── */}
      <section id="islenabilecek-kisisel-veri-kategorileri" className="scroll-mt-28">
        <h3 className="legal-h3">2. İşlenebilecek Kişisel Veri Kategorileri</h3>
        <p className="mt-2 text-muted">
          {COMPANY.legalName}, yürütülen faaliyetin gerektirdiği ölçüde aşağıdaki kişisel veri kategorilerini
          işleyebilir:
        </p>
        <div className="mt-3 space-y-4">
          <div>
            <p className="font-medium text-ink">Kimlik Bilgileri</p>
            <p className="text-muted">
              İletişim, teklif, sipariş veya ödeme işlemleri sırasında gerekli olduğu ölçüde ad ve soyad.
            </p>
          </div>
          <div>
            <p className="font-medium text-ink">İletişim Bilgileri</p>
            <p className="text-muted">
              Cep telefonu numarası, e-posta adresi; iletişim taleplerinde kullanıcı tarafından sağlanan diğer
              iletişim bilgileri.
            </p>
          </div>
          <div>
            <p className="font-medium text-ink">Kurumsal / Fatura Bilgileri</p>
            <p className="text-muted">
              Kurumsal satın alma veya faturalandırma süreçlerinde gerekli olduğu ölçüde firma ünvanı, vergi dairesi,
              vergi numarası ve fatura adresi.
            </p>
          </div>
          <div>
            <p className="font-medium text-ink">Müşteri İşlem ve Sipariş Bilgileri</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
              <li>Talep edilen ürün veya hizmet</li>
              <li>Sipariş bilgileri, ürün/paket bilgisi, işlem tarihi</li>
              <li>Sipariş numarası ve ödeme işlem durumu</li>
              <li>İptal/iade talebi bilgileri</li>
              <li>Destek talebi içeriği</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-ink">İşlem Güvenliği Bilgileri</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
              <li>IP adresi</li>
              <li>Tarayıcı ve cihaz bilgileri</li>
              <li>İşlem zamanı ve talep edilen sayfa</li>
              <li>Oturum ve güvenlik kayıtları, sistem logları</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-ink">İletişim ve Talep İçeriği</p>
            <p className="text-muted">
              Kullanıcı tarafından iletişim formu, e-posta veya destek talebi aracılığıyla iletilen mesaj ve talep
              bilgileri.
            </p>
          </div>
        </div>
      </section>

      {/* ── 3. Ödeme Bilgileri ── */}
      <section id="odeme-ve-finansal-islem-bilgileri" className="scroll-mt-28">
        <h3 className="legal-h3">3. Ödeme ve Finansal İşlem Bilgileri</h3>
        <p className="mt-2 text-muted">
          {COMPANY.websiteDisplay} üzerinden gerçekleştirilebilecek kartlı ödeme işlemleri, ilgili banka ve/veya
          yetkili ödeme altyapısı üzerinden yürütülmektedir. Ödeme işlemlerinde QNBpay / QNB Sanal POS altyapısı
          kullanılmaktadır.
        </p>
        <p className="mt-2 text-muted">
          {COMPANY.legalName}, kart numarası ve CVV/CVC gibi hassas kart doğrulama verilerini kalıcı olarak
          saklamayı amaçlamaz. Bu veriler ilgili ödeme sağlayıcısının güvenli altyapısı üzerinden işlenir.
        </p>
        <p className="mt-2 text-muted">
          Ödeme süreciyle ilgili olarak {COMPANY.legalName} sistemlerinde gerekli olduğu ölçüde şu işlem kayıtları
          tutulabilir:
        </p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
          <li>Sipariş numarası ve ödeme referans numarası</li>
          <li>Ödeme durumu ve işlem tutarı</li>
          <li>KDV tutarı ve toplam tahsilat tutarı</li>
          <li>Ödeme tarihi ve sağlayıcı işlem referansı</li>
        </ul>
      </section>

      {/* ── 4. İşleme Amaçları ── */}
      <section id="kisisel-verilerin-islenme-amaclari" className="scroll-mt-28">
        <h3 className="legal-h3">4. Kişisel Verilerin İşlenme Amaçları</h3>
        <p className="mt-2 text-muted">Kişisel veriler, ilgili faaliyete göre aşağıdaki amaçlarla işlenebilir:</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted">
          <li>İletişim ve bilgi taleplerinin karşılanması</li>
          <li>Teklif taleplerinin değerlendirilmesi</li>
          <li>Ürün ve hizmet satış süreçlerinin yürütülmesi</li>
          <li>Sipariş oluşturulması ve yönetilmesi</li>
          <li>Ödeme işlemlerinin yürütülmesi ve doğrulanması</li>
          <li>Faturalandırma ve muhasebe süreçlerinin yürütülmesi</li>
          <li>Teknik destek ve bakım taleplerinin yönetilmesi</li>
          <li>İptal ve iade işlemlerinin yürütülmesi</li>
          <li>Müşteri ilişkileri süreçlerinin yönetilmesi</li>
          <li>Bilgi güvenliğinin sağlanması</li>
          <li>Yetkisiz veya kötüye kullanım girişimlerinin tespit edilmesi</li>
          <li>Sistem sürekliliği ve teknik performansın sağlanması</li>
          <li>Yasal yükümlülüklerin yerine getirilmesi</li>
          <li>Yetkili kamu kurumlarının taleplerinin karşılanması</li>
          <li>Uyuşmazlıkların yönetilmesi ve hakların korunması</li>
          <li>
            Kullanıcı tarafından ayrıca açık rıza verilmişse ticari elektronik ileti süreçlerinin yürütülmesi
          </li>
        </ul>
      </section>

      {/* ── 5. Aktarım ── */}
      <section id="kisisel-verilerin-aktarilmasi" className="scroll-mt-28">
        <h3 className="legal-h3">5. Kişisel Verilerin Aktarılması</h3>
        <p className="mt-2 text-muted">
          Kişisel veriler, ilgili hizmetin yürütülmesi ve yasal yükümlülüklerin yerine getirilmesi amacıyla gerekli
          olduğu ölçüde ve KVKK&apos;nın ilgili hükümleri çerçevesinde üçüncü taraflara aktarılabilir.
        </p>
        <p className="mt-2 text-muted">Gerçek faaliyetlere bağlı olarak alıcı grupları:</p>
        <ul className="mt-1 list-disc space-y-1.5 pl-5 text-muted">
          <li>Bankalar ve ödeme hizmeti sağlayıcıları</li>
          <li>QNBpay / QNB Sanal POS ödeme altyapısı sağlayıcıları</li>
          <li>Muhasebe ve mali müşavirlik hizmet sağlayıcıları</li>
          <li>E-fatura / e-arşiv hizmet sağlayıcıları</li>
          <li>Hosting, sunucu ve bilişim altyapısı sağlayıcıları</li>
          <li>E-posta hizmet sağlayıcıları</li>
          <li>Teknik destek ve güvenlik hizmet sağlayıcıları</li>
          <li>Hukuken yetkili kamu kurum ve kuruluşları</li>
          <li>Mahkemeler ve diğer yetkili resmi merciler</li>
        </ul>
        <p className="mt-2 text-muted">
          Google Analytics veya Meta Pixel bu sitede kullanılmamaktadır. Reklam ağı veya izleme pikseli aktarımı
          söz konusu değildir.
        </p>
      </section>

      {/* ── 6. Toplama Yöntemi ── */}
      <section id="kisisel-verilerin-toplanma-yontemi" className="scroll-mt-28">
        <h3 className="legal-h3">6. Kişisel Verilerin Toplanma Yöntemi</h3>
        <p className="mt-2 text-muted">Kişisel veriler aşağıdaki kanallardan elde edilebilir:</p>
        <ul className="mt-1 list-disc space-y-1.5 pl-5 text-muted">
          <li>{COMPANY.websiteDisplay} web sitesi</li>
          <li>İletişim formları</li>
          <li>Güvenli ödeme ve sipariş ekranları</li>
          <li>E-posta iletişimleri</li>
          <li>
            WhatsApp&apos;a yönlendiren iletişim bağlantıları — kullanıcı bu bağlantıyla üçüncü taraf WhatsApp
            uygulamasına yönlendirilir; WhatsApp konuşmaları {COMPANY.legalName} tarafından otomatik olarak
            saklanmaz
          </li>
          <li>Teknik destek kanalları</li>
          <li>Tarayıcı ve sunucu tarafından oluşturulan teknik erişim kayıtları</li>
        </ul>
      </section>

      {/* ── 7. Hukuki Sebepler ── */}
      <section id="kisisel-verilerin-islenmesinin-hukuki-sebepleri" className="scroll-mt-28">
        <h3 className="legal-h3">7. Kişisel Verilerin İşlenmesinin Hukuki Sebepleri</h3>
        <p className="mt-2 text-muted">
          Kişisel veriler, ilgili işleme faaliyetine göre KVKK&apos;nın 5. maddesinde öngörülen şartlardan uygun
          olanlara dayanılarak işlenebilir:
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted">
          <li>Bir sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması</li>
          <li>Veri sorumlusunun hukuki yükümlülüğünü yerine getirmesi</li>
          <li>Bir hakkın tesisi, kullanılması veya korunması için veri işlemenin zorunlu olması</li>
          <li>
            İlgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla veri sorumlusunun meşru menfaati
          </li>
          <li>Kanunlarda açıkça öngörülmesi</li>
          <li>Açık rızanın hukuken gerekli olduğu faaliyetlerde ilgili kişinin açık rızası</li>
        </ul>
      </section>

      {/* ── 8. Çerezler ── */}
      <section id="cerez-cookie-kullanimi" className="scroll-mt-28">
        <h3 className="legal-h3">8. Çerez (Cookie) Kullanımı</h3>
        <p className="mt-2 text-muted">
          {COMPANY.websiteDisplay}; internet sitesinin çalışmasını sağlamak, güvenliği korumak, tercihleri
          hatırlamak ve teknik performansı değerlendirmek amacıyla çerezlerden yararlanabilir.
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted">
          <li>Zorunlu çerezler — sitenin temel işlevselliği için gereklidir</li>
          <li>Güvenlik çerezleri — oturum güvenliği ve yetkilendirme için kullanılabilir</li>
          <li>Tercih çerezleri — kullanıcı tercihleri için kullanılabilir</li>
        </ul>
        <p className="mt-2 text-muted">
          Reklam veya üçüncü taraf izleme çerezi kullanılmamaktadır. QNBpay ödeme sayfasındaki çerezler ilgili
          sağlayıcının kontrolündedir. Ayrıntı için{' '}
          <Link href="/cookies" className="font-semibold text-brand-600">
            Çerez Politikası
          </Link>
          &apos;na bakınız.
        </p>
      </section>

      {/* ── 9. Saklama ── */}
      <section id="kisisel-verilerin-saklanmasi" className="scroll-mt-28">
        <h3 className="legal-h3">9. Kişisel Verilerin Saklanması</h3>
        <p className="mt-2 text-muted">
          Kişisel veriler, ilgili işleme amacının gerektirdiği süre boyunca ve varsa mevzuatta öngörülen saklama
          süreleriyle sınırlı olarak muhafaza edilir. İşleme amacı ve yasal saklama gerekliliği sona erdiğinde
          kişisel veriler yürürlükteki mevzuata uygun olarak silinebilir, yok edilebilir veya anonim hale
          getirilebilir. Pazarlama listesi, açık rıza yoksa oluşturulmaz.
        </p>
      </section>

      {/* ── 10. Güvenlik ── */}
      <section id="veri-guvenligi" className="scroll-mt-28">
        <h3 className="legal-h3">10. Veri Güvenliği</h3>
        <p className="mt-2 text-muted">
          {COMPANY.legalName}; kişisel verilerin hukuka aykırı biçimde işlenmesini veya erişilmesini önlemek ve
          verilerin güvenli şekilde muhafazasını sağlamak amacıyla, işlenen verinin ve sistemin niteliğine uygun
          teknik ve idari tedbirlerin uygulanmasını hedeflemektedir:
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted">
          <li>Yetkilendirme ve erişim kontrolleri</li>
          <li>Güvenli iletişim protokolleri (HTTPS/TLS)</li>
          <li>Sistem ve erişim logları</li>
          <li>Güvenli API tasarımı ve hız sınırlaması</li>
          <li>Güvenlik güncellemeleri ve yedekleme</li>
          <li>Hata ve olay izleme</li>
          <li>Rol bazlı erişim yönetimi</li>
        </ul>
        <p className="mt-2 text-muted">
          Mutlak güvenlik taahhüdü verilmez; alınan tedbirler makul güvenlik hedefleriyle sınırlıdır.
        </p>
      </section>

      {/* ── 11. Haklar ── */}
      <section id="ilgili-kisinin-haklari" className="scroll-mt-28">
        <h3 className="legal-h3">11. İlgili Kişinin Hakları</h3>
        <p className="mt-2 text-muted">KVKK&apos;nın 11. maddesi kapsamında aşağıdaki haklara sahipsiniz:</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted">
          <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
          <li>İşlenmişse buna ilişkin bilgi talep etme</li>
          <li>İşlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme</li>
          <li>Yurt içinde veya yurt dışında kişisel verilerin aktarıldığı üçüncü kişileri bilme</li>
          <li>Eksik veya yanlış işlenmiş olması hâlinde bunların düzeltilmesini isteme</li>
          <li>Kanunda öngörülen şartlar kapsamında silinmesini veya yok edilmesini isteme</li>
          <li>
            Düzeltme, silme veya yok etme işlemlerinin verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme
          </li>
          <li>
            İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi sonucunda kişi aleyhine bir
            sonucun ortaya çıkmasına itiraz etme
          </li>
          <li>
            Kişisel verilerin kanuna aykırı olarak işlenmesi sebebiyle zarara uğraması hâlinde zararın
            giderilmesini talep etme
          </li>
        </ul>
        <p className="mt-3 text-muted">
          KVKK kapsamındaki haklar ve başvuru usulü hakkında ayrıntılı bilgi için{' '}
          <Link href="/kvkk" className="font-semibold text-brand-600">
            KVKK Aydınlatma Metni
          </Link>
          &apos;ne bakınız.
        </p>
      </section>

      {/* ── 12. Başvuru ── */}
      <section id="kvkk-kapsaminda-basvuru" className="scroll-mt-28">
        <h3 className="legal-h3">12. KVKK Kapsamında Başvuru</h3>
        <p className="mt-2 text-muted">
          KVKK kapsamındaki başvurularınızı {COMPANY.legalName}&apos;ye aşağıdaki iletişim kanalları üzerinden
          iletebilirsiniz:
        </p>
        <ul className="mt-2 list-none space-y-1.5 text-muted">
          <li>
            <span className="font-medium text-ink">Veri Sorumlusu:</span> {COMPANY.legalName}
          </li>
          <li>
            <span className="font-medium text-ink">Adres:</span> {displayRegistry(COMPANY.address)}
          </li>
          <li>
            <span className="font-medium text-ink">Telefon:</span>{' '}
            <a href={COMPANY.phoneHref} className="font-semibold text-brand-600">
              {displayRegistry(COMPANY.phone)}
            </a>
          </li>
          <li>
            <span className="font-medium text-ink">E-posta:</span>{' '}
            <a href={`mailto:${COMPANY.emails.kvkk}`} className="email-link font-semibold text-brand-600">
              {COMPANY.emails.kvkk}
            </a>
          </li>
          <li>
            <span className="font-medium text-ink">Web:</span>{' '}
            <a href={COMPANY.websiteUrl} className="font-semibold text-brand-600">
              {COMPANY.websiteDisplay}
            </a>
          </li>
        </ul>
        <p className="mt-3 text-muted">
          Başvurular yürürlükteki mevzuatta öngörülen yöntem ve süreler çerçevesinde değerlendirilir.
          Başvurunun niteliğine göre kimlik doğrulamaya yönelik ek bilgi talep edilebilir.
        </p>
      </section>

      {/* ── 13. Üçüncü Taraf ── */}
      <section id="ucuncu-taraf-hizmet-ve-baglantilar" className="scroll-mt-28">
        <h3 className="legal-h3">13. Üçüncü Taraf Hizmet ve Bağlantılar</h3>
        <p className="mt-2 text-muted">
          {COMPANY.websiteDisplay} üzerinde üçüncü taraf hizmetlere, ödeme altyapılarına veya iletişim
          platformlarına yönlendiren bağlantılar bulunabilir. Kullanıcı üçüncü taraf bir servise
          yönlendirildiğinde ilgili hizmet sağlayıcının kendi gizlilik ve veri işleme koşulları da uygulanabilir.
          Bu durum özellikle WhatsApp iletişim yönlendirmeleri ve ödeme sayfaları için geçerlidir.
        </p>
      </section>

      {/* ── 14. Politika Güncellemeleri ── */}
      <section id="politika-guncellemeleri" className="scroll-mt-28">
        <h3 className="legal-h3">14. Politika Güncellemeleri</h3>
        <p className="mt-2 text-muted">
          {COMPANY.legalName}, işbu Gizlilik ve Kişisel Verilerin Korunması Politikası&apos;nı mevzuat,
          teknolojik altyapı veya hizmet süreçlerinde meydana gelen değişiklikler doğrultusunda güncelleyebilir.
          Politikanın güncel sürümü{' '}
          <a href={COMPANY.websiteUrl} className="font-semibold text-brand-600">
            {COMPANY.websiteDisplay}
          </a>{' '}
          üzerinden yayımlanır. Esaslı değişikliklerde sürüm numarası güncellenir.
        </p>
      </section>

      {/* ── Footer bilgi ── */}
      <div className="border-t border-line pt-6 text-xs text-muted">
        <p className="font-semibold text-ink">{COMPANY.legalName}</p>
        <p>{displayRegistry(COMPANY.address)}</p>
        <p>
          <a href={COMPANY.websiteUrl} className="font-semibold text-brand-600">
            {COMPANY.websiteDisplay}
          </a>{' '}
          ·{' '}
          <a href={`mailto:${COMPANY.emails.info}`} className="email-link font-semibold text-brand-600">
            {COMPANY.emails.info}
          </a>{' '}
          ·{' '}
          <a href={`mailto:${COMPANY.emails.kvkk}`} className="email-link font-semibold text-brand-600">
            {COMPANY.emails.kvkk}
          </a>{' '}
          ·{' '}
          <a href={COMPANY.phoneHref} className="font-semibold text-brand-600">
            {displayRegistry(COMPANY.phone)}
          </a>
        </p>
        <p className="mt-1">
          Son Güncelleme: {formatLegalDate(doc.updatedAt)} · Sürüm {doc.version}
        </p>
      </div>
    </div>
  );
}
