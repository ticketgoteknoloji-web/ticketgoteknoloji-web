# TicketGo Accounting — n8n import

Sözleşme: `docs/N8N-HANDOFF.md`. Bu klasördeki JSON’lar **Import from File** ile içe aktarılır. Hepsi `active: false`.

Üretim: `node n8n/build-accounting-workflows.mjs`

## Import sırası

1. **TG-ACC-99.json** (Error Trigger). Import sonrası n8n’in verdiği workflow **ID**’yi kopyala.
2. Kalan dosyalar (01 → 18). Sıra serbest; 99’dan sonra olması yeterli.
3. Her 01–18 workflow’da **Settings → Error workflow** = TG-ACC-99’un ID’si.  
   JSON içinde `settings.errorWorkflow` kasten boş: n8n ID’yi import’tan önce bilemez. `meta.preparedErrorWorkflow` = `TG-ACC-99`.
4. Credential ve env’i doldurmadan **Activate** etme.

## Gerekli credentials (n8n)

| Credential | Kullanım | Durum |
| --- | --- | --- |
| `ticketgoAccountingApi.token` | `Authorization: Bearer {{$credentials.ticketgoAccountingApi.token}}` (HANDOFF) | **Zorunlu.** Değeri app env `N8N_ACCOUNTING_API_TOKEN` ile aynı olmalı. Sahte token üretme. |
| Luca API | TG-ACC-13 HTTP Luca node | **Yok.** Node `disabled`. URL/key uydurma. |
| Banka / POS / OCR vendor / e-Fatura / GIB | — | HANDOFF: yok veya Not implemented. |

Header Auth örneği: Name `Authorization`, Value `Bearer <gerçek token>` — ya da HANDOFF’taki `ticketgoAccountingApi.token` alanı.

## Gerekli environment variables

| Değişken | Nerede | Zorunlu |
| --- | --- | --- |
| `TICKETGO_ACCOUNTING_BASE_URL` | n8n env (Next.js origin, trailing slash yok) | Evet |
| `N8N_ACCOUNTING_API_TOKEN` | **App** `.env` (API tarafı) | Evet; boşsa 503 `N8N_TOKEN_NOT_CONFIGURED` |
| `DATABASE_URL` | App | Evet; yoksa 503 `DATABASE_NOT_CONFIGURED` |
| `LUCA_API_BASE_URL` / `LUCA_API_KEY` | n8n env, HANDOFF placeholder | Hayır; boşken Luca çağrısı ve export claim yok |
| Bank / POS provider URL-key | — | Hayır. `pullFromBank` / `pullFromProvider` gönderme |

## Hangileri disabled / aktif edilmemeli

Tüm JSON `active: false`. Credential gelene kadar böyle kalsın.

| Workflow | Neden şimdilik kapalı |
| --- | --- |
| TG-ACC-04 | e-Fatura/GIB Not implemented — `issued: true` yazılmaz |
| TG-ACC-05 Luca/OCR vendor | OCR URL yok; `ocr.*` alanları item’da yoksa durur |
| TG-ACC-10 / 11 / 12 | Banka/POS **pull** yasak; yalnız ingest. Provider URL yok |
| TG-ACC-13 | Luca HTTP **disabled**; credential yoksa pending claim yok |
| TG-ACC-14 / 15 | Luca gerçekten SUCCESS/FAILED olmadan result basma |
| TG-ACC-08 | Early-booking path yok; aynı due GET, taksit Core’da |
| TG-ACC-17 | Onay API yok; Wait manuel |
| TG-ACC-18 | Summary path/event yok; yalnız üç GET sayımı |
| TG-ACC-99 | Bildirim kanalı (Slack/mail) HANDOFF’ta yok |

Eksik credential ile çalıştırılan akış **başarılı sayılmaz** (`NOT_CONFIGURED` / skip / disabled node).

## TG-ACC-99 bağlantısı

1. 99’u import et.  
2. 01–18 → Settings → Error workflow → TG-ACC-99.  
3. 401/403 → SECURITY alert NoOp (kanalı sonra bağla). 400 retry yok. 429/5xx exhausted ayrı dal.

## HTTP kuralları

- POST: `Idempotency-Key` (retry’de değiştirme)
- 409 = duplicate/idempotent
- 400 = retry yok
- 401/403 = credential alert
- 429 backoff; 500/502/503/504 retry
- KDV, tutar, `invoiceTargetDate` n8n’de hesaplanmaz
