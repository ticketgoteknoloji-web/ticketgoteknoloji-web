# TicketGo Accounting n8n workflows

Sözleşme: `docs/N8N-HANDOFF.md`. Bu dosyada olmayan TicketGo path, Luca URL, event veya credential **yok**.

Import: `n8n/workflows/accounting/*.json` — hepsi `active: false`.
Üretim: `node n8n/build-accounting-workflows.mjs`

n8n credential adı (handoff): `ticketgoAccountingApi.token`  
App base: env `TICKETGO_ACCOUNTING_BASE_URL` (trailing slash yok)  
POST: header `Idempotency-Key`  
Error workflow (import sonrası bağla): **TG-ACC-99**

## 1. Mimari

n8n veri kaynağı değildir. PostgreSQL + TicketGo `/api/n8n/*` asıl kaynaktır.

n8n: cron, HTTP, retry (429 backoff; 5xx retry; 400 yok; 401/403 alert), idempotency header, status IF/Switch, audit `POST /api/n8n/webhook` (yalnız handoff vocabulary).

KDV, cari, fatura tutarı, supplier borcu, `invoiceTargetDate` n8n’de hesaplanmaz. Core `invoiceTargetDate` / `legalDeadline` / `amountMinor` kullanılır.

## 2. Bağlantı haritası

```
Reservations (Core)
  → TG-ACC-01 GET /reservations/completed → POST /webhook SERVICE_COMPLETED
  → TG-ACC-02 GET /invoices/due (Core scheduler + invoiceTargetDate)
  → TG-ACC-03 Switch invoice.status (SCHEDULED | ACCOUNTING_REVIEW)
  → TG-ACC-16 legalDeadline <= asOf (alan karşılaştırması, +2 yok)
  → TG-ACC-04 POST /invoices/result  [GIB/e-Fatura HANDOFF: Not implemented — issued:true yazılmaz]

  → TG-ACC-13 GET /accounting/pending → POST /accounting/export
       → Luca HTTP (credential yoksa claim yok; URL uydurulmaz)
       → TG-ACC-14 POST /accounting/result SUCCESS
       → TG-ACC-15 GET pending RETRY; FAILED ancak gerçek Luca hata sonrası

Documents
  → TG-ACC-05 POST /documents → POST /ocr-result (OCR alanları item’da yoksa durur)
  → TG-ACC-06 aynı POST; 409 DUPLICATE_DOCUMENT = Core

Supplier
  → TG-ACC-07 GET /supplier-payments/due
  → TG-ACC-08 aynı GET (early-booking path HANDOFF’ta yok; taksit Core’da)
  → TG-ACC-17 Wait (onay API yok) → TG-ACC-09 POST /supplier-payments/result

Bank / POS
  → TG-ACC-10 POST /bank-transactions  (pullFromBank yasak)
  → TG-ACC-11 ingest `duplicate` (match API yok) → webhook CUSTOMER_PAYMENT_RECEIVED
  → TG-ACC-12 POST /pos-transactions (pullFromProvider yasak)

TG-ACC-18  GET invoices/due + accounting/pending + supplier-payments/due  (summary path/event yok)
       ↓
TG-ACC-99  Error Trigger  (Slack/email URL yok)
```

## 3. Eksik credential’lar (uydurulmadı)

| Secret | Handoff | Workflow davranışı |
| --- | --- | --- |
| `N8N_ACCOUNTING_API_TOKEN` / `ticketgoAccountingApi.token` | Gerekli | Yoksa 503 `N8N_TOKEN_NOT_CONFIGURED` / 401 |
| `TICKETGO_ACCOUNTING_BASE_URL` | Gerekli | HTTP URL |
| `DATABASE_URL` (app) | Gerekli | API 503 `DATABASE_NOT_CONFIGURED` |
| Luca API base/key/company | Yalnız n8n; URL verilmedi | TG-ACC-13 claim etmez; Luca HTTP node disabled |
| `LUCA_API_*` app env | Placeholder, boş | App Luca HTTP atmaz |
| Bank provider key/URL | Yok | `pullFromBank: true` yasak; ingest çalışır |
| POS provider key/URL | Yok | `pullFromProvider: true` yasak; ingest çalışır |
| e-Fatura / GIB | Not implemented | TG-ACC-04 `issued:true` göndermez |
| OCR vendor URL | Yok; n8n OCR sonucu POST eder | Vendor URL yok; `ocr.*` alanları item’da olmalı |
| Slack / e-posta notifier | Handoff’ta yok | TG-ACC-99 NoOp; sonradan bağlanır |

## HTTP kuralları (tüm workflow)

- 409 `IDEMPOTENCY_CONFLICT` / `DUPLICATE_DOCUMENT` → duplicate, retry yok
- 400 validation → retry yok
- 401/403 → SECURITY_CREDENTIAL_ALERT
- 429 → Wait backoff + Retry HTTP node
- 500/502/503/504 → retry
- Idempotency-Key retry’de **değiştirilmez**
