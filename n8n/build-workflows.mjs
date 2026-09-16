import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), 'workflows');
mkdirSync(outDir, { recursive: true });

const RETRY = `async function requestWithRetry(helpers, options, maxRetries, baseMs) {
  let attempt = 0;
  while (true) {
    try {
      const data = await helpers.httpRequest(options);
      return data;
    } catch (error) {
      const status = error.statusCode || error.httpCode || error.status || error.response?.status;
      const timeout = /timeout|ETIMEOUT|ETIMEDOUT/i.test(String(error.message || error.code || ''));
      const retryable = timeout || status === 429 || (Number(status) >= 500 && Number(status) <= 599);
      if (!retryable || attempt >= maxRetries) {
        const err = new Error(error.message || 'HTTP request failed');
        err.code = retryable ? 'AD_PLATFORM_SYNC_FAILURE' : String(status || 'HTTP_ERROR');
        err.retryable = Boolean(retryable);
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, baseMs * Math.pow(2, attempt)));
      attempt += 1;
    }
  }
}
`;

function codeNode(id, name, jsCode, position, extra = {}) {
  return {
    parameters: { jsCode },
    id,
    name,
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position,
    onError: extra.onError || 'stopWorkflow',
    retryOnFail: false,
    ...extra,
  };
}

function sticky(id, name, content, position, width, height, color) {
  return {
    parameters: { content, width, height, color },
    id,
    name,
    type: 'n8n-nodes-base.stickyNote',
    typeVersion: 1,
    position,
  };
}

function link(target, index = 0) {
  return { node: target, type: 'main', index };
}

const collector = {
  name: 'TicketGo - Marketing Intelligence - Data Collector v1',
  active: false,
  settings: { executionOrder: 'v1', timezone: 'Europe/Istanbul' },
  meta: { templateCredsSetupCompleted: false },
  pinData: {},
  nodes: [
    sticky('dc-s1', 'Grup Tetikleyiciler', '## Tetikleyiciler\\nSaatlik + manuel. Identity Verification akışına bağlama.', [-640, -200], 420, 360, 5),
    sticky('dc-s2', 'Grup Kaynaklar', '## Kaynaklar\\nCredential yoksa NOT_CONFIGURED. Mock satış/reklam yok.', [220, -280], 980, 720, 6),
    sticky('dc-s3', 'Grup Normalize', '## Normalizasyon ve kayıt\\nKaynak currency korunur. FX yok.', [1320, -80], 520, 360, 4),
    sticky('dc-s4', 'Grup KPI', '## Attribution / KPI / Anomali\\nEşleşme yoksa UNKNOWN.', [1880, -80], 700, 360, 3),
    sticky('dc-s5', 'Grup Hata', '## Hata yönetimi\\nPII loglama. Retry tavanı 3.', [2680, 420], 420, 280, 2),
    {
      parameters: {
        rule: { interval: [{ field: 'hours', hoursInterval: 1 }] },
      },
      id: 'dc-schedule',
      name: 'Saatlik Tetikleyici',
      type: 'n8n-nodes-base.scheduleTrigger',
      typeVersion: 1.2,
      position: [-520, -40],
    },
    {
      parameters: {},
      id: 'dc-manual',
      name: 'Manuel Test',
      type: 'n8n-nodes-base.manualTrigger',
      typeVersion: 1,
      position: [-520, 160],
    },
    codeNode('dc-window', 'Pencere Hazırla', `const hours = Number($env.MARKETING_SYNC_LOOKBACK_HOURS || 26);
const to = new Date();
const from = new Date(to.getTime() - hours * 3600 * 1000);
return [{ json: {
  from: from.toISOString(),
  to: to.toISOString(),
  fromDate: from.toISOString().slice(0, 10),
  toDate: to.toISOString().slice(0, 10),
  timezone: $env.MARKETING_TIMEZONE || 'Europe/Istanbul',
  maxRetries: Number($env.MARKETING_MAX_RETRIES || 3),
  retryBaseMs: Number($env.MARKETING_RETRY_BASE_MS || 30000),
} }];`, [-160, 40]),
    codeNode('dc-google', 'Google Ads Verisini Al', `${RETRY}
const customerId = String($env.GOOGLE_ADS_CUSTOMER_ID || '').trim();
const devToken = String($env.GOOGLE_ADS_DEVELOPER_TOKEN || '').trim();
if (!customerId || !devToken) {
  return [{ json: { source: 'google_ads', status: 'NOT_CONFIGURED', code: 'GOOGLE_ADS_NOT_CONFIGURED', records: [], recordsFetched: 0 } }];
}
const window = $('Pencere Hazırla').first().json;
const query = "SELECT segments.date, customer.id, campaign.id, campaign.name, ad_group.id, ad_group.name, ad_group_ad.ad.id, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM ad_group_ad WHERE segments.date BETWEEN '" + window.fromDate + "' AND '" + window.toDate + "'";
const data = await requestWithRetry(this.helpers, {
  method: 'POST',
  url: 'https://googleads.googleapis.com/v18/customers/' + customerId + '/googleAds:search',
  headers: { 'developer-token': devToken, 'Content-Type': 'application/json' },
  body: { query },
  json: true,
}, window.maxRetries, window.retryBaseMs);
const records = (data.results || []).map((row) => ({
  date: row.segments && row.segments.date,
  accountId: String((row.customer && row.customer.id) || customerId),
  campaignId: String((row.campaign && row.campaign.id) || ''),
  campaignName: (row.campaign && row.campaign.name) || '',
  adGroupId: String((row.adGroup && row.adGroup.id) || ''),
  adGroupName: (row.adGroup && row.adGroup.name) || '',
  adId: String((row.adGroupAd && row.adGroupAd.ad && row.adGroupAd.ad.id) || ''),
  impressions: Number((row.metrics && row.metrics.impressions) || 0),
  clicks: Number((row.metrics && row.metrics.clicks) || 0),
  cost: Number((row.metrics && row.metrics.costMicros) || 0) / 1000000,
  conversions: Number((row.metrics && row.metrics.conversions) || 0),
  conversionValue: Number((row.metrics && row.metrics.conversionsValue) || 0),
  currency: (row.customer && row.customer.currencyCode) || '',
})).filter((row) => row.date && row.campaignId && row.adId);
return [{ json: { source: 'google_ads', status: 'OK', records, recordsFetched: records.length } }];`, [280, -160], { onError: 'continueErrorOutput' }),
    codeNode('dc-meta', 'Meta Ads Verisini Al', `${RETRY}
const accountId = String($env.META_AD_ACCOUNT_ID || '').trim();
const token = String($env.META_ACCESS_TOKEN || '').trim();
const version = String($env.META_API_VERSION || 'v21.0').trim();
if (!accountId || !token) {
  return [{ json: { source: 'meta_ads', status: 'NOT_CONFIGURED', code: 'META_ADS_NOT_CONFIGURED', records: [], recordsFetched: 0 } }];
}
const window = $('Pencere Hazırla').first().json;
const data = await requestWithRetry(this.helpers, {
  method: 'GET',
  url: 'https://graph.facebook.com/' + version + '/act_' + accountId + '/insights',
  qs: {
    access_token: token,
    level: 'ad',
    time_increment: 1,
    time_range: JSON.stringify({ since: window.fromDate, until: window.toDate }),
    fields: 'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,impressions,clicks,spend,reach,actions,action_values,account_currency',
  },
  json: true,
}, window.maxRetries, window.retryBaseMs);
function actionVal(row, key) {
  const list = row[key] || [];
  const found = list.find((item) => item.action_type === 'purchase' || item.action_type === 'omni_purchase');
  return found ? Number(found.value || 0) : 0;
}
const records = (data.data || []).map((row) => ({
  date: row.date_start,
  accountId,
  campaignId: String(row.campaign_id || ''),
  campaignName: row.campaign_name || '',
  adSetId: String(row.adset_id || ''),
  adSetName: row.adset_name || '',
  adId: String(row.ad_id || ''),
  adName: row.ad_name || '',
  impressions: Number(row.impressions || 0),
  clicks: Number(row.clicks || 0),
  spend: Number(row.spend || 0),
  reach: Number(row.reach || 0),
  conversions: actionVal(row, 'actions'),
  purchaseValue: actionVal(row, 'action_values'),
  currency: row.account_currency || '',
})).filter((row) => row.date && row.campaignId && row.adId);
return [{ json: { source: 'meta_ads', status: 'OK', records, recordsFetched: records.length } }];`, [280, 40], { onError: 'continueErrorOutput' }),
    codeNode('dc-ga4', 'GA4 Verisini Al', `${RETRY}
const propertyId = String($env.GA4_PROPERTY_ID || '').trim();
if (!propertyId) {
  return [{ json: { source: 'ga4', status: 'NOT_CONFIGURED', code: 'GA4_NOT_CONFIGURED', records: [], recordsFetched: 0 } }];
}
const window = $('Pencere Hazırla').first().json;
const data = await requestWithRetry(this.helpers, {
  method: 'POST',
  url: 'https://analyticsdata.googleapis.com/v1beta/properties/' + propertyId + ':runReport',
  headers: { 'Content-Type': 'application/json' },
  body: {
    dateRanges: [{ startDate: window.fromDate, endDate: window.toDate }],
    dimensions: [{ name: 'date' }, { name: 'sessionSource' }, { name: 'sessionMedium' }, { name: 'sessionCampaignName' }, { name: 'sessionCampaignId' }, { name: 'landingPagePlusQueryString' }, { name: 'deviceCategory' }, { name: 'country' }],
    metrics: [{ name: 'totalUsers' }, { name: 'sessions' }, { name: 'engagedSessions' }, { name: 'keyEvents' }, { name: 'purchaseRevenue' }],
  },
  json: true,
}, window.maxRetries, window.retryBaseMs);
const records = (data.rows || []).map((row) => {
  const d = (row.dimensionValues || []).map((x) => x.value);
  const m = (row.metricValues || []).map((x) => Number(x.value || 0));
  const rawDate = d[0] || '';
  const date = rawDate.length === 8 ? rawDate.slice(0, 4) + '-' + rawDate.slice(4, 6) + '-' + rawDate.slice(6, 8) : window.fromDate;
  return { date, sessionSource: d[1], sessionMedium: d[2], campaignName: d[3], campaignId: d[4], users: m[0], sessions: m[1], engagedSessions: m[2], keyEvents: m[3], revenue: m[4], landingPage: d[5], deviceCategory: d[6], country: d[7] };
});
return [{ json: { source: 'ga4', status: 'OK', records, recordsFetched: records.length } }];`, [280, 240], { onError: 'continueErrorOutput' }),
    codeNode('dc-tg', 'TicketGo Satışlarını Al', `${RETRY}
const base = String($env.TICKETGO_API_BASE_URL || '').replace(/\\/+$/, '');
const apiKey = String($env.TICKETGO_INTERNAL_API_KEY || '').trim();
if (!base || !apiKey) {
  return [{ json: { source: 'ticketgo', status: 'NOT_CONFIGURED', code: 'TICKETGO_API_NOT_CONFIGURED', records: [], recordsFetched: 0 } }];
}
const window = $('Pencere Hazırla').first().json;
const data = await requestWithRetry(this.helpers, {
  method: 'GET',
  url: base + '/internal/marketing/sales',
  qs: { from: window.from, to: window.to },
  headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
  json: true,
}, window.maxRetries, window.retryBaseMs);
const records = Array.isArray(data && data.bookings) ? data.bookings : [];
return [{ json: { source: 'ticketgo', status: 'OK', records, recordsFetched: records.length } }];`, [280, 440], { onError: 'continueErrorOutput' }),
    {
      parameters: { mode: 'combine', combineBy: 'combineAll', numberInputs: 4, options: {} },
      id: 'dc-merge',
      name: 'Kaynakları Birleştir',
      type: 'n8n-nodes-base.merge',
      typeVersion: 3.1,
      position: [780, 120],
    },
    codeNode('dc-norm', 'Veriyi Normalize Et', `function isoDate(value) {
  if (!value) return null;
  const text = String(value);
  if (/^\\d{4}-\\d{2}-\\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}
function num(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
const inputs = $input.all().map((item) => item.json);
const google = inputs.find((row) => row.source === 'google_ads') || { status: 'NOT_CONFIGURED', records: [] };
const meta = inputs.find((row) => row.source === 'meta_ads') || { status: 'NOT_CONFIGURED', records: [] };
const ga4 = inputs.find((row) => row.source === 'ga4') || { status: 'NOT_CONFIGURED', records: [] };
const sales = inputs.find((row) => row.source === 'ticketgo') || { status: 'NOT_CONFIGURED', records: [] };
const ads = [];
for (const row of google.records || []) {
  ads.push({ platform: 'google_ads', date: isoDate(row.date), accountId: String(row.accountId), campaignId: String(row.campaignId), campaignName: row.campaignName || null, adGroupId: row.adGroupId || null, adGroupName: row.adGroupName || null, adId: String(row.adId), adName: null, impressions: num(row.impressions), clicks: num(row.clicks), spend: num(row.cost), conversions: num(row.conversions), reportedRevenue: num(row.conversionValue), currency: String(row.currency || '').toUpperCase() });
}
for (const row of meta.records || []) {
  ads.push({ platform: 'meta_ads', date: isoDate(row.date), accountId: String(row.accountId), campaignId: String(row.campaignId), campaignName: row.campaignName || null, adGroupId: row.adSetId || null, adGroupName: row.adSetName || null, adId: String(row.adId), adName: row.adName || null, impressions: num(row.impressions), clicks: num(row.clicks), spend: num(row.spend), conversions: num(row.conversions), reportedRevenue: num(row.purchaseValue), currency: String(row.currency || '').toUpperCase(), reach: num(row.reach) });
}
return [{ json: { sources: { google_ads: google, meta_ads: meta, ga4: ga4, ticketgo: sales }, ads, analytics: ga4.records || [], bookings: sales.records || [] } }];`, [1100, 120]),
    codeNode('dc-attr', 'Attribution Hesapla', `function present(value) { return Boolean(value && String(value).trim()); }
function attribute(booking, campaigns) {
  if (present(booking.gclid)) return { attributionPlatform: 'google_ads', attributionCampaignId: null, attributionCampaignName: null, attributionMethod: 'GCLID', attributionConfidence: 0.7 };
  if (present(booking.gbraid)) return { attributionPlatform: 'google_ads', attributionCampaignId: null, attributionCampaignName: null, attributionMethod: 'GBRAID', attributionConfidence: 0.65 };
  if (present(booking.wbraid)) return { attributionPlatform: 'google_ads', attributionCampaignId: null, attributionCampaignName: null, attributionMethod: 'WBRAID', attributionConfidence: 0.65 };
  if (present(booking.fbclid)) return { attributionPlatform: 'meta_ads', attributionCampaignId: null, attributionCampaignName: null, attributionMethod: 'FBCLID', attributionConfidence: 0.7 };
  if (present(booking.utmCampaign) && present(booking.utmSource)) {
    const campaignNorm = String(booking.utmCampaign).trim().toLowerCase();
    const mapped = (campaigns || []).find((row) => String(row.campaignName || '').trim().toLowerCase() === campaignNorm || String(row.campaignId || '').trim().toLowerCase() === campaignNorm);
    if (!mapped) return { attributionPlatform: 'unknown', attributionCampaignId: null, attributionCampaignName: null, attributionMethod: 'UNKNOWN', attributionConfidence: 0 };
    return { attributionPlatform: mapped.platform, attributionCampaignId: mapped.campaignId, attributionCampaignName: mapped.campaignName, attributionMethod: 'UTM', attributionConfidence: 0.8 };
  }
  const source = String(booking.utmSource || '').trim().toLowerCase();
  const medium = String(booking.utmMedium || '').trim().toLowerCase();
  if (source === 'organic' || medium === 'organic') return { attributionPlatform: 'organic', attributionCampaignId: null, attributionCampaignName: null, attributionMethod: 'ORGANIC', attributionConfidence: 0.6 };
  if (source === 'direct' || source === '(direct)' || medium === '(none)' || medium === 'none') return { attributionPlatform: 'direct', attributionCampaignId: null, attributionCampaignName: null, attributionMethod: 'DIRECT', attributionConfidence: 0.5 };
  return { attributionPlatform: 'unknown', attributionCampaignId: null, attributionCampaignName: null, attributionMethod: 'UNKNOWN', attributionConfidence: 0 };
}
const payload = $input.first().json;
const campaigns = (payload.ads || []).map((row) => ({ platform: row.platform, campaignId: row.campaignId, campaignName: row.campaignName }));
const bookings = (payload.bookings || []).map((booking) => ({ ...booking, attribution: attribute(booking, campaigns) }));
return [{ json: { ...payload, bookings } }];`, [1420, 120]),
    codeNode('dc-kpi', 'KPI Hesapla', `function safeRatio(n, d) { if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null; return n / d; }
function compute(input) {
  const paid = input.paidBookings;
  return Object.assign({}, input, {
    ctr: safeRatio(input.clicks, input.impressions), cpc: safeRatio(input.spend, input.clicks), cpm: safeRatio(input.spend * 1000, input.impressions),
    cpa: safeRatio(input.spend, paid), cac: safeRatio(input.spend, paid), roas: safeRatio(input.grossRevenue, input.spend), netRoas: safeRatio(input.netRevenue, input.spend), mer: safeRatio(input.netRevenue, input.spend),
    conversionRate: safeRatio(paid, input.clicks), refundRate: safeRatio(input.refundedBookings, paid), cancellationRate: safeRatio(input.cancelledBookings, input.bookings),
    averageOrderValue: safeRatio(input.grossRevenue, paid), revenuePerBooking: safeRatio(input.netRevenue, paid), commissionPerBooking: safeRatio(input.commissionRevenue, paid),
  });
}
function empty() { return { spend: 0, impressions: 0, clicks: 0, bookings: 0, paidBookings: 0, cancelledBookings: 0, refundedBookings: 0, ticketsSold: 0, passengers: 0, grossRevenue: 0, netRevenue: 0, commissionRevenue: 0, refundAmount: 0, currency: null }; }
function add(a, b) { return { spend: a.spend + b.spend, impressions: a.impressions + b.impressions, clicks: a.clicks + b.clicks, bookings: a.bookings + b.bookings, paidBookings: a.paidBookings + b.paidBookings, cancelledBookings: a.cancelledBookings + b.cancelledBookings, refundedBookings: a.refundedBookings + b.refundedBookings, ticketsSold: a.ticketsSold + b.ticketsSold, passengers: a.passengers + b.passengers, grossRevenue: a.grossRevenue + b.grossRevenue, netRevenue: a.netRevenue + b.netRevenue, commissionRevenue: a.commissionRevenue + b.commissionRevenue, refundAmount: a.refundAmount + b.refundAmount, currency: a.currency || b.currency }; }
const payload = $input.first().json;
const byKey = new Map();
function bump(grain, dimensionKey, extra, delta) {
  const key = grain + '::' + dimensionKey;
  const current = byKey.get(key) || Object.assign({ grain: grain, dimensionKey: dimensionKey }, extra, empty());
  byKey.set(key, Object.assign({}, current, extra, add(current, delta)));
}
for (const ad of payload.ads || []) {
  const delta = Object.assign(empty(), { spend: Number(ad.spend || 0), impressions: Number(ad.impressions || 0), clicks: Number(ad.clicks || 0), currency: ad.currency });
  bump('overall', 'overall', { date: ad.date }, delta);
  bump('platform', ad.platform, { date: ad.date, platform: ad.platform }, delta);
  bump('campaign', ad.platform + '::' + ad.campaignId, { date: ad.date, platform: ad.platform, campaignId: ad.campaignId, campaignName: ad.campaignName }, delta);
  bump('ad', ad.platform + '::' + ad.campaignId + '::' + ad.adId, { date: ad.date, platform: ad.platform, campaignId: ad.campaignId, adId: ad.adId }, delta);
  bump('date', ad.date, { date: ad.date }, delta);
}
for (const booking of payload.bookings || []) {
  const status = String(booking.bookingStatus || '').toLowerCase();
  const paid = status === 'paid';
  const tickets = paid ? Number(booking.adultCount || 0) + Number(booking.childCount || 0) + Number(booking.infantCount || 0) : 0;
  const delta = Object.assign(empty(), { bookings: 1, paidBookings: paid ? 1 : 0, cancelledBookings: status === 'cancelled' ? 1 : 0, refundedBookings: status === 'refunded' ? 1 : 0, ticketsSold: tickets, passengers: tickets, grossRevenue: paid ? Number(booking.grossRevenue || 0) : 0, netRevenue: paid ? Number(booking.netRevenue || 0) : 0, commissionRevenue: paid ? Number(booking.commissionRevenue || 0) : 0, refundAmount: Number(booking.refundAmount || 0), currency: booking.currency });
  const date = String(booking.paidAt || booking.createdAt || '').slice(0, 10);
  const attr = booking.attribution || {};
  bump('overall', 'overall', { date: date }, delta);
  bump('route', booking.routeId || '_', { date: date, routeId: booking.routeId, routeName: booking.routeName }, delta);
  bump('departure_port', booking.departurePort || '_', { date: date, departurePort: booking.departurePort }, delta);
  bump('arrival_port', booking.arrivalPort || '_', { date: date, arrivalPort: booking.arrivalPort }, delta);
  bump('operator', booking.operatorId || '_', { date: date, operatorId: booking.operatorId }, delta);
  bump('country', booking.country || '_', { date: date, country: booking.country }, delta);
  bump('device', booking.device || '_', { date: date, device: booking.device }, delta);
  if (attr.attributionPlatform) bump('platform', attr.attributionPlatform, { date: date, platform: attr.attributionPlatform }, delta);
  if (attr.attributionCampaignId) bump('campaign', (attr.attributionPlatform || 'unknown') + '::' + attr.attributionCampaignId, { date: date, platform: attr.attributionPlatform, campaignId: attr.attributionCampaignId, campaignName: attr.attributionCampaignName }, delta);
}
return [{ json: Object.assign({}, payload, { kpis: Array.from(byKey.values()).map(compute) }) }];`, [1740, 120]),
    codeNode('dc-anom', 'Anomali Kontrolü', `const payload = $input.first().json;
const now = new Date().toISOString();
const overall = (payload.kpis || []).find((row) => row.grain === 'overall') || { spend: 0 };
const alerts = [];
const sources = payload.sources || {};
if (sources.ticketgo && sources.ticketgo.status !== 'OK') {
  alerts.push({ severity: 'CRITICAL', category: 'DATA_SOURCE_FAILURE', platform: 'ticketgo', campaignId: null, routeId: null, message: 'TicketGo sales API did not return data (NOT_CONFIGURED or sync failure).', metric: null, currentValue: null, baselineValue: null, detectedAt: now, fingerprint: 'DATA_SOURCE_FAILURE|ticketgo' });
}
for (const key of ['google_ads', 'meta_ads', 'ga4']) {
  if (sources[key] && sources[key].status === 'ERROR') {
    alerts.push({ severity: 'CRITICAL', category: 'AD_PLATFORM_SYNC_FAILURE', platform: key, campaignId: null, routeId: null, message: sources[key].message || 'Ad platform sync failed', metric: null, currentValue: null, baselineValue: null, detectedAt: now, fingerprint: 'AD_PLATFORM_SYNC_FAILURE|' + key });
  }
}
const paid = (payload.bookings || []).filter((row) => String(row.bookingStatus || '').toLowerCase() === 'paid');
let hoursSince = null;
if (paid.length) {
  const last = paid.map((row) => new Date(row.paidAt || row.createdAt).getTime()).filter((n) => Number.isFinite(n)).sort((a, b) => b - a)[0];
  if (last) hoursSince = (Date.now() - last) / 3600000;
}
if (overall.spend > 0 && hoursSince != null && hoursSince >= 3) {
  alerts.push({ severity: 'CRITICAL', category: 'NO_SALES_WITH_SPEND', platform: null, campaignId: null, routeId: null, message: 'Spend continues but no paid booking for ' + hoursSince.toFixed(1) + ' hours.', metric: 'hoursSinceLastPaidBooking', currentValue: hoursSince, baselineValue: 3, detectedAt: now, fingerprint: 'NO_SALES_WITH_SPEND' });
}
return [{ json: Object.assign({}, payload, { alerts: alerts, detectedAt: now }) }];`, [2060, 120]),
    {
      parameters: {
        resource: 'chat',
        operation: 'message',
        modelId: { __rl: true, mode: 'id', value: '={{ $env.OPENAI_MODEL || "gpt-4o-mini" }}' },
        messages: { values: [{ role: 'system', content: 'Collector no-op. Daily Report workflow runs analysis.' }, { role: 'user', content: 'disabled' }] },
      },
      id: 'dc-ai',
      name: 'AI Analizi',
      type: 'n8n-nodes-base.openAi',
      typeVersion: 1.8,
      position: [2060, 340],
      disabled: true,
    },
    codeNode('dc-report', 'Raporu Kaydet', `const payload = $input.first().json;
const sources = payload.sources || {};
const parts = Object.values(sources);
const fetched = parts.reduce((sum, row) => sum + Number(row.recordsFetched || 0), 0);
const hasOk = parts.some((row) => row.status === 'OK');
const hasFail = parts.some((row) => row.status === 'ERROR');
const hasSkip = parts.some((row) => row.status === 'NOT_CONFIGURED');
let status = 'success';
if (!hasOk && hasSkip && !hasFail) status = 'not_configured';
else if (hasFail && !hasOk) status = 'failed';
else if (hasFail || hasSkip) status = 'partial';
function pack(value) { return JSON.stringify(value || []).replace(/'/g, "''"); }
return [{ json: Object.assign({}, payload, { sync: { source: 'data_collector_v1', status: status, recordsFetched: fetched, recordsInserted: (payload.ads || []).length + (payload.bookings || []).length + (payload.kpis || []).length, recordsUpdated: 0, errorCode: (!hasOk && hasSkip) ? ((sources.ticketgo && sources.ticketgo.code) || 'NOT_CONFIGURED') : (hasFail ? 'AD_PLATFORM_SYNC_FAILURE' : null), errorMessage: null, retryCount: 0 }, adsJson: pack(payload.ads), bookingsJson: pack(payload.bookings), kpisJson: pack(payload.kpis), alertsJson: pack(payload.alerts), analyticsJson: pack(payload.analytics) }) }];`, [2380, 120]),
    {
      parameters: {
        operation: 'executeQuery',
        query: `INSERT INTO marketing.marketing_sync_runs (source, started_at, finished_at, status, records_fetched, records_inserted, records_updated, error_code, error_message, retry_count)
VALUES (
  'data_collector_v1', NOW(), NOW(),
  '{{ $json.sync.status }}',
  {{ Number($json.sync.recordsFetched || 0) }},
  {{ Number($json.sync.recordsInserted || 0) }},
  {{ Number($json.sync.recordsUpdated || 0) }},
  NULLIF('{{ $json.sync.errorCode || '' }}', ''),
  NULL,
  {{ Number($json.sync.retryCount || 0) }}
);

INSERT INTO marketing.marketing_ads_daily (
  platform, date, account_id, campaign_id, campaign_name, ad_group_id, ad_group_name, ad_id, ad_name,
  impressions, clicks, spend, conversions, reported_revenue, reach, currency
)
SELECT
  (e->>'platform')::marketing.platform,
  (e->>'date')::date,
  e->>'accountId', e->>'campaignId', e->>'campaignName', e->>'adGroupId', e->>'adGroupName', e->>'adId', e->>'adName',
  COALESCE((e->>'impressions')::bigint, 0), COALESCE((e->>'clicks')::bigint, 0), COALESCE((e->>'spend')::numeric, 0),
  COALESCE((e->>'conversions')::numeric, 0), COALESCE((e->>'reportedRevenue')::numeric, 0),
  NULLIF(e->>'reach','')::bigint, COALESCE(e->>'currency', 'XXX')
FROM jsonb_array_elements('{{ $json.adsJson }}'::jsonb) AS e
WHERE COALESCE(e->>'date','') <> '' AND COALESCE(e->>'campaignId','') <> '' AND COALESCE(e->>'adId','') <> ''
ON CONFLICT (platform, date, account_id, campaign_id, ad_id) DO UPDATE SET
  campaign_name = EXCLUDED.campaign_name, ad_group_id = EXCLUDED.ad_group_id, ad_group_name = EXCLUDED.ad_group_name,
  ad_name = EXCLUDED.ad_name, impressions = EXCLUDED.impressions, clicks = EXCLUDED.clicks, spend = EXCLUDED.spend,
  conversions = EXCLUDED.conversions, reported_revenue = EXCLUDED.reported_revenue, reach = EXCLUDED.reach,
  currency = EXCLUDED.currency, updated_at = NOW();`,
        options: {},
      },
      id: 'dc-pg',
      name: "PostgreSQL'e Kaydet",
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.5,
      position: [2700, 120],
      credentials: { postgres: { id: 'TICKETGO_MARKETING_POSTGRES', name: 'TicketGo Marketing PostgreSQL' } },
      onError: 'continueErrorOutput',
    },
    codeNode('dc-err', 'Hata Kaydı Oluştur', `const err = $input.first().json;
const raw = String((err.error && err.error.message) || err.message || 'Workflow error').slice(0, 500);
const errorMessage = raw.replace(/passport|tckn|email|phone|\\+\\d{10,}/gi, '[redacted]');
return [{ json: { source: 'data_collector_v1', status: 'failed', errorCode: (err.error && err.error.code) || err.code || 'WORKFLOW_ERROR', errorMessage: errorMessage, recordsFetched: 0, recordsInserted: 0, recordsUpdated: 0, finishedAt: new Date().toISOString() } }];`, [2700, 520], { onError: 'stopWorkflow' }),
  ],
  connections: {
    'Saatlik Tetikleyici': { main: [[link('Pencere Hazırla')]] },
    'Manuel Test': { main: [[link('Pencere Hazırla')]] },
    'Pencere Hazırla': { main: [[link('Google Ads Verisini Al'), link('Meta Ads Verisini Al'), link('GA4 Verisini Al'), link('TicketGo Satışlarını Al')]] },
    'Google Ads Verisini Al': { main: [[link('Kaynakları Birleştir')], [link('Hata Kaydı Oluştur')]] },
    'Meta Ads Verisini Al': { main: [[link('Kaynakları Birleştir', 1)], [link('Hata Kaydı Oluştur')]] },
    'GA4 Verisini Al': { main: [[link('Kaynakları Birleştir', 2)], [link('Hata Kaydı Oluştur')]] },
    'TicketGo Satışlarını Al': { main: [[link('Kaynakları Birleştir', 3)], [link('Hata Kaydı Oluştur')]] },
    'Kaynakları Birleştir': { main: [[link('Veriyi Normalize Et')]] },
    'Veriyi Normalize Et': { main: [[link('Attribution Hesapla')]] },
    'Attribution Hesapla': { main: [[link('KPI Hesapla')]] },
    'KPI Hesapla': { main: [[link('Anomali Kontrolü')]] },
    'Anomali Kontrolü': { main: [[link('Raporu Kaydet'), link('AI Analizi')]] },
    'Raporu Kaydet': { main: [[link("PostgreSQL'e Kaydet")]] },
    "PostgreSQL'e Kaydet": { main: [[], [link('Hata Kaydı Oluştur')]] },
  },
};

const daily = {
  name: 'TicketGo - Marketing Intelligence - Daily AI Report v1',
  active: false,
  settings: { executionOrder: 'v1', timezone: 'Europe/Istanbul' },
  meta: { templateCredsSetupCompleted: false },
  pinData: {},
  nodes: [
    sticky('dr-s1', 'Grup Daily', '## Daily AI Report\\n07:00 Europe/Istanbul. AUTO_ACTION_ENABLED=false. Bütçe yazılmaz.', [-480, -180], 900, 280, 5),
    {
      parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 7 * * *' }] } },
      id: 'dr-sched',
      name: 'Sabah Tetikleyici',
      type: 'n8n-nodes-base.scheduleTrigger',
      typeVersion: 1.2,
      position: [-360, 40],
    },
    { parameters: {}, id: 'dr-manual', name: 'Manuel Test', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [-360, 220] },
    {
      parameters: {
        operation: 'executeQuery',
        query: `SELECT jsonb_build_object(
  'current', (SELECT jsonb_agg(k) FROM marketing.marketing_kpi_daily k WHERE k.date = CURRENT_DATE AND k.grain IN ('overall','platform','campaign','route')),
  'baseline', (SELECT jsonb_agg(k) FROM marketing.marketing_kpi_daily k WHERE k.date >= CURRENT_DATE - 7 AND k.date < CURRENT_DATE AND k.grain IN ('overall','campaign','route')),
  'alerts', (SELECT COALESCE(jsonb_agg(a), '[]'::jsonb) FROM marketing.marketing_alerts a WHERE a.is_resolved = false)
) AS report_input;`,
      },
      id: 'dr-pg-read',
      name: 'KPI Oku',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.5,
      position: [0, 80],
      credentials: { postgres: { id: 'TICKETGO_MARKETING_POSTGRES', name: 'TicketGo Marketing PostgreSQL' } },
      onError: 'continueErrorOutput',
    },
    codeNode('dr-kpi', 'KPI Hesapla', `const input = $input.first().json.report_input || $input.first().json;
const list = (key, grain) => (input[key] || []).filter((row) => row.grain === grain);
const currentOverall = list('current', 'overall')[0] || {};
const campaigns = list('current', 'campaign').slice().sort((a, b) => Number(b.roas || 0) - Number(a.roas || 0));
const routes = list('current', 'route').slice().sort((a, b) => Number(b.net_revenue || b.netRevenue || 0) - Number(a.net_revenue || a.netRevenue || 0));
const worst = list('current', 'campaign').slice().sort((a, b) => Number(b.spend || 0) - Number(a.spend || 0)).find((row) => Number(row.paid_bookings || row.paidBookings || 0) === 0) || campaigns[campaigns.length - 1] || null;
return [{ json: {
  windowLabel: 'last_24h', comparisonLabel: 'previous_7d_avg',
  current: currentOverall,
  bestCampaign: campaigns[0] ? { name: campaigns[0].campaign_name || campaigns[0].campaignName, roas: campaigns[0].roas } : null,
  worstCampaign: worst ? { name: worst.campaign_name || worst.campaignName, spend: worst.spend, paidBookings: worst.paid_bookings || worst.paidBookings || 0, roas: worst.roas } : null,
  bestRoute: routes[0] ? { name: routes[0].route_name || routes[0].routeName, netRevenue: routes[0].net_revenue || routes[0].netRevenue } : null,
  worstRoute: routes[routes.length - 1] ? { name: routes[routes.length - 1].route_name || routes[routes.length - 1].routeName, netRevenue: routes[routes.length - 1].net_revenue || routes[routes.length - 1].netRevenue } : null,
  alerts: input.alerts || [],
  autoActionEnabled: String($env.AUTO_ACTION_ENABLED || 'false').toLowerCase() === 'true',
} }];`, [320, 80]),
    codeNode('dr-anom', 'Anomali Kontrolü', `const payload = $input.first().json;
return [{ json: Object.assign({}, payload, { anomalyCount: (payload.alerts || []).length }) }];`, [600, 80]),
    codeNode('dr-ai-gate', 'AI Hazırla', `const payload = $input.first().json;
if (!String($env.OPENAI_API_KEY || '').trim()) {
  return [{ json: Object.assign({}, payload, { aiStatus: 'NOT_CONFIGURED', code: 'OPENAI_NOT_CONFIGURED', report: { executiveSummary: 'AI analysis skipped: OPENAI_API_KEY is NOT_CONFIGURED.', topWinners: [], topProblems: [], budgetSuggestions: [], routeInsights: [], anomalies: [], actionsToday: [], risks: ['AI analyst is not configured.'] } }) }];
}
return [{ json: Object.assign({}, payload, { aiStatus: 'READY', prompt: JSON.stringify(payload) }) }];`, [880, 80]),
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
          conditions: [{ id: 'ai-ready', leftValue: '={{ $json.aiStatus }}', rightValue: 'READY', operator: { type: 'string', operation: 'equals' } }],
          combinator: 'and',
        },
      },
      id: 'dr-if-ai',
      name: 'OpenAI Hazır mı',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [1020, 80],
    },
    {
      parameters: {
        resource: 'chat',
        operation: 'message',
        modelId: { __rl: true, mode: 'list', value: 'gpt-4o-mini' },
        messages: {
          values: [
            { role: 'system', content: 'Sen TicketGo Marketing Intelligence analistisin. TicketGo feribot/seyahat bileti satar. Ham tablo tekrarlama. Aksiyon üret. Reklam bütçesini otomatik değiştirme. AUTO_ACTION_ENABLED yalnızca echo. JSON dışında bir şey yazma. Keys: executiveSummary, topWinners, topProblems, budgetSuggestions, routeInsights, anomalies, actionsToday, risks.' },
            { role: 'user', content: '={{ $json.prompt }}' },
          ],
        },
      },
      id: 'dr-ai',
      name: 'AI Analizi',
      type: 'n8n-nodes-base.openAi',
      typeVersion: 1.8,
      position: [1160, 40],
      credentials: { openAiApi: { id: 'TICKETGO_OPENAI', name: 'TicketGo OpenAI' } },
      onError: 'continueErrorOutput',
    },
    codeNode('dr-save', 'Raporu Kaydet', `const base = $('AI Hazırla').first().json;
let report = base.report;
if (base.aiStatus === 'READY') {
  const raw = $input.first().json.message && $input.first().json.message.content ? $input.first().json.message.content : ($input.first().json.text || $input.first().json.output || '');
  try { report = JSON.parse(raw); } catch (e) { report = base.report || { executiveSummary: String(raw || '').slice(0, 2000), topWinners: [], topProblems: [], budgetSuggestions: [], routeInsights: [], anomalies: [], actionsToday: [], risks: [] }; }
}
const packed = JSON.stringify(report || {}).replace(/'/g, "''");
return [{ json: { reportDate: new Date().toISOString().slice(0, 10), windowHours: 24, autoActionEnabled: false, reportJson: packed, report: report } }];`, [1480, 80]),
    {
      parameters: {
        operation: 'executeQuery',
        query: `INSERT INTO marketing.marketing_ai_reports (report_date, window_hours, model, auto_action_enabled, executive_summary, report_json)
VALUES ('{{ $json.reportDate }}'::date, {{ Number($json.windowHours) }}, '{{ $env.OPENAI_MODEL || "gpt-4o-mini" }}', false, '{{ ($json.report && $json.report.executiveSummary || '').replace(/'/g, "''") }}', '{{ $json.reportJson }}'::jsonb)
ON CONFLICT (report_date, window_hours) DO UPDATE SET report_json = EXCLUDED.report_json, executive_summary = EXCLUDED.executive_summary, updated_at = NOW();`,
      },
      id: 'dr-pg2',
      name: "PostgreSQL'e Kaydet",
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.5,
      position: [1760, 80],
      credentials: { postgres: { id: 'TICKETGO_MARKETING_POSTGRES', name: 'TicketGo Marketing PostgreSQL' } },
    },
    codeNode('dr-err', 'Hata Kaydı Oluştur', `const err = $input.first().json;
return [{ json: { source: 'daily_ai_report_v1', status: 'failed', errorCode: (err.error && err.error.code) || 'WORKFLOW_ERROR', errorMessage: String((err.error && err.error.message) || err.message || '').slice(0, 500), finishedAt: new Date().toISOString() } }];`, [1760, 300]),
  ],
  connections: {
    'Sabah Tetikleyici': { main: [[link('KPI Oku')]] },
    'Manuel Test': { main: [[link('KPI Oku')]] },
    'KPI Oku': { main: [[link('KPI Hesapla')], [link('Hata Kaydı Oluştur')]] },
    'KPI Hesapla': { main: [[link('Anomali Kontrolü')]] },
    'Anomali Kontrolü': { main: [[link('AI Hazırla')]] },
    'AI Hazırla': { main: [[link('OpenAI Hazır mı')]] },
    'OpenAI Hazır mı': { main: [[link('AI Analizi')], [link('Raporu Kaydet')]] },
    'AI Analizi': { main: [[link('Raporu Kaydet')], [link('Hata Kaydı Oluştur')]] },
    'Raporu Kaydet': { main: [[link("PostgreSQL'e Kaydet")]] },
  },
};

const alertWf = {
  name: 'TicketGo - Marketing Intelligence - Alert Engine v1',
  active: false,
  settings: { executionOrder: 'v1', timezone: 'Europe/Istanbul' },
  meta: { templateCredsSetupCompleted: false },
  pinData: {},
  nodes: [
    sticky('al-s1', 'Grup Alert', '## Alert Engine\\n15 dk. Kanallar Disabled. Duplicate açık fingerprint yok.', [-420, -160], 760, 240, 2),
    {
      parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 15 }] } },
      id: 'al-sched',
      name: 'Alert Tetikleyici',
      type: 'n8n-nodes-base.scheduleTrigger',
      typeVersion: 1.2,
      position: [-300, 40],
    },
    { parameters: {}, id: 'al-manual', name: 'Manuel Test', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [-300, 220] },
    {
      parameters: {
        operation: 'executeQuery',
        query: `SELECT
  (SELECT jsonb_build_object('spend', COALESCE(SUM(spend),0), 'paid_bookings', COALESCE(SUM(paid_bookings),0), 'roas', CASE WHEN COALESCE(SUM(spend),0)=0 THEN NULL ELSE COALESCE(SUM(gross_revenue),0)/SUM(spend) END, 'refund_rate', CASE WHEN COALESCE(SUM(paid_bookings),0)=0 THEN NULL ELSE COALESCE(SUM(refunded_bookings),0)::numeric/SUM(paid_bookings) END) FROM marketing.marketing_kpi_daily WHERE date = CURRENT_DATE AND grain = 'overall') AS current,
  (SELECT jsonb_build_object('spend', COALESCE(AVG(spend),0), 'paid_bookings', COALESCE(AVG(paid_bookings),0), 'roas', AVG(roas), 'refund_rate', AVG(refund_rate)) FROM marketing.marketing_kpi_daily WHERE date >= CURRENT_DATE - 7 AND date < CURRENT_DATE AND grain = 'overall') AS baseline,
  (SELECT EXTRACT(EPOCH FROM (NOW() - MAX(paid_at)))/3600.0 FROM marketing.ticketgo_bookings WHERE booking_status = 'paid') AS hours_since_paid,
  (SELECT jsonb_agg(jsonb_build_object('source', source, 'status', status, 'error_code', error_code)) FROM (SELECT DISTINCT ON (source) source, status, error_code FROM marketing.marketing_sync_runs ORDER BY source, started_at DESC) s) AS syncs;`,
      },
      id: 'al-pg-read',
      name: 'KPI Oku',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.5,
      position: [0, 80],
      credentials: { postgres: { id: 'TICKETGO_MARKETING_POSTGRES', name: 'TicketGo Marketing PostgreSQL' } },
      onError: 'continueErrorOutput',
    },
    codeNode('al-anom', 'Anomali Kontrolü', `function pct(current, baseline) { if (!Number.isFinite(current) || !Number.isFinite(baseline) || baseline === 0) return null; return ((current - baseline) / Math.abs(baseline)) * 100; }
const row = $input.first().json;
const now = new Date().toISOString();
const current = row.current || {};
const baseline = row.baseline || {};
const alerts = [];
const spendChange = pct(Number(current.spend), Number(baseline.spend));
const salesChange = pct(Number(current.paid_bookings), Number(baseline.paid_bookings));
if (spendChange != null && spendChange >= 50 && (salesChange == null || salesChange <= 0)) {
  alerts.push({ severity: 'WARNING', category: 'SPEND_SPIKE', platform: null, campaignId: null, routeId: null, message: 'Spend rose ' + spendChange.toFixed(1) + '% vs 7-day average while paid bookings did not increase.', metric: 'spend', currentValue: Number(current.spend), baselineValue: Number(baseline.spend), detectedAt: now, fingerprint: 'SPEND_SPIKE' });
}
const roasChange = pct(Number(current.roas), Number(baseline.roas));
if (roasChange != null && roasChange <= -30) {
  alerts.push({ severity: 'WARNING', category: 'ROAS_DROP', platform: null, campaignId: null, routeId: null, message: 'ROAS dropped ' + Math.abs(roasChange).toFixed(1) + '% vs 7-day average.', metric: 'roas', currentValue: Number(current.roas), baselineValue: Number(baseline.roas), detectedAt: now, fingerprint: 'ROAS_DROP' });
}
if (Number(current.spend) > 0 && row.hours_since_paid != null && Number(row.hours_since_paid) >= 3) {
  alerts.push({ severity: 'CRITICAL', category: 'NO_SALES_WITH_SPEND', platform: null, campaignId: null, routeId: null, message: 'Spend continues but no paid booking for ' + Number(row.hours_since_paid).toFixed(1) + ' hours.', metric: 'hoursSinceLastPaidBooking', currentValue: Number(row.hours_since_paid), baselineValue: 3, detectedAt: now, fingerprint: 'NO_SALES_WITH_SPEND' });
}
const refundChange = pct(Number(current.refund_rate), Number(baseline.refund_rate));
if (refundChange != null && refundChange >= 50) {
  alerts.push({ severity: 'WARNING', category: 'REFUND_SPIKE', platform: null, campaignId: null, routeId: null, message: 'Refund rate rose ' + refundChange.toFixed(1) + '% vs 7-day average.', metric: 'refundRate', currentValue: Number(current.refund_rate), baselineValue: Number(baseline.refund_rate), detectedAt: now, fingerprint: 'REFUND_SPIKE' });
}
for (const sync of row.syncs || []) {
  if (sync.source === 'ticketgo' && (sync.status === 'not_configured' || sync.status === 'failed')) {
    alerts.push({ severity: 'CRITICAL', category: 'DATA_SOURCE_FAILURE', platform: 'ticketgo', campaignId: null, routeId: null, message: 'TicketGo sales API did not return data (NOT_CONFIGURED or sync failure).', metric: null, currentValue: null, baselineValue: null, detectedAt: now, fingerprint: 'DATA_SOURCE_FAILURE|ticketgo' });
  }
  if (['google_ads', 'meta_ads', 'ga4'].includes(sync.source) && sync.status === 'failed') {
    alerts.push({ severity: 'CRITICAL', category: 'AD_PLATFORM_SYNC_FAILURE', platform: sync.source, campaignId: null, routeId: null, message: 'Ad platform sync failed', metric: null, currentValue: null, baselineValue: null, detectedAt: now, fingerprint: 'AD_PLATFORM_SYNC_FAILURE|' + sync.source });
  }
}
return [{ json: { alerts: alerts, alertsJson: JSON.stringify(alerts).replace(/'/g, "''") } }];`, [320, 80]),
    {
      parameters: {
        operation: 'executeQuery',
        query: `INSERT INTO marketing.marketing_alerts (severity, category, platform, campaign_id, route_id, message, metric, current_value, baseline_value, detected_at, fingerprint)
SELECT (e->>'severity')::marketing.alert_severity, e->>'category', NULLIF(e->>'platform','')::marketing.platform, NULLIF(e->>'campaignId',''), NULLIF(e->>'routeId',''), e->>'message', e->>'metric', NULLIF(e->>'currentValue','')::numeric, NULLIF(e->>'baselineValue','')::numeric, (e->>'detectedAt')::timestamptz, e->>'fingerprint'
FROM jsonb_array_elements('{{ $json.alertsJson }}'::jsonb) AS e
ON CONFLICT (fingerprint) WHERE is_resolved = false DO NOTHING;`,
      },
      id: 'al-pg',
      name: "PostgreSQL'e Kaydet",
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.5,
      position: [640, 80],
      credentials: { postgres: { id: 'TICKETGO_MARKETING_POSTGRES', name: 'TicketGo Marketing PostgreSQL' } },
      onError: 'continueErrorOutput',
    },
    { parameters: { method: 'POST', url: '={{ $env.SLACK_WEBHOOK_URL }}', sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.alerts || []) }}' }, id: 'al-slack', name: 'Slack', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [960, -80], disabled: true },
    { parameters: { method: 'POST', url: '={{ $env.TELEGRAM_BOT_TOKEN ? "https://api.telegram.org/bot" + $env.TELEGRAM_BOT_TOKEN + "/sendMessage" : "" }}' }, id: 'al-tg', name: 'Telegram', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [960, 80], disabled: true },
    { parameters: { method: 'POST', url: '={{ $env.WHATSAPP_API_TOKEN ? "https://graph.facebook.com/v21.0/me/messages" : "" }}' }, id: 'al-wa', name: 'WhatsApp', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [960, 240], disabled: true },
    { parameters: { method: 'POST', url: '={{ $env.ALERT_EMAIL_TO ? "mailto:" + $env.ALERT_EMAIL_TO : "" }}' }, id: 'al-em', name: 'Email', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [960, 400], disabled: true },
    codeNode('al-err', 'Hata Kaydı Oluştur', `const err = $input.first().json;
return [{ json: { source: 'alert_engine_v1', status: 'failed', errorCode: (err.error && err.error.code) || 'WORKFLOW_ERROR', errorMessage: String((err.error && err.error.message) || err.message || '').slice(0, 500), finishedAt: new Date().toISOString() } }];`, [640, 320]),
  ],
  connections: {
    'Alert Tetikleyici': { main: [[link('KPI Oku')]] },
    'Manuel Test': { main: [[link('KPI Oku')]] },
    'KPI Oku': { main: [[link('Anomali Kontrolü')], [link('Hata Kaydı Oluştur')]] },
    'Anomali Kontrolü': { main: [[link("PostgreSQL'e Kaydet")]] },
    "PostgreSQL'e Kaydet": { main: [[link('Slack'), link('Telegram'), link('WhatsApp'), link('Email')], [link('Hata Kaydı Oluştur')]] },
  },
};

for (const wf of [collector, daily, alertWf]) {
  const file = wf.name.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') + '.json';
  writeFileSync(join(outDir, file), JSON.stringify(wf, null, 2));
  console.log('wrote', file);
}
