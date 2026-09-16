/**
 * TicketGo accounting n8n workflows — sources docs/N8N-HANDOFF.md only.
 * No invented TicketGo paths, Luca URLs, or provider credentials.
 */
import { mkdirSync, writeFileSync, readdirSync, unlinkSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), 'workflows', 'accounting');
mkdirSync(outDir, { recursive: true });

const BASE = "={{($env.TICKETGO_ACCOUNTING_BASE_URL || '').replace(/\\/+$/, '')}}";
const BEARER = '=Bearer {{$credentials.ticketgoAccountingApi.token}}';
const ASOF = '={{$now.toUTC().toFormat("yyyy-MM-dd")}}';

function sticky(id, name, content, position, width = 500, height = 240, color = 5) {
  return { parameters: { content, width, height, color }, id, name, type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position };
}
function schedule(id, name, position, hours = 1) {
  return { parameters: { rule: { interval: [{ field: 'hours', hoursInterval: hours }] } }, id, name, type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, position };
}
function manual(id, name, position) {
  return { parameters: {}, id, name, type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position };
}
function httpGet(id, name, path, position) {
  return {
    parameters: {
      method: 'GET',
      url: `${BASE}${path}`,
      sendQuery: true,
      queryParameters: { parameters: [{ name: 'asOf', value: ASOF }] },
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'Authorization', value: BEARER }, { name: 'Accept', value: 'application/json' }] },
      options: { timeout: 30000, response: { response: { fullResponse: true, neverError: true } } },
    },
    id, name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position, retryOnFail: false,
  };
}
function httpPost(id, name, path, jsonBodyExpr, idempotencyExpr, position) {
  return {
    parameters: {
      method: 'POST',
      url: `${BASE}${path}`,
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Authorization', value: BEARER },
          { name: 'Idempotency-Key', value: idempotencyExpr },
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Accept', value: 'application/json' },
        ],
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: jsonBodyExpr,
      options: { timeout: 30000, response: { response: { fullResponse: true, neverError: true } } },
    },
    id, name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position, retryOnFail: false,
  };
}
function ifLt(id, name, left, right, position) {
  return {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ id: `${id}-c`, leftValue: left, rightValue: right, operator: { type: 'number', operation: 'lt' } }],
        combinator: 'and',
      },
    },
    id, name, type: 'n8n-nodes-base.if', typeVersion: 2.2, position,
  };
}
function ifEq(id, name, left, right, position) {
  return {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ id: `${id}-c`, leftValue: left, rightValue: right, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and',
      },
    },
    id, name, type: 'n8n-nodes-base.if', typeVersion: 2.2, position,
  };
}
function switchHttp(id, name, position) {
  const cond = (cid, value, op = 'equals') => ({
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      combinator: 'and',
      conditions: [{ id: cid, leftValue: '={{$json.statusCode}}', rightValue: value, operator: { type: 'number', operation: op } }],
    },
    renameOutput: true,
  });
  return {
    parameters: {
      rules: {
        values: [
          { ...cond('c409', 409), outputKey: '409' },
          { ...cond('c400', 400), outputKey: '400' },
          { ...cond('c401', 401), outputKey: '401' },
          { ...cond('c403', 403), outputKey: '403' },
          { ...cond('c429', 429), outputKey: '429' },
          { ...cond('c5xx', 500, 'gte'), outputKey: '5xx' },
        ],
      },
      options: { fallbackOutput: 'extra' },
    },
    id, name, type: 'n8n-nodes-base.switch', typeVersion: 3.2, position,
  };
}
function code(id, name, jsCode, position) {
  return { parameters: { jsCode }, id, name, type: 'n8n-nodes-base.code', typeVersion: 2, position, retryOnFail: false };
}
function wait(id, name, position) {
  return { parameters: { amount: 4, unit: 'seconds' }, id, name, type: 'n8n-nodes-base.wait', typeVersion: 1.1, position };
}
function noop(id, name, position) {
  return { parameters: {}, id, name, type: 'n8n-nodes-base.noOp', typeVersion: 1, position };
}
function split(id, name, field, position) {
  return { parameters: { fieldToSplitOut: field, options: {} }, id, name, type: 'n8n-nodes-base.splitOut', typeVersion: 1, position };
}
function errorTrigger(id, name, position) {
  return { parameters: {}, id, name, type: 'n8n-nodes-base.errorTrigger', typeVersion: 1, position };
}
function L(target) {
  if (typeof target === 'string') return { node: target, type: 'main', index: 0 };
  return { node: target.node, type: 'main', index: target.index ?? 0 };
}
function C(spec) {
  const connections = {};
  for (const [from, outputs] of Object.entries(spec)) {
    connections[from] = { main: outputs.map((list) => list.map(L)) };
  }
  return connections;
}
function workflowId(code) {
  const n = String(code.replace('TG-ACC-', '')).padStart(3, '0');
  return `a11c0000-acc0-4000-8000-${n.padStart(12, '0')}`;
}
function wf(code, name, nodes, connections) {
  const isErrorHandler = code === 'TG-ACC-99';
  return {
    id: workflowId(code),
    name,
    active: false,
    nodes,
    connections,
    pinData: {},
    settings: {
      executionOrder: 'v1',
      timezone: 'Europe/Istanbul',
      callerPolicy: 'workflowsFromSameOwner',
      saveManualExecutions: true,
    },
    staticData: null,
    meta: {
      templateCredsSetupCompleted: false,
      preparedErrorWorkflow: isErrorHandler ? null : 'TG-ACC-99',
    },
    tags: [],
    versionId: workflowId(code),
  };
}
const written = [];
function save(code, json) {
  const file = `${code}.json`;
  const errors = validateWorkflow(json, code);
  if (errors.length) {
    throw new Error(`${code} schema invalid:\n- ${errors.join('\n- ')}`);
  }
  writeFileSync(join(outDir, file), `${JSON.stringify(json, null, 2)}\n`);
  written.push(file);
}

const HANDOFF_PATHS = [
  '/api/n8n/accounting/pending',
  '/api/n8n/accounting/export',
  '/api/n8n/accounting/result',
  '/api/n8n/invoices/due',
  '/api/n8n/invoices/result',
  '/api/n8n/bank-transactions',
  '/api/n8n/pos-transactions',
  '/api/n8n/documents',
  '/api/n8n/ocr-result',
  '/api/n8n/supplier-payments/due',
  '/api/n8n/supplier-payments/result',
  '/api/n8n/reservations/completed',
  '/api/n8n/webhook',
];

function validateWorkflow(json, code) {
  const errors = [];
  if (!json || typeof json !== 'object') return ['not an object'];
  for (const key of ['name', 'nodes', 'connections', 'active', 'settings', 'pinData']) {
    if (!(key in json)) errors.push(`missing ${key}`);
  }
  if (json.active !== false) errors.push('active must be false until credentials exist');
  if (!Array.isArray(json.nodes)) errors.push('nodes must be an array');
  if (!json.connections || typeof json.connections !== 'object') errors.push('connections must be an object');
  const names = new Set();
  const ids = new Set();
  for (const node of json.nodes || []) {
    if (!node.id || !node.name || !node.type || !node.typeVersion || !Array.isArray(node.position) || node.position.length !== 2) {
      errors.push(`invalid node ${node && node.name}`);
    }
    if (names.has(node.name)) errors.push(`duplicate node name ${node.name}`);
    names.add(node.name);
    if (ids.has(node.id)) errors.push(`duplicate node id ${node.id}`);
    ids.add(node.id);
    if (node.type === 'n8n-nodes-base.httpRequest') {
      const url = String(node.parameters && node.parameters.url || '');
      const method = String(node.parameters && node.parameters.method || 'GET').toUpperCase();
      const headers = ((node.parameters && node.parameters.headerParameters && node.parameters.headerParameters.parameters) || []).map((h) => h.name);
      if (url.includes('/api/n8n/')) {
        const known = HANDOFF_PATHS.some((p) => url.includes(p));
        if (!known) errors.push(`${node.name} uses undocumented path: ${url}`);
        if (!headers.includes('Authorization')) errors.push(`${node.name} missing Authorization`);
        if (method === 'POST' && !headers.includes('Idempotency-Key')) errors.push(`${node.name} POST missing Idempotency-Key`);
      } else if (url.includes('LUCA_API_BASE_URL')) {
        if (node.disabled !== true) errors.push(`${node.name} Luca HTTP must stay disabled until URL exists`);
      } else if (url && !url.includes('$env.TICKETGO_ACCOUNTING_BASE_URL') && !url.includes('LUCA')) {
        errors.push(`${node.name} unexpected URL ${url}`);
      }
    }
  }
  for (const [from, spec] of Object.entries(json.connections || {})) {
    if (!names.has(from)) errors.push(`connection from unknown node ${from}`);
    const outputs = spec && spec.main ? spec.main : [];
    for (const branch of outputs) {
      for (const link of branch || []) {
        if (!names.has(link.node)) errors.push(`${from} -> unknown node ${link.node}`);
      }
    }
  }
  if (code !== 'TG-ACC-99' && json.meta && json.meta.preparedErrorWorkflow !== 'TG-ACC-99') {
    errors.push('critical workflow must prepare TG-ACC-99 error handler');
  }
  return errors;
}

const RETRY = `const status = Number($json.statusCode || 0);
const body = $json.body || {};
const code = body.code;
if (status === 401 || status === 403 || code === 'UNAUTHORIZED' || code === 'N8N_TOKEN_NOT_CONFIGURED') {
  throw Object.assign(new Error('SECURITY_CREDENTIAL_ALERT'), { httpStatus: status, code: code || 'UNAUTHORIZED', noRetry: true });
}
if (status === 400 || ['INVALID_QUERY','INVALID_JSON','IDEMPOTENCY_KEY_REQUIRED','BANK_ACCOUNT_NOT_FOUND','POS_PROVIDER_NOT_FOUND'].includes(code)) {
  throw Object.assign(new Error('VALIDATION_NO_RETRY'), { httpStatus: status, code, noRetry: true });
}
if (status === 409 || code === 'IDEMPOTENCY_CONFLICT' || code === 'DUPLICATE_DOCUMENT') {
  return [{ json: { duplicate: true, statusCode: status, code, body } }];
}
if ([429,500,502,503,504].includes(status)) {
  return [{ json: { retry: true, statusCode: status, code, body } }];
}
if (status >= 400) {
  throw Object.assign(new Error('HTTP_ERROR'), { httpStatus: status, code, noRetry: true });
}
return [{ json: { ok: true, statusCode: status, body, data: body.data } }];
`;

function httpClassOutputs() {
  return [['409 Duplicate'], ['400 No Retry'], ['401/403 Alert'], ['401/403 Alert'], ['Backoff Wait'], ['Backoff Wait']];
}

function pollShell(p, path, note) {
  return [
    sticky(`${p}-note`, 'Sözleşme', note, [-740, -240], 520, 260, 5),
    schedule(`${p}-cron`, 'Schedule', [-540, 40], 1),
    manual(`${p}-manual`, 'Manual', [-540, 200]),
    httpGet(`${p}-http`, 'HTTP Request TicketGo', path, [-180, 80]),
    ifLt(`${p}-ok`, 'IF HTTP 2xx', '={{$json.statusCode}}', 300, [140, 20]),
    code(`${p}-router`, 'HTTP Status Router', RETRY, [140, 260]),
    switchHttp(`${p}-sw`, 'Switch HTTP class', [440, 260]),
    wait(`${p}-wait`, 'Backoff Wait', [740, 420]),
    httpGet(`${p}-retry`, 'HTTP Request Retry', path, [980, 420]),
    noop(`${p}-dup`, '409 Duplicate', [740, 140]),
    noop(`${p}-noret`, '400 No Retry', [740, 220]),
    noop(`${p}-sec`, '401/403 Alert', [740, 300]),
  ];
}

function pollConns(splitName) {
  return {
    Schedule: [['HTTP Request TicketGo']],
    Manual: [['HTTP Request TicketGo']],
    'HTTP Request TicketGo': [['IF HTTP 2xx']],
    'IF HTTP 2xx': [[splitName], ['HTTP Status Router']],
    'HTTP Status Router': [['Switch HTTP class']],
    'Switch HTTP class': httpClassOutputs(),
    'Backoff Wait': [['HTTP Request Retry']],
    'HTTP Request Retry': [['IF HTTP 2xx']],
  };
}

const CONTRACT = `Kaynak: docs/N8N-HANDOFF.md
Bearer: $credentials.ticketgoAccountingApi.token
POST: Idempotency-Key zorunlu
409 = duplicate/idempotent
400 = retry yok
401/403 = credential alert
429 backoff; 5xx retry (max 3 via Wait+Retry node)
KDV/tutar/tarih n8n'de hesaplanmaz
Error workflow import sonrası: TG-ACC-99`;

// 01
{
  const p = 'a01';
  const nodes = [
    ...pollShell(p, '/api/n8n/reservations/completed', `${CONTRACT}\nGET /api/n8n/reservations/completed`),
    split(`${p}-split`, 'Split Records', 'body.data.reservations', [440, 20]),
    code(`${p}-prep`, 'Prepare webhook', `const row = $json;
return [{ json: { idempotencyKey: 'svc-completed:' + row.id, body: { event: 'SERVICE_COMPLETED', payload: { id: row.id, reservationNo: row.reservationNo, actualServiceCompletionDate: row.actualServiceCompletionDate } } } }];`, [740, 20]),
    httpPost(`${p}-wh`, 'POST webhook audit', '/api/n8n/webhook', '={{JSON.stringify($json.body)}}', '={{$json.idempotencyKey}}', [1040, 20]),
    code(`${p}-rr`, 'Result Router', RETRY, [1340, 20]),
  ];
  const connections = { ...pollConns('Split Records'), 'Split Records': [['Prepare webhook']], 'Prepare webhook': [['POST webhook audit']], 'POST webhook audit': [['Result Router']] };
  save('TG-ACC-01', wf('TG-ACC-01', 'TG-ACC-01 Service Completion Monitor', nodes, C(connections)));
}

// 02
{
  const p = 'a02';
  const nodes = [
    ...pollShell(p, '/api/n8n/invoices/due', `${CONTRACT}\nGET /api/n8n/invoices/due\ninvoiceTargetDate Core'dan; +2 kuralı yok`),
    split(`${p}-split`, 'Split Records', 'body.data.invoices', [440, 20]),
    code(`${p}-prep`, 'Pass-through Core dates', `const inv = $json;
return [{ json: { idempotencyKey: 'invoice-due:' + inv.id, body: { event: 'INVOICE_DUE', payload: { invoiceId: inv.id, reservationNo: inv.reservationNo, invoiceTargetDate: inv.invoiceTargetDate, legalDeadline: inv.legalDeadline, status: inv.status } } } }];`, [740, 20]),
    httpPost(`${p}-wh`, 'POST webhook audit', '/api/n8n/webhook', '={{JSON.stringify($json.body)}}', '={{$json.idempotencyKey}}', [1080, 20]),
  ];
  const connections = { ...pollConns('Split Records'), 'Split Records': [['Pass-through Core dates']], 'Pass-through Core dates': [['POST webhook audit']] };
  save('TG-ACC-02', wf('TG-ACC-02', 'TG-ACC-02 Invoice Scheduler', nodes, C(connections)));
}

// 03
{
  const p = 'a03';
  const nodes = [
    ...pollShell(p, '/api/n8n/invoices/due', `${CONTRACT}\nGET /api/n8n/invoices/due\nstatus ACCOUNTING_REVIEW retry edilmez`),
    split(`${p}-split`, 'Split Records', 'body.data.invoices', [440, 20]),
    {
      parameters: {
        rules: {
          values: [
            { conditions: { combinator: 'and', conditions: [{ id: 's', leftValue: '={{$json.status}}', rightValue: 'SCHEDULED', operator: { type: 'string', operation: 'equals' } }] }, renameOutput: true, outputKey: 'SCHEDULED' },
            { conditions: { combinator: 'and', conditions: [{ id: 'r', leftValue: '={{$json.status}}', rightValue: 'ACCOUNTING_REVIEW', operator: { type: 'string', operation: 'equals' } }] }, renameOutput: true, outputKey: 'REVIEW' },
          ],
        },
        options: { fallbackOutput: 'extra' },
      },
      id: `${p}-st`,
      name: 'Switch invoice.status',
      type: 'n8n-nodes-base.switch',
      typeVersion: 3.2,
      position: [740, 20],
    },
    noop(`${p}-go`, 'SCHEDULED — dispatch adayı', [1040, -40]),
    noop(`${p}-rev`, 'ACCOUNTING_REVIEW — no retry', [1040, 80]),
    noop(`${p}-oth`, 'Other status', [1040, 200]),
  ];
  const connections = {
    ...pollConns('Split Records'),
    'Split Records': [['Switch invoice.status']],
    'Switch invoice.status': [['SCHEDULED — dispatch adayı'], ['ACCOUNTING_REVIEW — no retry'], ['Other status']],
  };
  save('TG-ACC-03', wf('TG-ACC-03', 'TG-ACC-03 Invoice Validation', nodes, C(connections)));
}

// 04
{
  const p = 'a04';
  const nodes = [
    sticky(`${p}-note`, 'e-Fatura yok', 'HANDOFF: E-invoice / GIB Not implemented.\nissued:true SAHTE yazılmaz.\nEINVOICE_PROVIDER_BASE_URL dokümanda yok; boşsa dur.', [-740, -240], 520, 220, 3),
    ...pollShell(p, '/api/n8n/invoices/due', `${CONTRACT}\nPOST /api/n8n/invoices/result yalnız gerçek provider sonrası`).slice(1),
    split(`${p}-split`, 'Split Records', 'body.data.invoices', [440, 20]),
    code(`${p}-cfg`, 'Provider gate', `const inv = $json;
return [{ json: { configured: false, code: 'EINVOICE_NOT_IMPLEMENTED', invoiceId: inv.id, note: 'docs/N8N-HANDOFF.md: E-invoice / GIB Not implemented' } }];`, [740, 20]),
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
          conditions: [{ id: 'cfg', leftValue: '={{$json.configured}}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
          combinator: 'and',
        },
      },
      id: `${p}-if`,
      name: 'IF provider ready',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [1040, 20],
    },
    httpPost(`${p}-post`, 'POST invoices/result', '/api/n8n/invoices/result', '={{JSON.stringify($json.body)}}', '={{$json.idempotencyKey}}', [1340, -40]),
    noop(`${p}-skip`, 'NOT_CONFIGURED skip', [1340, 120]),
  ];
  const connections = {
    ...pollConns('Split Records'),
    'Split Records': [['Provider gate']],
    'Provider gate': [['IF provider ready']],
    'IF provider ready': [['POST invoices/result'], ['NOT_CONFIGURED skip']],
  };
  save('TG-ACC-04', wf('TG-ACC-04', 'TG-ACC-04 Invoice Dispatch', nodes, C(connections)));
}

// 05 OCR
{
  const p = 'a05';
  const nodes = [
    sticky(`${p}-note`, 'OCR vendor yok', `${CONTRACT}\nPOST /api/n8n/documents sonra POST /api/n8n/ocr-result\nBu app OCR çalıştırmaz. Vendor URL uydurma.\nKategori kararı Core'da.`, [-740, -260], 540, 260, 3),
    manual(`${p}-manual`, 'Manual', [-540, 80]),
    code(`${p}-in`, 'Intake fields from item', `const j = $json;
if (!j.fileHash) throw Object.assign(new Error('VALIDATION_NO_RETRY'), { noRetry: true, code: 'INVALID_QUERY' });
const body = { fileHash: j.fileHash, taxNumber: j.taxNumber, documentNumber: j.documentNumber, documentDate: j.documentDate, totalMinor: j.totalMinor, source: 'n8n', mimeType: j.mimeType };
return [{ json: { idempotencyKey: 'doc:' + j.fileHash, body, ocr: j.ocr || {} } }];`, [-180, 80]),
    httpPost(`${p}-doc`, 'HTTP POST documents', '/api/n8n/documents', '={{JSON.stringify($json.body)}}', '={{$json.idempotencyKey}}', [160, 80]),
    ifLt(`${p}-ok`, 'IF HTTP 2xx', '={{$json.statusCode}}', 300, [460, 0]),
    code(`${p}-dr`, 'HTTP Status Router', RETRY, [460, 220]),
    switchHttp(`${p}-sw`, 'Switch HTTP class', [740, 220]),
    wait(`${p}-wait`, 'Backoff Wait', [1040, 360]),
    noop(`${p}-dup`, '409 Duplicate', [1040, 80]),
    noop(`${p}-noret`, '400 No Retry', [1040, 160]),
    noop(`${p}-sec`, '401/403 Alert', [1040, 240]),
    code(`${p}-ocr`, 'OCR fields gate', `const intake = $('Intake fields from item').first().json;
const prev = $json;
const o = intake.ocr || {};
if (o.confidence == null || o.totalMinor == null) {
  return [{ json: { configured: false, code: 'OCR_RESULT_FIELDS_MISSING', document: prev } }];
}
return [{ json: { configured: true, document: prev, ocr: o } }];`, [1040, -40]),
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
          conditions: [{ id: 'o', leftValue: '={{$json.configured}}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
          combinator: 'and',
        },
      },
      id: `${p}-ifocr`,
      name: 'IF OCR fields ready',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [1340, -40],
    },
    noop(`${p}-ocrskip`, 'OCR vendor NOT_CONFIGURED', [1640, 80]),
    code(`${p}-ocrp`, 'Prepare ocr-result', `const intake = $('Intake fields from item').first().json;
const doc = $('HTTP Status Router').first().json;
const documentId = doc.body && doc.body.data && doc.body.data.id;
const o = intake.ocr;
const body = { documentId, supplierName: o.supplierName, confidence: o.confidence, subtotalMinor: o.subtotalMinor, vatMinor: o.vatMinor, discountMinor: o.discountMinor, totalMinor: o.totalMinor, payload: o.payload || {} };
return [{ json: { idempotencyKey: 'ocr:' + documentId, body } }];`, [1640, -80]),
    httpPost(`${p}-ocrpost`, 'HTTP POST ocr-result', '/api/n8n/ocr-result', '={{JSON.stringify($json.body)}}', '={{$json.idempotencyKey}}', [1940, -80]),
    {
      parameters: {
        rules: {
          values: [
            { conditions: { combinator: 'and', conditions: [{ id: 'p', leftValue: '={{$json.body.data.status}}', rightValue: 'POSTED', operator: { type: 'string', operation: 'equals' } }] }, renameOutput: true, outputKey: 'POSTED' },
            { conditions: { combinator: 'and', conditions: [{ id: 'r', leftValue: '={{$json.body.data.status}}', rightValue: 'REVIEW_REQUIRED', operator: { type: 'string', operation: 'equals' } }] }, renameOutput: true, outputKey: 'REVIEW' },
          ],
        },
        options: { fallbackOutput: 'extra' },
      },
      id: `${p}-ocrst`,
      name: 'Switch OCR Core decision',
      type: 'n8n-nodes-base.switch',
      typeVersion: 3.2,
      position: [2240, -80],
    },
    noop(`${p}-posted`, 'Core POSTED', [2540, -140]),
    noop(`${p}-review`, 'Core REVIEW_REQUIRED', [2540, -20]),
  ];
  const connections = C({
    Manual: [['Intake fields from item']],
    'Intake fields from item': [['HTTP POST documents']],
    'HTTP POST documents': [['IF HTTP 2xx']],
    'IF HTTP 2xx': [['OCR fields gate'], ['HTTP Status Router']],
    'HTTP Status Router': [['Switch HTTP class']],
    'Switch HTTP class': [['409 Duplicate'], ['400 No Retry'], ['401/403 Alert'], ['401/403 Alert'], ['Backoff Wait'], ['Backoff Wait']],
    'Backoff Wait': [['HTTP POST documents']],
    'OCR fields gate': [['IF OCR fields ready']],
    'IF OCR fields ready': [['Prepare ocr-result'], ['OCR vendor NOT_CONFIGURED']],
    'Prepare ocr-result': [['HTTP POST ocr-result']],
    'HTTP POST ocr-result': [['Switch OCR Core decision']],
    'Switch OCR Core decision': [['Core POSTED'], ['Core REVIEW_REQUIRED']],
  });
  save('TG-ACC-05', wf('TG-ACC-05', 'TG-ACC-05 Accounting Document OCR', nodes, connections));
}

// 06 duplicate is a dedicated 409 path on documents
{
  const p = 'a06';
  const nodes = [
    sticky(`${p}-note`, 'Duplicate Core’da', `${CONTRACT}\nPOST /api/n8n/documents\n409 DUPLICATE_DOCUMENT\nHash/fingerprint kontrolü n8n'de yok`, [-740, -220], 500, 240, 5),
    manual(`${p}-manual`, 'Manual', [-540, 80]),
    code(`${p}-in`, 'Intake fields from item', `const j = $json;
if (!j.fileHash) throw Object.assign(new Error('VALIDATION_NO_RETRY'), { noRetry: true, code: 'INVALID_QUERY' });
return [{ json: { idempotencyKey: 'doc:' + j.fileHash, body: { fileHash: j.fileHash, taxNumber: j.taxNumber, documentNumber: j.documentNumber, documentDate: j.documentDate, totalMinor: j.totalMinor, source: 'n8n', mimeType: j.mimeType } } }];`, [-180, 80]),
    httpPost(`${p}-doc`, 'HTTP POST documents', '/api/n8n/documents', '={{JSON.stringify($json.body)}}', '={{$json.idempotencyKey}}', [160, 80]),
    ifLt(`${p}-ok`, 'IF HTTP 2xx', '={{$json.statusCode}}', 300, [460, 0]),
    code(`${p}-dr`, 'HTTP Status Router', RETRY, [460, 200]),
    switchHttp(`${p}-sw`, 'Switch HTTP class', [740, 200]),
    wait(`${p}-wait`, 'Backoff Wait', [1040, 360]),
    noop(`${p}-dup`, '409 Duplicate — Core blocked', [1040, -40]),
    noop(`${p}-noret`, '400 No Retry', [1040, 80]),
    noop(`${p}-sec`, '401/403 Alert', [1040, 160]),
    noop(`${p}-accepted`, '201/200 accepted', [1040, 240]),
  ];
  save('TG-ACC-06', wf('TG-ACC-06', 'TG-ACC-06 Duplicate Document Control', nodes, C({
    Manual: [['Intake fields from item']],
    'Intake fields from item': [['HTTP POST documents']],
    'HTTP POST documents': [['IF HTTP 2xx']],
    'IF HTTP 2xx': [['201/200 accepted'], ['HTTP Status Router']],
    'HTTP Status Router': [['Switch HTTP class']],
    'Switch HTTP class': [['409 Duplicate — Core blocked'], ['400 No Retry'], ['401/403 Alert'], ['401/403 Alert'], ['Backoff Wait'], ['Backoff Wait']],
    'Backoff Wait': [['HTTP POST documents']],
  })));
}

// 07 hotel supplier due
{
  const p = 'a07';
  const nodes = [
    ...pollShell(p, '/api/n8n/supplier-payments/due', `${CONTRACT}\nGET /api/n8n/supplier-payments/due\nTutar Core'dan. Transfer yok.`),
    split(`${p}-split`, 'Split Records', 'body.data.payments', [440, 20]),
    noop(`${p}-due`, 'PENDING payment (Core amountMinor)', [740, 20]),
  ];
  const connections = { ...pollConns('Split Records'), 'Split Records': [['PENDING payment (Core amountMinor)']] };
  save('TG-ACC-07', wf('TG-ACC-07', 'TG-ACC-07 Hotel Supplier Payment Monitor', nodes, C(connections)));
}

// 08 early booking — same endpoint, documented
{
  const p = 'a08';
  const nodes = [
    sticky(`${p}-x`, 'Endpoint yok', 'HANDOFF’ta early-booking path YOK.\nTaksit Core’da hesaplanır.\nBu workflow yalnız GET /supplier-payments/due okur.\nAlan uydurma / split yok.', [-740, -280], 500, 200, 3),
    ...pollShell(p, '/api/n8n/supplier-payments/due', `${CONTRACT}\nGET /api/n8n/supplier-payments/due`).slice(1),
    split(`${p}-split`, 'Split Records', 'body.data.payments', [440, 20]),
    noop(`${p}-due`, 'Due row as returned by Core', [740, 20]),
  ];
  const connections = { ...pollConns('Split Records'), 'Split Records': [['Due row as returned by Core']] };
  save('TG-ACC-08', wf('TG-ACC-08', 'TG-ACC-08 Early Booking Payments', nodes, C(connections)));
}

// 09 result
{
  const p = 'a09';
  const nodes = [
    sticky(`${p}-note`, 'Bank transfer yok', `${CONTRACT}\nPOST /api/n8n/supplier-payments/result\npaymentId + status PROCESSED\nBu app havale yapmaz`, [-740, -220], 500, 220, 5),
    manual(`${p}-manual`, 'Manual', [-540, 80]),
    code(`${p}-prep`, 'Prepare result body', `const j = $json;
if (!j.paymentId) throw Object.assign(new Error('VALIDATION_NO_RETRY'), { noRetry: true, code: 'INVALID_QUERY' });
const body = { paymentId: j.paymentId, status: j.status || 'PROCESSED' };
if (j.paidAt) body.paidAt = j.paidAt;
return [{ json: { idempotencyKey: 'supplier-pay:' + j.paymentId, body } }];`, [-180, 80]),
    httpPost(`${p}-post`, 'HTTP POST supplier-payments/result', '/api/n8n/supplier-payments/result', '={{JSON.stringify($json.body)}}', '={{$json.idempotencyKey}}', [200, 80]),
    ifLt(`${p}-ok`, 'IF HTTP 2xx', '={{$json.statusCode}}', 300, [540, 0]),
    code(`${p}-rr`, 'HTTP Status Router', RETRY, [540, 200]),
    switchHttp(`${p}-sw`, 'Switch HTTP class', [820, 80]),
    wait(`${p}-wait`, 'Backoff Wait', [1120, 360]),
    noop(`${p}-dup`, '409 Duplicate', [1120, -40]),
    noop(`${p}-noret`, '400 No Retry', [1120, 40]),
    noop(`${p}-sec`, '401/403 Alert', [1120, 120]),
    noop(`${p}-payok`, 'Audit SUPPLIER_PAYMENT_COMPLETED (Core)', [1120, 220]),
  ];
  save('TG-ACC-09', wf('TG-ACC-09', 'TG-ACC-09 Supplier Payment Result', nodes, C({
    Manual: [['Prepare result body']],
    'Prepare result body': [['HTTP POST supplier-payments/result']],
    'HTTP POST supplier-payments/result': [['IF HTTP 2xx']],
    'IF HTTP 2xx': [['Audit SUPPLIER_PAYMENT_COMPLETED (Core)'], ['HTTP Status Router']],
    'HTTP Status Router': [['Switch HTTP class']],
    'Switch HTTP class': [['409 Duplicate'], ['400 No Retry'], ['401/403 Alert'], ['401/403 Alert'], ['Backoff Wait'], ['Backoff Wait']],
    'Backoff Wait': [['HTTP POST supplier-payments/result']],
  })));
}

function ingestWorkflow(file, name, path, prepareCode, note) {
  const p = file.slice(0, 3);
  const nodes = [
    sticky(`${p}-note`, 'Ingest only', note, [-740, -240], 520, 240, 3),
    manual(`${p}-manual`, 'Manual', [-540, 80]),
    code(`${p}-prep`, 'Prepare ingest', prepareCode, [-180, 80]),
    httpPost(`${p}-post`, 'HTTP POST ingest', path, '={{JSON.stringify($json.body)}}', '={{$json.idempotencyKey}}', [200, 80]),
    ifLt(`${p}-ok`, 'IF HTTP 2xx', '={{$json.statusCode}}', 300, [540, 0]),
    code(`${p}-rr`, 'HTTP Status Router', RETRY, [540, 200]),
    switchHttp(`${p}-sw`, 'Switch HTTP class', [820, 200]),
    wait(`${p}-wait`, 'Backoff Wait', [1120, 400]),
    noop(`${p}-dup`, '409/duplicate from Core', [1120, 40]),
    noop(`${p}-noret`, '400 No Retry', [1120, 120]),
    noop(`${p}-sec`, '401/403 Alert', [1120, 200]),
    noop(`${p}-ingok`, 'Ingest accepted', [820, -40]),
    noop(`${p}-pull`, 'Do not send pullFromBank/pullFromProvider', [200, 280]),
  ];
  save(file, wf(file, name, nodes, C({
    Manual: [['Prepare ingest']],
    'Prepare ingest': [['HTTP POST ingest']],
    'HTTP POST ingest': [['IF HTTP 2xx']],
    'IF HTTP 2xx': [['Ingest accepted'], ['HTTP Status Router']],
    'HTTP Status Router': [['Switch HTTP class']],
    'Switch HTTP class': [['409/duplicate from Core'], ['400 No Retry'], ['401/403 Alert'], ['401/403 Alert'], ['Backoff Wait'], ['Backoff Wait']],
    'Backoff Wait': [['HTTP POST ingest']],
  })));
}

ingestWorkflow(
  'TG-ACC-10',
  'TG-ACC-10 Bank Transaction Import',
  '/api/n8n/bank-transactions',
  `const j = $json;
if (j.pullFromBank === true) throw Object.assign(new Error('VALIDATION_NO_RETRY'), { noRetry: true, code: 'BANK_PROVIDER_NOT_CONFIGURED' });
if (!j.bankAccountId || j.amountMinor == null) throw Object.assign(new Error('VALIDATION_NO_RETRY'), { noRetry: true, code: 'INVALID_QUERY' });
const body = { bankAccountId: j.bankAccountId, amountMinor: j.amountMinor, currency: j.currency || 'TRY', bookedAt: j.bookedAt, reference: j.reference, counterIban: j.counterIban, idempotencyKey: j.idempotencyKey || j.reference };
return [{ json: { idempotencyKey: body.idempotencyKey, body } }];`,
  `${CONTRACT}\nPOST /api/n8n/bank-transactions ingest.\npullFromBank:true YASAK (503). Banka URL yok.`,
);

// 11 reconciliation without extra API
{
  const p = 'a11';
  const nodes = [
    sticky(`${p}-note`, 'Reconciliation API yok', 'HANDOFF’ta match endpoint yok.\nDuplicate kontrolü Core ingest yanıtı `duplicate`.\nYeni kayıtta webhook CUSTOMER_PAYMENT_RECEIVED (vocab).', [-740, -260], 520, 240, 3),
    manual(`${p}-manual`, 'Manual', [-540, 80]),
    code(`${p}-prep`, 'Prepare ingest', `const j = $json;
if (j.pullFromBank === true) throw Object.assign(new Error('VALIDATION_NO_RETRY'), { noRetry: true, code: 'BANK_PROVIDER_NOT_CONFIGURED' });
const body = { bankAccountId: j.bankAccountId, amountMinor: j.amountMinor, currency: j.currency || 'TRY', bookedAt: j.bookedAt, reference: j.reference, counterIban: j.counterIban, idempotencyKey: j.idempotencyKey || j.reference };
return [{ json: { idempotencyKey: body.idempotencyKey, body } }];`, [-180, 80]),
    httpPost(`${p}-post`, 'HTTP POST ingest', '/api/n8n/bank-transactions', '={{JSON.stringify($json.body)}}', '={{$json.idempotencyKey}}', [200, 80]),
    ifLt(`${p}-ok`, 'IF HTTP 2xx', '={{$json.statusCode}}', 300, [540, 0]),
    code(`${p}-rr`, 'HTTP Status Router', RETRY, [540, 200]),
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
          conditions: [{ id: 'd', leftValue: '={{$json.duplicate || $json.body.data.duplicate}}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
          combinator: 'and',
        },
      },
      id: `${p}-dupif`,
      name: 'IF Core duplicate',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [840, 80],
    },
    noop(`${p}-dup`, 'Already ingested — stop', [1140, 160]),
    code(`${p}-whp`, 'Prepare CUSTOMER_PAYMENT_RECEIVED', `const data = $json.body && $json.body.data ? $json.body.data : $json.data;
return [{ json: { idempotencyKey: 'bank-cust:' + (data && data.id), body: { event: 'CUSTOMER_PAYMENT_RECEIVED', payload: { id: data && data.id, duplicate: false } } } }];`, [1140, 0]),
    httpPost(`${p}-wh`, 'POST webhook audit', '/api/n8n/webhook', '={{JSON.stringify($json.body)}}', '={{$json.idempotencyKey}}', [1440, 0]),
    switchHttp(`${p}-sw`, 'Switch HTTP class', [840, 300]),
    wait(`${p}-wait`, 'Backoff Wait', [1140, 400]),
    noop(`${p}-noret`, '400 No Retry', [1140, 240]),
    noop(`${p}-sec`, '401/403 Alert', [1140, 320]),
  ];
  save('TG-ACC-11', wf('TG-ACC-11', 'TG-ACC-11 Bank Reconciliation', nodes, C({
    Manual: [['Prepare ingest']],
    'Prepare ingest': [['HTTP POST ingest']],
    'HTTP POST ingest': [['IF HTTP 2xx']],
    'IF HTTP 2xx': [['IF Core duplicate'], ['HTTP Status Router']],
    'HTTP Status Router': [['Switch HTTP class']],
    'IF Core duplicate': [['Already ingested — stop'], ['Prepare CUSTOMER_PAYMENT_RECEIVED']],
    'Prepare CUSTOMER_PAYMENT_RECEIVED': [['POST webhook audit']],
    'Switch HTTP class': [['Already ingested — stop'], ['400 No Retry'], ['401/403 Alert'], ['401/403 Alert'], ['Backoff Wait'], ['Backoff Wait']],
    'Backoff Wait': [['HTTP POST ingest']],
  })));
}

ingestWorkflow(
  'TG-ACC-12',
  'TG-ACC-12 POS Settlement',
  '/api/n8n/pos-transactions',
  `const j = $json;
if (j.pullFromProvider === true) throw Object.assign(new Error('VALIDATION_NO_RETRY'), { noRetry: true, code: 'POS_PROVIDER_NOT_CONFIGURED' });
if (!j.transactionId) throw Object.assign(new Error('VALIDATION_NO_RETRY'), { noRetry: true, code: 'INVALID_QUERY' });
const body = { providerId: j.providerId || 'default', transactionId: j.transactionId, reservationId: j.reservationId, grossMinor: j.grossMinor, commissionMinor: j.commissionMinor, netMinor: j.netMinor, currency: j.currency || 'TRY', customerPaidAt: j.customerPaidAt, settlementDate: j.settlementDate };
return [{ json: { idempotencyKey: 'pos:' + j.transactionId, body } }];`,
  `${CONTRACT}\nPOST /api/n8n/pos-transactions\npullFromProvider:true YASAK. POS URL yok. Unique transactionId Core'da.`,
);

function lucaGateCode() {
  return `const base = String($env.LUCA_API_BASE_URL || '').trim();
const key = String($env.LUCA_API_KEY || '').trim();
return [{ json: { lucaConfigured: Boolean(base && key), lucaHttpCalled: false, transport: 'n8n' } }];`;
}

// 13 Luca export
{
  const p = 'a13';
  const nodes = [
    sticky(`${p}-note`, 'Luca URL yok', `${CONTRACT}\nGET /accounting/pending → POST /accounting/export\nLuca HTTP yalnız n8n credential ile.\nLUCA_API_* boşsa claim ETME (N8N_QUEUE’da kilitlenmesin).\nHesap kodu değiştirme; payload pass-through.`, [-760, -280], 560, 280, 3),
    schedule(`${p}-cron`, 'Schedule', [-540, 40], 1),
    manual(`${p}-manual`, 'Manual', [-540, 200]),
    httpGet(`${p}-http`, 'HTTP Request TicketGo', '/api/n8n/accounting/pending', [-180, 80]),
    ifLt(`${p}-ok`, 'IF HTTP 2xx', '={{$json.statusCode}}', 300, [140, 20]),
    code(`${p}-router`, 'HTTP Status Router', RETRY, [140, 260]),
    switchHttp(`${p}-sw`, 'Switch HTTP class', [440, 260]),
    wait(`${p}-wait`, 'Backoff Wait', [740, 420]),
    httpGet(`${p}-retry`, 'HTTP Request Retry', '/api/n8n/accounting/pending', [980, 420]),
    noop(`${p}-dup`, '409 Duplicate', [740, 140]),
    noop(`${p}-noret`, '400 No Retry', [740, 220]),
    noop(`${p}-sec`, '401/403 Alert', [740, 300]),
    split(`${p}-split`, 'Split Records', 'body.data.exports', [440, 20]),
    code(`${p}-gate`, 'Luca credential gate', lucaGateCode(), [740, 20]),
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
          conditions: [{ id: 'l', leftValue: '={{$json.lucaConfigured}}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
          combinator: 'and',
        },
      },
      id: `${p}-if`,
      name: 'IF Luca configured',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [1040, 20],
    },
    noop(`${p}-skip`, 'Luca NOT_CONFIGURED — no claim', [1340, 120]),
    code(`${p}-claim`, 'Prepare export claim', `const item = $('Split Records').item.json;
const body = item.body || {};
const payload = body.payload;
return [{ json: { idempotencyKey: body.idempotencyKey, body: { idempotencyKey: body.idempotencyKey, entityId: body.entityId, entityType: body.entityType || 'INVOICE', payload } } }];`, [1340, -40]),
    httpPost(`${p}-exp`, 'POST accounting/export', '/api/n8n/accounting/export', '={{JSON.stringify($json.body)}}', '={{$json.idempotencyKey}}', [1640, -40]),
    code(`${p}-exr`, 'Export claim router', RETRY, [1940, -40]),
    sticky(`${p}-lucahttp`, 'Luca HTTP (disabled until URL exists)', 'HANDOFF: no Luca URL from this app.\nNode hazır; active etme.\nBody = pending item.body pass-through.', [1640, 120], 420, 180, 2),
    {
      parameters: {
        method: 'POST',
        url: '={{$env.LUCA_API_BASE_URL}}',
        sendHeaders: true,
        headerParameters: { parameters: [{ name: 'Authorization', value: '=Bearer {{$env.LUCA_API_KEY}}' }, { name: 'Content-Type', value: 'application/json' }] },
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{JSON.stringify($json.body)}}',
        options: { timeout: 30000, response: { response: { fullResponse: true, neverError: true } } },
      },
      id: `${p}-luca`,
      name: 'HTTP Request Luca (inactive)',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [1940, 160],
      disabled: true,
      retryOnFail: false,
    },
  ];
  const connections = {
    Schedule: [['HTTP Request TicketGo']],
    Manual: [['HTTP Request TicketGo']],
    'HTTP Request TicketGo': [['IF HTTP 2xx']],
    'IF HTTP 2xx': [['Split Records'], ['HTTP Status Router']],
    'HTTP Status Router': [['Switch HTTP class']],
    'Switch HTTP class': httpClassOutputs(),
    'Backoff Wait': [['HTTP Request Retry']],
    'HTTP Request Retry': [['IF HTTP 2xx']],
    'Split Records': [['Luca credential gate']],
    'Luca credential gate': [['IF Luca configured']],
    'IF Luca configured': [['Prepare export claim'], ['Luca NOT_CONFIGURED — no claim']],
    'Prepare export claim': [['POST accounting/export']],
    'POST accounting/export': [['Export claim router']],
    'Export claim router': [['HTTP Request Luca (inactive)']],
  };
  save('TG-ACC-13', wf('TG-ACC-13', 'TG-ACC-13 Luca Accounting Export', nodes, C(connections)));
}

// 14 success
{
  const p = 'a14';
  const nodes = [
    sticky(`${p}-note`, 'SUCCESS callback', `${CONTRACT}\nPOST /api/n8n/accounting/result { idempotencyKey, result: SUCCESS }\nLuca çağrısı başarılı olmadan çalıştırma.`, [-740, -220], 520, 200, 4),
    manual(`${p}-manual`, 'Manual', [-540, 80]),
    code(`${p}-prep`, 'Prepare SUCCESS', `const key = $json.idempotencyKey;
if (!key) throw Object.assign(new Error('VALIDATION_NO_RETRY'), { noRetry: true, code: 'INVALID_QUERY' });
return [{ json: { idempotencyKey: 'luca-result-success:' + key, body: { idempotencyKey: key, result: 'SUCCESS' } } }];`, [-180, 80]),
    httpPost(`${p}-post`, 'POST accounting/result', '/api/n8n/accounting/result', '={{JSON.stringify($json.body)}}', '={{$json.idempotencyKey}}', [200, 80]),
    ifLt(`${p}-ok`, 'IF HTTP 2xx', '={{$json.statusCode}}', 300, [540, 0]),
    code(`${p}-rr`, 'HTTP Status Router', RETRY, [540, 200]),
    switchHttp(`${p}-sw`, 'Switch HTTP class', [820, 80]),
    wait(`${p}-wait`, 'Backoff Wait', [1120, 360]),
    noop(`${p}-dup`, '409 Duplicate', [1120, -40]),
    noop(`${p}-noret`, '400 No Retry', [1120, 40]),
    noop(`${p}-sec`, '401/403 Alert', [1120, 120]),
    noop(`${p}-lucaok`, 'Core LUCA_EXPORT_SUCCESS', [1120, 220]),
  ];
  save('TG-ACC-14', wf('TG-ACC-14', 'TG-ACC-14 Luca Export Success', nodes, C({
    Manual: [['Prepare SUCCESS']],
    'Prepare SUCCESS': [['POST accounting/result']],
    'POST accounting/result': [['IF HTTP 2xx']],
    'IF HTTP 2xx': [['Core LUCA_EXPORT_SUCCESS'], ['HTTP Status Router']],
    'HTTP Status Router': [['Switch HTTP class']],
    'Switch HTTP class': [['409 Duplicate'], ['400 No Retry'], ['401/403 Alert'], ['401/403 Alert'], ['Backoff Wait'], ['Backoff Wait']],
    'Backoff Wait': [['POST accounting/result']],
  })));
}

// 15 retry
{
  const p = 'a15';
  const nodes = [
    sticky(`${p}-note`, 'RETRY Core’da', 'GET pending zaten RETRY satırlarını döner.\nretryCount Core maxRetries=3.\nn8n Luca hesap kodu değiştirmez.\nFAILED: POST result FAILED', [-740, -260], 500, 220, 4),
    ...pollShell(p, '/api/n8n/accounting/pending', `${CONTRACT}\nGET /api/n8n/accounting/pending`).slice(1),
    split(`${p}-split`, 'Split Records', 'body.data.exports', [440, 20]),
    code(`${p}-gate`, 'Luca credential gate', lucaGateCode(), [740, 20]),
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
          conditions: [{ id: 'l', leftValue: '={{$json.lucaConfigured}}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
          combinator: 'and',
        },
      },
      id: `${p}-if`,
      name: 'IF Luca configured',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [1040, 20],
    },
    noop(`${p}-skip`, 'Luca NOT_CONFIGURED', [1340, 120]),
    noop(`${p}-ready`, 'Luca ready — do not POST FAILED until Luca actually fails', [1340, -40]),
    httpPost(`${p}-post`, 'POST accounting/result FAILED', '/api/n8n/accounting/result', '={{JSON.stringify($json.body)}}', '={{$json.idempotencyKey}}', [1680, -40]),
  ];
  const connections = {
    ...pollConns('Split Records'),
    'Split Records': [['Luca credential gate']],
    'Luca credential gate': [['IF Luca configured']],
    'IF Luca configured': [['Luca ready — do not POST FAILED until Luca actually fails'], ['Luca NOT_CONFIGURED']],
  };
  save('TG-ACC-15', wf('TG-ACC-15', 'TG-ACC-15 Luca Export Retry', nodes, C(connections)));
}

// 16 deadline alert — compare API fields only
{
  const p = 'a16';
  const nodes = [
    ...pollShell(p, '/api/n8n/invoices/due', `${CONTRACT}\nGET /api/n8n/invoices/due\nlegalDeadline Core alanı. +2 hesaplama yok.`),
    split(`${p}-split`, 'Split Records', 'body.data.invoices', [440, 20]),
    code(`${p}-cmp`, 'Compare legalDeadline to asOf', `const inv = $json;
const asOf = new Date().toISOString().slice(0, 10);
const due = inv.legalDeadline;
return [{ json: { overdue: Boolean(due && due <= asOf), asOf, invoiceId: inv.id, legalDeadline: due, invoiceTargetDate: inv.invoiceTargetDate, reservationNo: inv.reservationNo } }];`, [740, 20]),
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
          conditions: [{ id: 'o', leftValue: '={{$json.overdue}}', rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
          combinator: 'and',
        },
      },
      id: `${p}-if`,
      name: 'IF legalDeadline <= asOf',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [1080, 20],
    },
    code(`${p}-prep`, 'Prepare INVOICE_DUE', `const j = $json;
return [{ json: { idempotencyKey: 'deadline:' + j.invoiceId + ':' + j.asOf, body: { event: 'INVOICE_DUE', payload: { invoiceId: j.invoiceId, reservationNo: j.reservationNo, invoiceTargetDate: j.invoiceTargetDate, legalDeadline: j.legalDeadline } } } }];`, [1380, -40]),
    httpPost(`${p}-wh`, 'POST webhook audit', '/api/n8n/webhook', '={{JSON.stringify($json.body)}}', '={{$json.idempotencyKey}}', [1680, -40]),
    noop(`${p}-notdue`, 'Not overdue', [1380, 120]),
  ];
  const connections = {
    ...pollConns('Split Records'),
    'Split Records': [['Compare legalDeadline to asOf']],
    'Compare legalDeadline to asOf': [['IF legalDeadline <= asOf']],
    'IF legalDeadline <= asOf': [['Prepare INVOICE_DUE'], ['Not overdue']],
    'Prepare INVOICE_DUE': [['POST webhook audit']],
  };
  save('TG-ACC-16', wf('TG-ACC-16', 'TG-ACC-16 Invoice Deadline Alert', nodes, C(connections)));
}

// 17 payment approval — no approval API
{
  const p = 'a17';
  const nodes = [
    sticky(`${p}-note`, 'Approval API yok', 'HANDOFF’ta payment-approve path yok.\nGET due → Wait (manuel) → TG-ACC-09 body.\nSahte onay endpoint yok.', [-740, -240], 500, 200, 3),
    ...pollShell(p, '/api/n8n/supplier-payments/due', `${CONTRACT}\nGET /api/n8n/supplier-payments/due`).slice(1),
    split(`${p}-split`, 'Split Records', 'body.data.payments', [440, 20]),
    {
      parameters: { resume: 'webhook', options: {} },
      id: `${p}-waitap`,
      name: 'Wait for human approval',
      type: 'n8n-nodes-base.wait',
      typeVersion: 1.1,
      position: [740, 20],
    },
    noop(`${p}-next`, 'On approve: run TG-ACC-09 with paymentId', [1080, 20]),
  ];
  const connections = { ...pollConns('Split Records'), 'Split Records': [['Wait for human approval']], 'Wait for human approval': [['On approve: run TG-ACC-09 with paymentId']] };
  save('TG-ACC-17', wf('TG-ACC-17', 'TG-ACC-17 Payment Approval', nodes, C(connections)));
}

// 18 daily summary — three documented GETs, no invented event
{
  const p = 'a18';
  const nodes = [
    sticky(`${p}-note`, 'Summary endpoint yok', 'HANDOFF’ta daily-summary path ve event adı yok.\nÜç GET birleştirilir. Yeni event POST edilmez.\nTutar toplanmaz / KDV hesaplanmaz; yalnız sayım.', [-740, -260], 540, 220, 3),
    schedule(`${p}-cron`, 'Schedule', [-540, 40], 24),
    manual(`${p}-manual`, 'Manual', [-540, 200]),
    httpGet(`${p}-inv`, 'GET invoices/due', '/api/n8n/invoices/due', [-180, -40]),
    httpGet(`${p}-exp`, 'GET accounting/pending', '/api/n8n/accounting/pending', [-180, 80]),
    httpGet(`${p}-pay`, 'GET supplier-payments/due', '/api/n8n/supplier-payments/due', [-180, 200]),
    {
      parameters: { mode: 'combine', combineBy: 'combineAll', numberInputs: 3, options: {} },
      id: `${p}-merge`,
      name: 'Merge GETs',
      type: 'n8n-nodes-base.merge',
      typeVersion: 3.1,
      position: [200, 80],
    },
    code(`${p}-sum`, 'Count-only snapshot', `const items = $input.all().map((i) => i.json);
function rows(item, key) {
  const body = item.body || item;
  const data = body.data || {};
  return Array.isArray(data[key]) ? data[key].length : 0;
}
const invoices = items.find((x) => x.body && x.body.data && x.body.data.invoices) || items[0] || {};
const exports = items.find((x) => x.body && x.body.data && x.body.data.exports) || items[1] || {};
const payments = items.find((x) => x.body && x.body.data && x.body.data.payments) || items[2] || {};
return [{ json: { asOf: new Date().toISOString().slice(0, 10), invoiceDueCount: rows(invoices, 'invoices'), exportPendingCount: rows(exports, 'exports'), supplierPaymentDueCount: rows(payments, 'payments') } }];`, [480, 80]),
    noop(`${p}-done`, 'Snapshot ready (no invented event)', [780, 80]),
  ];
  save('TG-ACC-18', wf('TG-ACC-18', 'TG-ACC-18 Daily Finance Summary', nodes, C({
    Schedule: [['GET invoices/due', 'GET accounting/pending', 'GET supplier-payments/due']],
    Manual: [['GET invoices/due', 'GET accounting/pending', 'GET supplier-payments/due']],
    'GET invoices/due': [[{ node: 'Merge GETs', index: 0 }]],
    'GET accounting/pending': [[{ node: 'Merge GETs', index: 1 }]],
    'GET supplier-payments/due': [[{ node: 'Merge GETs', index: 2 }]],
    'Merge GETs': [['Count-only snapshot']],
    'Count-only snapshot': [['Snapshot ready (no invented event)']],
  })));
}

// 99 error handler
{
  const p = 'a99';
  const nodes = [
    sticky(`${p}-note`, 'Global errors', `${CONTRACT}\nError Trigger. Sahte Slack/email URL yok.\n401/403 SECURITY_CREDENTIAL_ALERT.\nYeni TicketGo event adı yok.`, [-700, -240], 520, 220, 2),
    errorTrigger(`${p}-err`, 'Error Trigger', [-480, 80]),
    code(`${p}-cls`, 'Classify error', `const exec = $json;
const msg = String((exec.execution && exec.execution.error && exec.execution.error.message) || '');
const httpStatus = Number((exec.execution && exec.execution.error && exec.execution.error.httpStatus) || 0);
let kind = 'OTHER';
if (msg.includes('SECURITY_CREDENTIAL_ALERT') || httpStatus === 401 || httpStatus === 403) kind = 'SECURITY';
else if (msg.includes('VALIDATION_NO_RETRY') || httpStatus === 400) kind = 'VALIDATION';
else if (httpStatus === 429 || httpStatus >= 500) kind = 'RETRY_EXHAUSTED';
return [{ json: { kind, httpStatus, message: msg, workflowName: exec.workflow && exec.workflow.name } }];`, [-160, 80]),
    {
      parameters: {
        rules: {
          values: [
            { conditions: { combinator: 'and', conditions: [{ id: 's', leftValue: '={{$json.kind}}', rightValue: 'SECURITY', operator: { type: 'string', operation: 'equals' } }] }, renameOutput: true, outputKey: 'SECURITY' },
            { conditions: { combinator: 'and', conditions: [{ id: 'v', leftValue: '={{$json.kind}}', rightValue: 'VALIDATION', operator: { type: 'string', operation: 'equals' } }] }, renameOutput: true, outputKey: 'VALIDATION' },
            { conditions: { combinator: 'and', conditions: [{ id: 'r', leftValue: '={{$json.kind}}', rightValue: 'RETRY_EXHAUSTED', operator: { type: 'string', operation: 'equals' } }] }, renameOutput: true, outputKey: 'RETRY' },
          ],
        },
        options: { fallbackOutput: 'extra' },
      },
      id: `${p}-sw`,
      name: 'Switch error kind',
      type: 'n8n-nodes-base.switch',
      typeVersion: 3.2,
      position: [180, 80],
    },
    noop(`${p}-sec`, '401/403 credential alert (wire notifier later)', [500, -40]),
    noop(`${p}-val`, '400 validation — do not retry', [500, 80]),
    noop(`${p}-retry`, '429/5xx exhausted', [500, 200]),
    noop(`${p}-oth`, 'Other', [500, 320]),
  ];
  save('TG-ACC-99', wf('TG-ACC-99', 'TG-ACC-99 Global Error Handler', nodes, C({
    'Error Trigger': [['Classify error']],
    'Classify error': [['Switch error kind']],
    'Switch error kind': [['401/403 credential alert (wire notifier later)'], ['400 validation — do not retry'], ['429/5xx exhausted'], ['Other']],
  })));
}

const EXPECTED = [
  'TG-ACC-01.json', 'TG-ACC-02.json', 'TG-ACC-03.json', 'TG-ACC-04.json', 'TG-ACC-05.json',
  'TG-ACC-06.json', 'TG-ACC-07.json', 'TG-ACC-08.json', 'TG-ACC-09.json', 'TG-ACC-10.json',
  'TG-ACC-11.json', 'TG-ACC-12.json', 'TG-ACC-13.json', 'TG-ACC-14.json', 'TG-ACC-15.json',
  'TG-ACC-16.json', 'TG-ACC-17.json', 'TG-ACC-18.json', 'TG-ACC-99.json',
];

for (const name of readdirSync(outDir)) {
  if (!name.endsWith('.json')) continue;
  if (!EXPECTED.includes(name)) unlinkSync(join(outDir, name));
}

const parseFailures = [];
for (const name of EXPECTED) {
  const full = join(outDir, name);
  try {
    const parsed = JSON.parse(readFileSync(full, 'utf8'));
    const code = name.replace('.json', '');
    const errors = validateWorkflow(parsed, code);
    if (errors.length) parseFailures.push(`${name}: ${errors.join('; ')}`);
  } catch (error) {
    parseFailures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (parseFailures.length) {
  console.error('VALIDATION FAILED');
  for (const row of parseFailures) console.error('-', row);
  process.exit(1);
}

console.log(`Wrote ${written.length} workflows to ${outDir}`);
console.log(written.join('\n'));
console.log(`Re-parsed ${EXPECTED.length} files: OK`);

