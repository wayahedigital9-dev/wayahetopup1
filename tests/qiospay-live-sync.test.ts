import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import ts from 'typescript';
const sandbox = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'qiospay-live-'));
process.chdir(sandbox);
const { qiospayService } = await import('../backend/src/services/qiospay.ts');
// Config modules resolve their own .env: isolate every persistence/notification seam.
const { mongoDbService } = await import('../backend/src/services/mongodbService.ts');
const { supabaseService } = await import('../backend/src/services/supabaseService.ts');
const { pushNotificationService } = await import('../backend/src/services/pushNotificationService.ts');
mongoDbService.getAllState = async () => ({ orders: [] });
mongoDbService.saveOrder = async () => ({ success: true });
supabaseService.saveOrder = async () => ({ success: true }) as any;
pushNotificationService.sendPaymentSuccessNotification = async () => ({ success: true }) as any;

test('live mutasi uses the saved merchant identifier literally and reports upstream auth rejection', async () => {
  const urls: string[] = [];
  const result = await qiospayService.getMutasi('QP12345', 'fixture-invalid-key', (async (url: string) => {
    urls.push(url); return new Response(JSON.stringify({ status: 'error', message: 'Invalid username or apikey' }), { status: 401 });
  }) as any, true);
  assert.equal(urls.length, 1);
  assert.ok(urls[0].includes('/QP12345/'));
  assert.equal(result.statusCode, 422, 'invalid saved credentials must reach browsers as an actionable 4xx, not a Cloudflare-replaced 502');
  assert.equal(result.data.upstream_status, 401);
  assert.equal(result.data.diagnosticCode, 'UPSTREAM_AUTH_REJECTED');
});

test('HTTP 200 provider error is not a successful empty mutation feed', async () => {
  const result = await qiospayService.getMutasi('fixture-code', 'fixture-key', (async () => new Response(JSON.stringify({ status: 'error', message: 'Invalid username or apikey' }))) as any, true);
  assert.equal(result.statusCode, 502);
});

test('nested provider result is normalized once for UI and reconciliation', async () => {
  const rows = [{ refid: 'fixture-ref', amount: '15.000', type: 'CR' }];
  const result = await qiospayService.getMutasi('fixture-code', 'fixture-key', (async () => new Response(JSON.stringify({ status: 'success', data: { result: rows } }))) as any, true);
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.data.data, rows);
});

test('unexpected provider payload does not masquerade as an empty feed', async () => {
  const result = await qiospayService.getMutasi('fixture-code', 'fixture-key', (async () => new Response(JSON.stringify({ unexpected: 'payload' }))) as any, true);
  assert.equal(result.statusCode, 502);
});

test('a verified provider reference cannot credit or fulfill another pending order', async () => {
  let writes = 0;
  const prisma: any = { qiospayEvent: { findUnique: async () => ({ verificationStatus: 'verified', nmid: 'fixture-nmid', refid: 'fixture-ref', amount: 15000 }) }, order: { findFirst: async () => ({ id: 'fixture-next-order', paymentStatus: 'PENDING', totalAmount: 15000 }), findMany: async () => [] }, $transaction: async () => { writes++; throw new Error('must not credit'); } };
  await qiospayService.reconcileOrderForEvent(prisma, { nmid: 'fixture-nmid', refid: 'fixture-ref', amount: 15000, receivedAt: new Date() }, { fulfillOrder: async () => { writes++; } });
  assert.equal(writes, 0);
});

test('already credited Mongo reference cannot be reused when Prisma event storage is offline', async () => {
  let transactions = 0;
  mongoDbService.getAllState = async () => ({ orders: [{ id: 'fixture-paid', paymentStatus: 'PAID', qiospayNmid: 'fixture-nmid', qiospayRefid: 'fixture-ref' }] });
  const prisma: any = { qiospayEvent: { findUnique: async () => { throw new Error('fixture event store offline'); } }, order: { findFirst: async () => ({ id: 'fixture-new', paymentStatus: 'PENDING', totalAmount: 15000 }), findMany: async () => [] }, $transaction: async () => { transactions++; throw new Error('must not credit'); } };
  try { await qiospayService.reconcileOrderForEvent(prisma, { nmid: 'fixture-nmid', refid: 'fixture-ref', amount: 15000, receivedAt: new Date() }); assert.equal(transactions, 0); }
  finally { mongoDbService.getAllState = async () => ({ orders: [] }); }
});

test('simultaneous reconciliation calls credit and fulfill a reference only once', async () => {
  let fulfilled = 0; let updates = 0;
  let order: any = { id: 'fixture-concurrent', invoiceNumber: 'fixture-invoice', paymentStatus: 'PENDING', fulfillmentStatus: 'NOT_STARTED', totalAmount: 15000 };
  let eventState: any = { verificationStatus: 'unverified' };
  const prisma: any = { qiospayEvent: { findUnique: async () => ({ ...eventState }), update: async ({ data }: any) => { eventState = { ...eventState, ...data }; } }, order: { findFirst: async () => ({ ...order }), findUnique: async () => ({ ...order }), findMany: async () => [{ ...order }], update: async ({ data }: any) => { updates++; order={...order,...data}; return { ...order }; } }, auditLog: { create: async () => ({}) }, $transaction: async (fn: any) => fn(prisma) };
  const fulfill = { fulfillOrder: async () => { fulfilled++; await new Promise(r => setImmediate(r)); order.fulfillmentStatus='SUCCESS'; } };
  const event = { nmid: 'fixture-nmid', refid: 'fixture-concurrent-ref', amount: 15000, receivedAt: new Date() };
  await Promise.all([qiospayService.reconcileOrderForEvent(prisma, event, fulfill),qiospayService.reconcileOrderForEvent(prisma, event, fulfill)]);
  assert.equal(updates, 1); assert.equal(fulfilled, 1);
});

test('mutation proxy requires admin session and loads provider credentials only from database', async () => {
  const text = fs.readFileSync(new URL('../backend/src/index.ts', import.meta.url), 'utf8');
  const source = ts.createSourceFile('index.ts', text, ts.ScriptTarget.Latest, true);
  let handlers: any[] = []; let calls = 0; let args: any[] = [];
  const context: any = { console, fetch: () => {}, crypto: {}, QIOSPAY_CONFIG: { MERCHANT_CODE: 'stale-env', API_KEY: 'stale-key' }, mongoDbService: { getSettingsFromDatabase: async () => ({ qiospayMerchantCode: 'database-merchant', qiospayApiKey: 'database-key' }) }, requireAdmin: (_req: any, res: any, next: any) => _req.authorized ? next() : res.status(401).json({ success: false }), qiospayService: { getMutasi: async (...a: any[]) => { calls++; args = a; return { statusCode: 200, data: { success: true, data: [] } }; } }, app: { get: (url: any, ...fns: any[]) => { if ([url].flat().includes('/api/qiospay/mutasi')) handlers = fns; } } };
  for (const node of source.statements) { const code = node.getText(source); if (code.startsWith("app.get('/api/qiospay/mutasi',") || code.startsWith('async function readQiospayMutasi(')) vm.runInNewContext(ts.transpile(code, { target: ts.ScriptTarget.ES2022 }), context); }
  let status = 200; const res: any = { status: (n: number) => { status=n; return res; }, setHeader() {}, json() {} };
  const req: any = { query: {}, headers: {}, authorized: false }; const dispatch = async (n: number): Promise<any> => handlers[n]?.(req, res, () => dispatch(n+1));
  await dispatch(0); assert.equal(status, 401); assert.equal(calls, 0);
  req.authorized = true; await dispatch(0); assert.equal(calls, 1); assert.deepEqual(args.slice(0,2), ['database-merchant','database-key']); assert.equal(args[3], true);
});

test('startup gateway hydration never posts settings or overwrites DB with environment defaults', async () => {
  let writes = 0;
  const context: any = { console, storage: { getSettings: () => ({}), saveSettings: async () => { writes++; }, hydrateSettingsFromBackend: async () => ({ paymentGatewayProvider: 'QIOSPAY' }) }, fetch: async () => new Response(JSON.stringify({ success: true, activeGateway: 'QIOSPAY', qiospay: { configured: true, merchantName: 'fixture' } })) };
  await vm.runInNewContext(initializer('../src/services/apiAdapter.ts', 'syncGatewayConfigFromBackend'), context)();
  assert.equal(writes, 0);
});

test('API client propagates settings rejection instead of returning fabricated success', async () => {
  const context: any = { storage: { saveSettings: async () => { throw new Error('fixture failure'); } }, fetch: async () => new Response(JSON.stringify({ success: false }), { status: 503 }) };
  await assert.rejects(vm.runInNewContext(initializer('../src/services/apiClient.ts', 'updateSettings'), context)({ siteName: 'Rejected' }));
});

function initializer(file: string, name: string) {
  const text = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); let found = '';
  function visit(node: ts.Node) { if ((ts.isVariableDeclaration(node) || ts.isMethodDeclaration(node)) && node.name?.getText(source) === name) found = ts.isVariableDeclaration(node) ? node.initializer!.getText(source) : `async function ${node.getText(source).replace(/^async\s*/, '')}`; ts.forEachChild(node, visit); }
  visit(source); return ts.transpile(`(${found})`, { target: ts.ScriptTarget.ES2022 });
}

test('dashboard never claims live sync succeeded when provider rejects request', async () => {
  const toasts: string[] = [];
  const context: any = { setQiospayMutasiLoading() {}, qiospayMerchantCode: '', qiospayApiKey: '', settings: {}, apiAdapter: { syncQiospayMutasi: async () => ({ success: false, syncedCount: 0, message: 'Rejected by provider' }) }, onShowToast: (_a: string, _b: string, kind: string) => toasts.push(kind), handleFetchQiospayMutasi: async () => {} };
  await vm.runInNewContext(initializer('../src/pages/AdminDashboard.tsx', 'handleSyncQiospayMutasi'), context)();
  assert.deepEqual(toasts, ['error']);
});

test('adapter refuses unavailable sync rather than fabricating local success or mutating local orders', async () => {
  let writes = 0; const requests: string[] = [];
  const context: any = { storage: { getSettings: () => ({}), getOrders: () => [], saveOrders: () => { writes++; } }, fetch: async (url: string) => { requests.push(url); return new Response(JSON.stringify({ success: false, message: 'Rejected' }), { status: 502 }); } };
  await assert.rejects(vm.runInNewContext(initializer('../src/services/apiAdapter.ts', 'syncQiospayMutasi'), context)());
  assert.equal(writes, 0);
  assert.deepEqual(requests, ['/api/qiospay/sync']);
});
