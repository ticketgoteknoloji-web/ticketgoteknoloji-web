# n8n AI Workflow Builder — tek yapıştırma promptu

Aşağıdaki bloğu n8n AI workflow builder’a **olduğu gibi** yapıştır.

Kimlik doğrulama / document reader / Identity Verification workflow’larını değiştirme, silme veya bu akışlara bağlama. Bu tamamen ayrı bir Marketing Intelligence projesidir.

---

n8n’de üç ayrı workflow oluştur. İsimler birebir şöyle olsun:

1. TicketGo - Marketing Intelligence - Data Collector v1
2. TicketGo - Marketing Intelligence - Daily AI Report v1
3. TicketGo - Marketing Intelligence - Alert Engine v1

Hiçbir gerçek API key, access token, customer ID, account ID veya secret yazma. Tüm sırlar n8n Credentials ve environment variable placeholder olsun:

- `{{ $env.DATABASE_URL }}`
- `{{ $env.GOOGLE_ADS_CUSTOMER_ID }}`
- `{{ $env.GOOGLE_ADS_DEVELOPER_TOKEN }}`
- `{{ $env.META_AD_ACCOUNT_ID }}`
- `{{ $env.META_ACCESS_TOKEN }}`
- `{{ $env.GA4_PROPERTY_ID }}`
- `{{ $env.TICKETGO_API_BASE_URL }}`
- `{{ $env.TICKETGO_INTERNAL_API_KEY }}`
- `{{ $env.OPENAI_API_KEY }}`
- `{{ $env.AUTO_ACTION_ENABLED }}` varsayılan `false`
- `{{ $env.MARKETING_TIMEZONE }}` varsayılan `Europe/Istanbul`
- `{{ $env.MARKETING_SYNC_LOOKBACK_HOURS }}` varsayılan `26`
- `{{ $env.MARKETING_MAX_RETRIES }}` varsayılan `3`
- `{{ $env.MARKETING_RETRY_BASE_MS }}` varsayılan `30000`

Mock / fake / random satış veya reklam satırı üretme. Credential veya base URL yoksa o kaynak için kayıt basma; `NOT_CONFIGURED` durumunu `marketing_sync_runs` tablosuna yaz.

Retry: yalnızca HTTP 429, 5xx ve network timeout. En fazla 3 deneme. Exponential backoff: `MARKETING_RETRY_BASE_MS * 2^attempt`. Diğer 4xx retry yok. Infinite retry yok.

Log ve error mesajlarında yolcu adı, pasaport, TCKN, e-posta, telefon tutma.

Google Ads, Meta Ads, GA4 için n8n’in ilgili credential tiplerini kullan (OAuth / API). Credential bağlı değilse node hata fırlatmasın; `NOT_CONFIGURED` dalına gitsin.

PostgreSQL connection: n8n Postgres credential, connection string `{{ $env.DATABASE_URL }}`, schema `marketing`.

Upsert:

- `marketing_ads_daily` unique `(platform, date, account_id, campaign_id, ad_id)`
- `ticketgo_bookings` unique `booking_id`
- `marketing_attribution` unique `booking_id`
- `marketing_kpi_daily` unique `(date, grain, dimension_key)`
- `marketing_alerts` açık alert için fingerprint unique (is_resolved = false)

Kur çevirimi yapma. `currency` alanını olduğu gibi sakla.

AI reklam bütçesini, kampanya statusünü veya teklifi değiştirmesin. `AUTO_ACTION_ENABLED` false iken Google/Meta update node koyma.

---

## WORKFLOW 1 — TicketGo - Marketing Intelligence - Data Collector v1

Sticky notes ile grupla:

1. Tetikleyiciler
2. Kaynaklar
3. Normalizasyon ve kayıt
4. Attribution / KPI / Anomali
5. Hata yönetimi

### Node isimleri (birebir)

- Saatlik Tetikleyici
- Manuel Test
- Google Ads Verisini Al
- Meta Ads Verisini Al
- GA4 Verisini Al
- TicketGo Satışlarını Al
- Veriyi Normalize Et
- Attribution Hesapla
- KPI Hesapla
- PostgreSQL'e Kaydet
- Anomali Kontrolü
- AI Analizi
- Raporu Kaydet
- Hata Kaydı Oluştur

Bu workflow’da **AI Analizi** node’unu oluştur ama Disabled bırak. Analiz Daily Report workflow’unda çalışır. Collector’da boş geçiş veya no-op yeter.

### Tetikleyiciler

Saatlik Tetikleyici: Schedule Trigger, her saat, timezone Europe/Istanbul.

Manuel Test: Manual Trigger.

İkisini bir Merge (append) veya paralel bağla; aynı collector zincirine gitsin.

Lookback: şimdi eksi `MARKETING_SYNC_LOOKBACK_HOURS` saat. Google/Meta/GA4 date range ve TicketGo `from`/`to` bu aralık olsun.

Her kaynak çekimine başlamadan `marketing_sync_runs` insert: source, started_at=now, status=`running`.

### Google Ads Verisini Al

n8n Google Ads node veya HTTP + OAuth.

Customer: `{{ $env.GOOGLE_ADS_CUSTOMER_ID }}`.

Çekilecek alanlar:

date, accountId, campaignId, campaignName, adGroupId, adGroupName, adId, impressions, clicks, cost, conversions, conversionValue, currency

GAQL örneği (placeholder customer):

```
SELECT
  segments.date,
  customer.id,
  campaign.id,
  campaign.name,
  ad_group.id,
  ad_group.name,
  ad_group_ad.ad.id,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions,
  metrics.conversions_value
FROM ad_group_ad
WHERE segments.date DURING LAST_7_DAYS
```

`cost_micros / 1_000_000` → cost. Customer ID veya developer token yoksa bu node’u atla ve source=`google_ads`, status=`not_configured`, error_code=`GOOGLE_ADS_NOT_CONFIGURED`.

### Meta Ads Verisini Al

Graph API insights, account `act_{{ $env.META_AD_ACCOUNT_ID }}`.

level=ad, time_increment=1, fields:

campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name, impressions, clicks, spend, reach, actions, action_values

Map:

conversions ← action type purchase / omni_purchase (yoksa 0, uydurma)

purchaseValue ← action_values purchase (yoksa 0)

currency ← account currency

Token veya account yoksa `META_ADS_NOT_CONFIGURED`.

### GA4 Verisini Al

Property `{{ $env.GA4_PROPERTY_ID }}`.

dimensions: date, sessionSource, sessionMedium, sessionCampaignName, sessionCampaignId, landingPagePlusQueryString, deviceCategory, country

metrics: totalUsers, sessions, engagedSessions, keyEvents, purchaseRevenue (veya totalRevenue)

Property yoksa `GA4_NOT_CONFIGURED`.

### TicketGo Satışlarını Al

HTTP Request:

Method GET

URL: `{{ $env.TICKETGO_API_BASE_URL }}/internal/marketing/sales`

Query: from, to (ISO-8601)

Headers:

- X-API-Key: `{{ $env.TICKETGO_INTERNAL_API_KEY }}`
- Accept: application/json

Beklenen JSON: `{ "bookings": [ ... ] }`

Alanlar: bookingId, orderId, passengerId, createdAt, paidAt, travelDate, routeId, routeName, departurePort, arrivalPort, operatorId, operatorName, country, ticketType, adultCount, childCount, infantCount, currency, grossRevenue, discountAmount, refundAmount, netRevenue, supplierCost, commissionRevenue, paymentFee, bookingStatus, utmSource, utmMedium, utmCampaign, utmContent, utmTerm, gclid, gbraid, wbraid, fbclid, landingPage, device, sessionId

`TICKETGO_API_BASE_URL` veya `TICKETGO_INTERNAL_API_KEY` boşsa HTTP çağrısı yapma. Fake booking üretme. error_code=`TICKETGO_API_NOT_CONFIGURED`, status=`not_configured`.

HTTP 200 ve boş liste geçerlidir (gerçekten satış yok). Boş liste mock değildir.

### Veriyi Normalize Et (Code node)

Ortak model:

platform, date, accountId, campaignId, campaignName, adGroupId, adGroupName, adId, adName, impressions, clicks, spend, conversions, reportedRevenue, currency

Google: platform=`google_ads`, spend=cost, reportedRevenue=conversionValue, adName=null olabilir.

Meta: platform=`meta_ads`, adGroupId=adSetId, adGroupName=adSetName, spend=spend, reportedRevenue=purchaseValue.

GA4 satırlarını `analytics_daily` şemasına map et; ads_daily’ye karıştırma.

TicketGo satırlarını bookings şemasına map et. PII alanı ekleme.

### Attribution Hesapla (Code node)

Sıra:

1. gclid / gbraid / wbraid → google_ads, method GCLID/GBRAID/WBRAID
2. fbclid → meta_ads, FBCLID
3. utmCampaign AND utmSource → marketing_campaigns’te case-insensitive name veya id eşleşmesi. Yoksa UNKNOWN, kampanya uydurma.
4. sessionId için session kampanya lookup’u yoksa atla
5. organic / direct
6. UNKNOWN

campaign_id yalnızca gerçek eşleşmede dolu.

### KPI Hesapla (Code node)

Metrikler: Spend, Impressions, Clicks, CTR, CPC, CPM, Bookings, PaidBookings, TicketsSold, Passengers, GrossRevenue, NetRevenue, CommissionRevenue, RefundAmount, CPA, CAC, ROAS, NetROAS, MER, ConversionRate, RefundRate, CancellationRate, AverageOrderValue, RevenuePerBooking, CommissionPerBooking

Formüller:

- CTR = clicks/impressions
- CPC = spend/clicks
- CPM = spend/impressions*1000
- CPA = CAC = spend/paidBookings
- ROAS = grossRevenue/spend
- NetROAS = MER(overall) = netRevenue/spend
- ConversionRate = paidBookings/clicks
- RefundRate = refundedBookings/paidBookings
- CancellationRate = cancelledBookings/bookings
- AOV = grossRevenue/paidBookings

Payda 0 ise null.

Grain’ler: overall, platform, campaign, ad, date, route, departure_port, arrival_port, operator, country, device

TicketsSold/Passengers = paid kayıtlarda adultCount+childCount+infantCount

### PostgreSQL'e Kaydet

Sıra: accounts/campaigns upsert → ads_daily upsert → analytics_daily upsert → ticketgo_bookings upsert → attribution upsert → kpi_daily upsert.

ON CONFLICT DO UPDATE. Duplicate daily ad satırı oluşmasın.

### Anomali Kontrolü

Kurallar tablodan oku (`marketing_anomaly_rules`). Varsayılanlar:

- SPEND_SPIKE: spend 7g ortalamasının %50 üstü ve paid bookings artmamış
- ROAS_DROP: ROAS 7g ortalamaya göre %30 düşmüş
- NO_SALES_WITH_SPEND: spend > 0 ve 3 saattir paid booking yok
- REFUND_SPIKE: refund rate baseline’ın belirgin üstü
- DATA_SOURCE_FAILURE: TicketGo NOT_CONFIGURED veya hata
- AD_PLATFORM_SYNC_FAILURE: Google/Meta/GA4 hata (NOT_CONFIGURED bilgi; gerçek 5xx CRITICAL)

Alert alanları: severity (INFO|WARNING|CRITICAL), category, platform, campaignId, routeId, message, metric, currentValue, baselineValue, detectedAt

### Raporu Kaydet

İlgili sync_run satırını güncelle: finished_at, status (success|partial|failed|not_configured), records_fetched, records_inserted, records_updated, error_code, error_message, retry_count.

Kısmi başarı (ör. Google OK, TicketGo NOT_CONFIGURED) status=`partial`.

### Hata Kaydı Oluştur

Tüm collector ve HTTP node error output buraya. PII yok. retry_count artır, max 3.

---

## WORKFLOW 2 — TicketGo - Marketing Intelligence - Daily AI Report v1

Sticky notes: Tetikleyici, Veri, AI, Kayıt.

Node isimleri:

- Sabah Tetikleyici
- Manuel Test
- KPI Hesapla
- Anomali Kontrolü
- AI Analizi
- Raporu Kaydet
- Hata Kaydı Oluştur
- PostgreSQL'e Kaydet

Sabah Tetikleyici: her gün 07:00 Europe/Istanbul.

PostgreSQL’den son 24 saat KPI ve önceki 7 gün ortalamasını çek. Ayrıca en iyi/kötü kampanya (ROAS, spend>0), en iyi/kötü rota (net_revenue), açık anomaliler.

Özet üret (Code veya SQL):

- Toplam reklam harcaması
- Toplam booking
- Toplam ticket
- Net gelir
- Komisyon geliri
- ROAS
- CPA
- En iyi kampanya
- En kötü kampanya (yüksek spend, düşük/boş satış)
- En iyi rota
- En kötü rota
- Anomaliler
- AI önerileri

AI Analizi: OpenAI / n8n AI node, model `{{ $env.OPENAI_MODEL }}` veya gpt-4o-mini. API key yoksa `OPENAI_NOT_CONFIGURED`, uydurma insight yok.

Sistem promptu:

Sen TicketGo Marketing Intelligence analistisin. TicketGo feribot/seyahat bileti satar. Ham tablo tekrarlama. Aksiyon üret. Reklam bütçesini otomatik değiştirme. AUTO_ACTION_ENABLED yalnızca echo. JSON dışında bir şey yazma.

JSON şema:

{
  "executiveSummary": "",
  "topWinners": [],
  "topProblems": [],
  "budgetSuggestions": [],
  "routeInsights": [],
  "anomalies": [],
  "actionsToday": [],
  "risks": []
}

Örnek dil (üretilecek, hard-code örnek veri değil): “Google Ads / Bodrum-Kos kampanyasının bütçesini artırmayı değerlendir.” “Meta kampanyası yüksek harcama fakat düşük booking üretiyor.” “Bu kampanyayı durdur.”

Raporu Kaydet + PostgreSQL'e Kaydet: `marketing_ai_reports` upsert `(report_date, window_hours)`, auto_action_enabled=false, report_json=AI çıktısı.

---

## WORKFLOW 3 — TicketGo - Marketing Intelligence - Alert Engine v1

Node isimleri:

- Saatlik Tetikleyici  → bu workflow’da Schedule her 15 dakika olsun; görünen ad yine **Saatlik Tetikleyici** değilse **Alert Tetikleyici** kullan ve sticky note’ta belirt.
- Manuel Test
- Anomali Kontrolü
- PostgreSQL'e Kaydet
- Hata Kaydı Oluştur

Alert Tetikleyici: her 15 dakika, Europe/Istanbul.

KPI + son paid booking zamanı + son sync_runs oku. Data Collector ile aynı anomali kuralları.

PostgreSQL'e Kaydet: `marketing_alerts` insert. Aynı açık fingerprint varsa duplicate açma.

Kanal node’ları ekle ama **Disabled**:

- Slack
- Telegram
- WhatsApp
- Email

URL/token env boşsa skip. v1 gerçek mesaj göndermek zorunda değil.

---

## Bitirme kontrol listesi

- Üç workflow ayrı
- Türkçe node adları yukarıdaki gibi
- Credential hard-code yok
- Mock satış/reklam yok
- TicketGo API yoksa TICKETGO_API_NOT_CONFIGURED
- AI bütçe update yok
- Identity Verification’a dokunulmadı
- Retry tavanı 3
- PII log yok
