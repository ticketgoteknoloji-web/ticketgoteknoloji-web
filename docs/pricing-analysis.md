# TicketGo Teknoloji fiyatlandırma analizi

İnceleme tarihi: 18 Ağustos 2026  
Para birimi: USD  
Kaynak kod deposu: `Desktop/ticketgoteknoloji.com`  
Canlı şirket sitesi: https://www.ticketgoteknoloji.com  
Ürün örneği: Ticket-Go (https://www.ticket-go.net)

## Yönetici özeti

TicketGo Teknoloji A.Ş. bir ödeme/checkout şirketi değil; kurumsal yazılım, CRM, SaaS, rezervasyon/biletleme, web/mobil, API, otomasyon ve yapay zekâ entegrasyonu geliştiren bir teknoloji şirketidir. Sitede abonelik kaydı, faturalama API’si veya veritabanı yoktur. Dönüşüm yolu iletişim formudur.

Bu nedenle fiyatlandırma **hibrit** kuruldu:

- **Ürün:** Ticket-Go benzeri rezervasyon platformu için Starter / Growth / Scale + Enterprise teklif
- **Hizmet:** Discovery / MVP / Growth / Dedicated Team
- **AI:** kurulum + aylık yönetim + işlem kotası + aşım
- **Bakım:** Essential / Professional / Mission Critical
- **Add-on:** koltuk, saat, entegrasyon, mobil, veri aktarımı, ek ortam

Checkout uydurulmadı. CTA’lar `/contact` teklif formuna gider. Fiyatlar USD’dir; vergiler dahil değildir.

Growth (ürün), Growth hizmet, AI Growth ve Professional bakım “en popüler” olarak konumlandı. Yıllık peşin ödeme ürün ve bakımda %20, AI ve Dedicated Team’de %15 daha düşüktür.

## Tespit edilen ürün ve hizmetler

| Kalem | Sitedeki konum | Sınıflandırma | Teslim / değer | Tahmini iş yükü |
| --- | --- | --- | --- | --- |
| Ticket-Go rezervasyon / e-bilet / B2B / operasyon platformu | Ürün kartı, sektörler, çözümler | Hibrit: kurulum + aylık platform + kullanım kotası | Rezervasyondan operasyona dijital omurga | Kurulum 3–12 hafta; sonrası işletim |
| Kurumsal CRM | Çözüm kataloğu | Proje bazlı + isteğe bağlı barındırma | Tek müşteri görünümü, pipeline, aktivite | MVP–Growth bandı |
| Özel yazılım / dijital platform / SaaS mimarisi | Çözümler, hakkımızda | Proje bazlı “starting at” | Sürece özel ürün | 8 hafta – 7 ay |
| Web ve mobil uygulamalar | Çözüm kataloğu | Proje / add-on | Saha ve müşteri erişimi | Mobil ayrı iş paketi |
| API, e-ticaret ve sistem entegrasyonu | Çözümler | İş paketi starting at | Sistemlerin konuşması | 1–6 hafta / bağlantı |
| İş süreçleri otomasyonu | Çözümler | Proje veya AI hibrit | Tekrarlayan işin azalması | Senaryo sayısına bağlı |
| AI asistan, doküman, arama, rapor, CX | AI bölümü | Kurulum + aylık + kota | Mevcut ürüne servis katmanı | 2–10 hafta kurulum |
| Bakım / destek | `destek@` kanalı, ürün sonrası ihtiyaç | Aylık retainer | Yamalar, hata, sınırlı geliştirme | 8–40 saat / ay |
| Keşif (Discovery) | Süreç bölümü ile uyumlu | Sabit ücret | Kapsam, risk, backlog | 2–3 hafta |
| Dedicated team | Hizmet olarak eklendi | Aylık kapasite | Sürekli yol haritası | ~160 saat / ay başlangıç |

Tekrarlayan maliyetler (doğrudan gözlenen iç fatura yoktur; model varsayımı):

- Barındırma, izleme, yedekleme
- LLM / API token
- SMS ve e-posta sağlayıcı
- Ödeme kuruluşu komisyonu (müşteri hesabı; pakete gömülmedi)
- Destek saati
- Üçüncü taraf lisans

Mevcut fiyat / ödeme akışı: yoktu. CTA’lar iletişim formuna (`ticketgo:set-project-type` ve `?need=`) gidiyordu. Güven riski: fiyatın hiç görünmemesi kurumsal alıcıda “belirsiz ajans” algısı yaratır; sahte müşteri sayısı veya tasarruf yüzdesi eklenmedi.

## Hedef müşteri segmentleri

1. Ulaşım, turizm ve rezervasyon operatörleri (Ticket-Go benzeri ihtiyaç)
2. Satış ve hizmet ekipleri olan KOBİ / mid-market firmalar (özel CRM, operasyon)
3. B2B acente / bayi ağı yöneten şirketler
4. Mevcut ürüne AI katmanı eklemek isteyen ürün ekipleri
5. Canlı sistemini bakım altına almak isteyen şirketler

Hedef kitle “self-servis 29 USD CRM” değil; keşif sonrası kurulan, sürece özel platformdur.

## Rakip karşılaştırma tablosu

Erişim tarihi aksi belirtilmedikçe **18 Ağustos 2026**. Resmî sayfası alınamayan veya oran yayımlamayan satırlar “fiyat açıklanmıyor / custom quote” diye işaretlendi.

### CRM / müşteri platformu

| Şirket | Kaynak | İnceleme | Paketler | Fiyat | Kurulum / ek | Limit / deneme | Kurumsal | Konumlandırma |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| HubSpot Sales Hub | https://www.hubspot.com/pricing/sales | 2026-08-18 (resmî sayfa) | Free, Starter, Professional, Enterprise | Free 0; Starter 7 USD/koltuk/ay (yıllık) / 20 USD (aylık); Professional 90 / 100; Enterprise 150 | Professional onboarding 1.500 USD; Enterprise 3.500 USD. Credits 0,010 USD | Free 2 kullanıcı. Starter 500 credit | Enterprise: Talk to Sales | Ajans CRM’si değil; koltuklu müşteri platformu |
| Salesforce Sales / CRM | https://www.salesforce.com/small-business/pricing/ ve https://www.salesforce.com/crm/pricing/ | 2026-08-18 (small-business sayfası arama özeti; crm/pricing fetch zaman aşımı) | Free, Starter, Pro, Enterprise, Unlimited, Agentforce 1 | Starter 25 USD/kullanıcı/ay; Pro 100; Enterprise 175 (ikincil kaynak 2026-07-05: saascrmreview.com, Salesforce notu “bilgilendirme amaçlı”) | Sözleşme; işlem ücretleri Starter’da belirtiliyor | Free 2 lisans; deneme var | Talk to Sales / yıllık sözleşme | Üst uç CRM; liste fiyatı pazarın tavanı |
| Zoho CRM | https://www.zoho.com/crm/zohocrm-pricing.html | 2026-08-18 (sayfa INR’ye yerelleşti). USD tablo: https://www.zoho.com/sites/default/files/crm/n-crm-comparison.pdf | Free, Standard, Professional, Enterprise, Ultimate | USD yıllık: 14 / 23 / 40 / 52 kullanıcı-ay. Aylık: 20 / 35 / 50 / 65. Free 3 kullanıcı | Jumpstart / destek planları ayrı | 15 gün deneme (ikincil 2026 kaynakları) | Ultimate / satış ekibi | Düşük koltuk maliyeti; asıl maliyet uygulamada |
| Pipedrive | https://www.pipedrive.com/en/pricing (doğrudan fetch 2026-08-18 zaman aşımı). Plan adları: https://support.pipedrive.com/en/article/what-features-do-the-pipedrive-plans-have | 2026-08-18. USD rakamları axisconsulting.io (resmî sayfaya 2026-08-03 bakılmış) | Lite, Growth, Premium, Ultimate | Yıllık: 14 / 39 / 59 / 79 kullanıcı-ay. Aylık: 24 / 49 / 79 / 99 | LeadBooster vb. şirket bazlı eklenti | 14 gün deneme; kalıcı ücretsiz paket yok | Ultimate | Satış pipeline CRM |
| HubSpot Smart CRM (bağımsız koltuk) | https://www.hubspot.com/pricing/smart-crm | 2026-08-18 | Professional, Enterprise | 45 / 75 USD/koltuk/ay | Credit paketi | Hub bazlı | Talk to Sales | Hub’suz CRM koltuğu |

**Pazar aralığı (CRM lisansı):** ücretsiz – ~25 USD giriş; büyüme 40–100 USD/kullanıcı/ay; kurumsal 150–550 USD/kullanıcı/ay. TicketGo bu koltuk savaşına girmez; özel CRM’i **proje starting at** satar.

### Rezervasyon / tur / aktivite platformları (Ticket-Go’ya yakın)

| Şirket | Kaynak | İnceleme | Paketler | Fiyat | Kurulum / ek | Limit | Kurumsal | Konumlandırma |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rezdy | https://rezdy.com/pricing/ | 2026-08-18 resmî | Foundation, Accelerate, Expansion | 49 / 99 / 249 USD/ay + online rezervasyonda %3 | Offline/acente: 1 / 0,85 / 0,70 USD | 21 gün deneme; GST hariç (AU) | Expansion API/webhook | Şeffaf kademe + yüzde |
| Checkfront | https://www.checkfront.com/pricing/ | 2026-08-18 resmî | Tek plan (bölgeye göre değişebilir) | 99 USD/ay + online %3 (GBP 99 de gösteriliyor; “region and currency”) | Kurulum yok deniyor | Offline ücretsiz | Custom / demo | Basit şeffaf fiyat |
| Bókun | https://www.bokun.io/pricing | 2026-08-18 resmî | Free, START, PLUS, PREMIUM | 0; 49 + %1,5; 149 + %1,25; 499 + %1. Viator ve offline Bókun ücreti 0 | 14 gün deneme | 1 / 5 / 10 / sınırsız kullanıcı | Custom plan CTA | Düşük yüzde + kanal yöneticisi |
| FareHarbor | https://marketing.fareharbor.com/legal/tos-providers/ | 2026-08-18 resmî TOS | Tek model | **Booking fee oranı yayımlanmıyor** (“communicated separately”). Aylık abonelik TOS’ta zorunlu liste fiyatı değil | Additional services ayrı | — | Sözleşmeli | Komisyon; üçüncü taraf bloglar ~%6 der — **kesin resmi fiyat değil** |
| Peek Pro | Resmî fiyat sayfası bu çalışmada doğrulanamadı | 2026-08-18 | — | **Custom quote / fiyat açıklanmıyor** | Onboarding bazlı olduğu yönünde ikincil iddialar var | — | Satış | Quote |

**Pazar aralığı (tur rezervasyonu):** 0–499 USD/ay sabit + %1–3 (yayımlanan) veya yayımlanmayan komisyon. Ticket-Go feribot/B2B/operasyon odaklı olduğu için yüzde GMV yerine **sabit platform + kayıt kotası** seçildi; aksi halde ölçekte marj erir.

### Özel yazılım / ajans

| Kaynak | Tür | İnceleme | Yayımlanan aralık | Not |
| --- | --- | --- | --- | --- |
| Clutch 2026 (Wappnet / Founders Workshop alıntısı) | Sektör derlemesi | 2026-08-18 | Ortalama proje ~132.480 USD, ~13 ay; saat 25–149 USD bölgeye göre | Birincil Clutch sayfası bu turda açılmadı; Nisan–Haziran 2026 alıntıları |
| https://wappnet.com/blog/custom-software-development-cost-breakdown-2026/ | Ajans rehberi | 2026-08-18 | MVP 10–50k; orta 50–200k; kurumsal 200k+ | Clutch’a atıf |
| https://foundersworkshop.com/feeds/blog/custom-software-development-cost | Ajans | 2026-08-18 | MVP 25–80k; SaaS 100–350k+ | Clutch Haziran 2026 |
| https://beevr.ai/mvp-development-cost | Ürünleştirilmiş MVP | 2026-08-18 | Demo ~4k; MVP ~18k; production ~38k (kendi paketleri) | Pazar bandı 10–150k dedi |
| https://launchdayadvisors.com/guides/custom-software-development-cost | Danışmanlık | 2026-08-18 | Basit 50–150k; orta 150–400k; karmaşık 400k–1M+ (ABD kıdemli saat) | ABD tavanı |

ABD butik ajansların çoğu **custom quote**. Toptal / Andela benzeri dedicated network’ler liste fiyatı yayımlamaz.

### AI / otomasyon

| Şirket | Kaynak | İnceleme | Paketler | Fiyat | Kota / aşım |
| --- | --- | --- | --- | --- | --- |
| Zapier | https://zapier.com/pricing | 2026-08-18 resmî | Free, Professional, Team, Enterprise | Free 0 / 100 task. Pro 19,99 yıllık / 29,99 aylık (750 task). Team 69 / 103,50 (2.000 task) | Task kademesi 2M’ye kadar; Enterprise custom. AI adımları 2026-06-15’ten itibaren model çarpanlı |
| Make | https://www.make.com/en/pricing (doğrudan tutarlı rakam alınamadı) | 2026-08-18 | Free, Core, Pro, Teams, Enterprise | Kaynaklar çelişiyor: Core yıllık 9 USD (comparedge / smartprocessflow) ve 12 USD (zapier.com/blog/make-com-pricing/). **Kesin resmî rakam olarak kilitleme** | 1.000 ücretsiz kredi; ücretlilerde 10.000 başlangıç (ikincil) |
| OpenAI API | https://developers.openai.com/api/docs/pricing | 2026-08-18 resmî | gpt-5.6-sol / terra / luna | 1M token kısa bağlam: Sol 5 / 30; Terra 2 / 12; Luna 0,20 / 1,20 USD (input/output) | Kullanım bazlı; data residency +%10 |
| HubSpot Credits | HubSpot Sales fiyat sayfası | 2026-08-18 | Credit | 0,010 USD / credit (yıllık alım notu) | Pakete gömülü credit + pay as you go |
| Özel LLM entegrasyon stüdyoları | — | 2026-08-18 | — | **Custom quote** | Setup + kullanım |

### Bakım

| Kaynak | İnceleme | Aralık | Model |
| --- | --- | --- | --- |
| Sektör kuralı (birden fazla 2026 rehberi) | 2026-08-18 | Yıllık bakım, ilk geliştirme bedelinin %15–25’i | Retainer veya yüzde |
| https://apipilot.com/software-maintenance-and-support-packages-the-2026-enterprise-buying-guide/ | 2026-08-18 | Temel ~2.500 USD/ay’den; 24/7 15.000 USD/ay’e (kurumsal iddia) | SLA’lı managed |
| https://viprasol.com/blog/software-maintenance-costs/ | 2026-08-18 | Kendi “from 500 USD/ay” iddiası | Ajans paketleri doğrulanmış pazar fiyatı değil |

## Pazar fiyat aralıkları (özet)

| Kategori | Giriş | Orta | Üst / kurumsal |
| --- | --- | --- | --- |
| CRM koltuk | 0–25 USD | 40–100 USD | 150–550 USD |
| Rezervasyon SaaS | 0–99 USD + % | 99–249 USD + % | 499 USD + % veya custom komisyon |
| Özel yazılım projesi | 10–50k USD | 50–150k USD | 200k–500k+ USD |
| Dedicated ekip (çıkarım, ABD altı teslimat) | ~8–15k USD/ay | 15–25k | 25k+ |
| AI otomasyon platformu | 0–30 USD/ay tool | 70–150 USD tool | Custom + token |
| Bakım | ~500–1.000 USD/ay küçük | 1.5–4k | 10k+ mission-critical iddiaları |

## Önerilen fiyat tablosu

Ayrıntılı makine okunur kopya: `docs/pricing-catalog.json`.

| Kalem | Önerilen | Minimum | Premium | Birim |
| --- | --- | --- | --- | --- |
| Ticket-Go Starter | 249 | 199 | 349 | USD/ay, starting at |
| Ticket-Go Growth | 790 | 690 | 990 | USD/ay, starting at |
| Ticket-Go Scale | 1.690 | 1.490 | 2.190 | USD/ay, starting at |
| Ticket-Go Enterprise | Teklif | ~2.500 | — | Özel SLA |
| Discovery | 5.800 | 4.900 | 7.800 | Tek seferlik sabit |
| MVP | 48.000 | 36.000 | 72.000 | Proje starting at |
| Growth ürün | 96.000 | 78.000 | 145.000 | Proje starting at |
| Dedicated Team | 14.500 | 12.500 | 22.000 | USD/ay starting at |
| AI Starter | 590 + 3.900 kurulum | 490 | 790 | USD/ay |
| AI Growth | 1.490 + 8.500 kurulum | 1.190 | 1.890 | USD/ay |
| AI Scale | 3.200 + teklif kurulum | 2.890 | 4.500 | USD/ay |
| Essential bakım | 890 | 790 | 1.090 | USD/ay |
| Professional bakım | 1.790 | 1.490 | 2.190 | USD/ay |
| Mission Critical | 3.900 | 3.200 | 5.900 | USD/ay |

Yıllık eşdeğer (ürün/bakım %20, AI/ekip %15) sitede anahtarla hesaplanır. Örnek: Starter aylık 249 USD → yıllık eşdeğer 199,20 USD/ay, peşin 2.390,40 USD, tasarruf 597,60 USD.

## Maliyet ve marj varsayımları

İç muhasebe yoktur. Varsayımlar:

- Yüklü teslimat maliyeti 50 USD/saat
- Ticket-Go aboneliğinde barındırma+izleme Starter ~70, Growth ~200, Scale ~450 USD/ay → yazılım marjı ~%70 (destek saati ayrı retainer’dadır)
- AI işlem COGS ~0,012 USD (OpenAI Terra bandı + sapma); aşım 0,045 USD → ~%70
- Discovery 5.800 / ~40 saat = %65’e yakın
- MVP 48.000, ~336 saat varsayımı ile ~%65; gerçek kapsam şişerse marj düşer — bu yüzden starting at
- Hizmetlerde hedef %55–65; abonelikte ≥%65
- Hosting, LLM ve SMS aşımları kotaya veya müşteri faturasına yazılır

## Paket kapsamları

Her paketin dahil / hariç / müşteri sorumluluğu / revizyon / teslim / iptal maddeleri katalogda ve sitede durur. Özet:

- Ticket-Go: ortam + kullanıcı + kayıt kotası + kurulum. Ödeme komisyonu hariç.
- Hizmetler: keşif raporu veya fazlı yazılım. Sınırsız özellik yok.
- AI: senaryo + kota. Modelin her zaman doğru yanıtı taahhüt edilmez.
- Bakım: saat + SLA penceresi. Kullanılmayan saat devretmez.

## Add-on ve aşım ücretleri

- Ek operatör: 29 USD/kullanıcı/ay
- Ek uzman saati: 145 USD
- Özel entegrasyon: 4.900 USD starting at
- Mobil uygulama: 24.000 USD starting at
- Veri aktarımı: 3.500 USD starting at
- Ek ortam: 190 USD/ay
- Bilet aşımı: Starter 0,15 / Growth 0,12 / Scale 0,08 USD
- AI aşımı: 0,045 USD/işlem
- SMS: 0,08 USD starting at (operatör tarifesine bağlı)

## Fiyatlandırma gerekçeleri

- Ticket-Go, Rezdy/Checkfront/Bókun widget SaaS’ından pahalıdır çünkü B2B + operasyon + kurulumlu teslimattır; FareHarbor tarzı gizli yüzdeye girilmedi.
- CRM koltuk fiyatı yayımlanmadı; HubSpot/Zoho ile özellik karşılaştırması yanıltır.
- Orta paketler (Growth / Professional) kasıtlı olarak en mantıklı seçenek: B2B ve operasyon Starter’da yok; Scale ise API ve hacim isteyenlere.
- Yıllık %20, nakit akışını öne çeker; AI’da %15 çünkü değişken token riski yüksektir.
- Enterprise ve özel geliştirme custom quote; düşük sabit fiyat tuzağı yok.
- Sahte “şu kadar tasarruf ettik” veya “sınırlı teklif” yok.

## Riskler ve doğrulanması gereken varsayımlar

1. Ticket-Go’nun çok kiracılı lisansı bugün self-servis satılmıyor; fiyat **teklif tabanı**. Onay: bu rakamlarla satışa çıkılsın mı?
2. 50 USD/saat yüklü maliyet gerçek bordro + ofis + araç ile doğrulanmalı.
3. 0,012 USD/AI işlem, Terra kısa bağlam varsayımıdır; uzun bağlam ve tool call maliyeti artırır.
4. Pipedrive resmî sayfası bu turda zaman aşımına uğradı; 14/39/59/79 rakamları 3 Ağustos 2026 ikincil doğrulamadır.
5. Make.com liste fiyatı kaynaklarda 9 vs 12 USD diye çelişiyor.
6. FareHarbor yüzde oranı resmî yayımlanmıyor.
7. Salesforce crm/pricing fetch’i zaman aşımı; 175 USD Enterprise small-business ve ikincil 5 Temmuz 2026 incelemesine dayanır.
8. KDV oranı ve döviz tahsilatı mali/legal onay ister.
9. 14 günlük yıllık cayma, tüketici hukuku / B2B sözleşme ile hukukçuya gösterilmeli.
10. SMS 0,08 USD ülke tarifesine göre yanlış olabilir.

## Gelecekte yapılabilecek A/B testleri

- Varsayılan fatura dönemi: yıllık vs aylık
- Growth rozeti kopyası: “En popüler” vs “Çoğu operasyon bu pakette”
- Ticket-Go’da yüzde GMV seçeneğini (yayımlanarak) vs sabit kota
- Discovery’yi 5.800 sabit vs 2.900 kredi (MVP’den düşülür)
- Ana sayfa teaser’da 3 kart vs tek “Tüm fiyatları görün”
- CTA: “Growth’u Seçin” vs “Teklif Alın” tıklama-form tamamlama oranı

Analytics altyapısı projede yok; olay enstrümantasyonu eklenmedi.

## Uygulanan dosyaların listesi

- `docs/pricing-analysis.md`
- `docs/pricing-catalog.json`
- `src/data/pricing-catalog.json` (uygulama kopyası; test iki dosyanın eşit olduğunu doğrular)
- `src/lib/money.ts`
- `src/lib/pricing.ts`
- `src/components/pricing/PricingView.tsx`
- `src/components/home/PricingTeaser.tsx`
- `src/app/pricing/page.tsx`
- `src/app/page.tsx`
- `src/app/sitemap.ts`
- `src/components/Navbar.tsx`
- `src/components/PublicFooter.tsx`
- `src/components/ContactForm.tsx`
- `public/sitemap.xml`
- `scripts/pricing.test.mjs`
- `package.json`
