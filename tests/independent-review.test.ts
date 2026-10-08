import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import ts from 'typescript';
import { createMemberAuth } from '../backend/src/security/memberAuth.ts';

// Execute actual route declarations without importing index (no startup/live .env drivers).
const text = fs.readFileSync(new URL('../backend/src/index.ts', import.meta.url), 'utf8');
const source = ts.createSourceFile('index.ts', text, ts.ScriptTarget.Latest, true);
const quiet = { log() {}, warn() {}, error() {} };
const cookie = 'wd_member_session=' + 'a'.repeat(64);
function routes(extra: any = {}) {
  const handlers = new Map<string, any[]>();
  const order: any = { id: 'victim-id', invoiceNumber: 'VICTIM-INVOICE', userId: 'victim', guestAccessToken: 'fixture-guest-token-long', paymentStatus: 'PAID', targetDestination: '08123456789' };
  const memberDb: any = { collection: (name: string) => ({ createIndex: async () => {}, findOne: async (q: any) => name === 'member_sessions' ? (q._id === crypto.createHash('sha256').update('a'.repeat(64)).digest('hex') ? { userId: 'victim' } : null) : { id: 'victim' } }) };
  const context: any = { requireAdmin: (_req: any, _res: any, next: any) => next(), console: quiet, crypto, fetch: async () => { throw new Error('external network forbidden'); }, verifyAdminSession: () => false, sameSecret: (a: string, b: string) => a === b,
    memberAuth: createMemberAuth(async () => memberDb),
    mongoDbService: { getClient: async () => ({ db: () => ({ collection: () => ({ findOne: async () => order.userId ? { userId: order.userId } : null }) }) }), getPrimaryDbName: () => 'fixture', getTransCollectionName: () => 'orders' },
    prisma: { order: { findUnique: async () => ({ ...order }) } },
    qiospayService: { checkAndReconcileOrderStatus: async () => { throw new Error('unexpected provider'); } },
    app: { get: (p: any, ...f: any[]) => handlers.set('get ' + p, f), post: (p: any, ...f: any[]) => handlers.set('post ' + p, f) }, ...extra };
  for (const node of source.statements) {
    const code = node.getText(source);
    if (code.startsWith('async function canReadOrder(') || code.startsWith('async function readQiospayMutasi(') || /^app\.(get|post)\('\/api\/(orders'|orders\/track'|qiospay\/(mutasi|sync)')/.test(code)) vm.runInNewContext(ts.transpile(code, { target: ts.ScriptTarget.ES2022 }), context);
  }
  async function dispatch(method: string, path: string, req: any) {
    let status = 200, body: any; const res: any = { status(n: number) { status = n; return res; }, json(b: any) { body = b; return res; }, setHeader() {} };
    const f = handlers.get(method + ' ' + path); assert.ok(f, path);
    const next = async (i: number): Promise<any> => f[i]?.(req, res, () => next(i + 1));
    await next(0); return { status, body };
  }
  return { dispatch, order, context };
}
test('saved Qiospay endpoints reject missing or partial DB credentials before provider calls', async () => {
  for (const settings of [{}, { qiospayMerchantCode: 'saved' }, { qiospayApiKey: 'saved-key' }, { qiospayMerchantCode: ' ', qiospayApiKey: 'saved-key' }]) {
    let calls = 0;
    const h = routes({ mongoDbService: { getSettingsFromDatabase: async () => settings }, qiospayService: { getMutasi: async () => { calls++; return { statusCode: 200, data: {} }; }, syncAllPendingOrders: async () => { calls++; return { success: true }; } } });
    for (const [method, url] of [['get', '/api/qiospay/mutasi'], ['post', '/api/qiospay/sync']]) {
      const r = await h.dispatch(method, url, { headers: {}, query: {} });
      assert.equal(r.status, 422, JSON.stringify(settings) + url);
      assert.equal(r.body.diagnosticCode, 'QIOSPAY_CONFIG_INCOMPLETE');
      assert.equal(calls, 0);
    }
  }
});

test('strict DB-only Qiospay service never falls back to stale runtime credentials', async () => {
  const s = ts.createSourceFile('qiospay.ts', fs.readFileSync(new URL('../backend/src/services/qiospay.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
  let method = ''; for (const n of s.statements) if (ts.isClassDeclaration(n)) for (const m of n.members) if (m.name?.getText(s) === 'getMutasi') method = m.getText(s);
  const ctx: any = { QIOSPAY_CONFIG: { MERCHANT_CODE: 'stale-env', API_KEY: 'stale-key' }, mutasiCache: new Map(), MUTASI_CACHE_TTL_MS: 1000, Date, AbortSignal };
  const service = vm.runInNewContext(ts.transpile('(new class { ' + method + ' })', { target: ts.ScriptTarget.ES2022 }), ctx);
  for (const pair of [[undefined, undefined], ['saved', undefined], [undefined, 'saved-key']]) {
    let requests = 0;
    const r = await service.getMutasi(...pair, async () => { requests++; return { ok: true, json: async () => ({ status: 'success', data: [] }) }; }, true, true);
    assert.equal(requests, 0); assert.equal(r.statusCode, 503);
  }
  let requests = 0;
  await service.getMutasi(undefined, undefined, async () => { requests++; return { ok: true, json: async () => ({ status: 'success', data: [] }) }; }, true);
  assert.equal(requests, 1, 'legacy callers retain deliberate runtime fallback');
});

test('order creation dispatch rejects both member ID and invoice collisions before payment or writes', async () => {
  for (const field of ['id', 'invoiceNumber']) for (const store of ['mongo', 'prisma', 'supabase']) {
    let payments = 0, writes = 0;
    const victim = { id: 'victim-id', invoiceNumber: 'VICTIM-INVOICE', userId: 'victim' };
    const h = routes({ memberAuth: { getMember: async (req: any) => req.headers.cookie === cookie ? { id: 'victim' } : { id: 'attacker' } },
      mongoDbService: { getAllState: async () => ({ orders: store === 'mongo' ? [victim] : [] }), createOrder: async () => { writes++; return { success: true }; }, saveOrder: async () => { writes++; return { success: true }; } },
      prisma: { product: { findUnique: async () => ({ id: 'fixture-product', sellingPrice: 10000 }) }, order: { findFirst: async () => store === 'prisma' ? victim : null, create: async () => { writes++; } } },
      supabaseService: { getOrder: async () => store === 'supabase' ? victim : null, saveOrder: async () => { writes++; return true; } },
      createPaymentSession: async () => { payments++; return { gateway: 'QIOSPAY' }; }, pushNotificationService: { sendNewOrderNotification: async () => { writes++; } } });
    const r = await h.dispatch('post', '/api/orders', { body: { id: field === 'id' ? victim.id : 'new-id', invoiceNumber: field === 'invoiceNumber' ? victim.invoiceNumber : 'NEW-INVOICE', productId: 'fixture-product', targetDestination: '0800000000' }, headers: { cookie: 'wd_member_session=' + 'b'.repeat(64) }, query: {} });
    assert.equal(r.status, 409, store + ':' + field); assert.equal(payments, 0); assert.equal(writes, 0); assert.equal(victim.userId, 'victim');
  }
});

function mongoFixture() {
  const s = ts.createSourceFile('mongo.ts', fs.readFileSync(new URL('../backend/src/services/mongodbService.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
  const cls = s.statements.find(ts.isClassDeclaration)!;
  const Service = vm.runInNewContext(ts.transpile('(' + cls.getText(s).replace('export class', 'class').replaceAll('import.meta.url', "'fixture.invalid'") + ')', { target: ts.ScriptTarget.ES2022 }), { console: quiet });
  const service = new Service(); const local: any = { orders: [] }; const rows: Record<string, any[]> = { transactions: [], orders: [] }; const indexes: any[] = [];
  service.loadLocalFile = () => local; service.saveLocalFile = () => {};
  service.getPrimaryDbName = () => 'fixture'; service.getTransCollectionName = () => 'transactions';
  const match = (o: any, q: any): boolean => q.$or ? q.$or.some((c: any) => match(o, c)) : Object.entries(q).every(([k, v]) => o[k] === v);
  service.getClient = async () => ({ db: () => ({ collection: (name: string) => ({
    createIndex: async (keys: any, options: any) => { indexes.push({ name, keys, options }); },
    findOne: async (q: any) => rows[name].find(o => match(o, q)) || null,
    insertOne: async (o: any) => { if (rows[name].some(x => x.id === o.id || x.invoiceNumber === o.invoiceNumber)) throw Object.assign(new Error('duplicate'), { code: 11000 }); rows[name].push({ ...o }); return { acknowledged: true }; },
    updateOne: async (q: any, update: any, opts: any) => { let o = rows[name].find(x => match(x, q)); if (!o && opts?.upsert) { o = { ...(update.$setOnInsert || {}) }; rows[name].push(o); } if (o) Object.assign(o, update.$set); return { matchedCount: o ? 1 : 0 }; }
  }) }) });
  return { service, local, rows, indexes };
}
test('Mongo creation is atomic insert-only across canonical and mirror identity collisions', async () => {
  const h = mongoFixture(); assert.equal(typeof h.service.createOrder, 'function');
  const order = { id: 'new-id', invoiceNumber: 'NEW-INVOICE', userId: 'owner' };
  const results = await Promise.all([h.service.createOrder(order), h.service.createOrder({ ...order, userId: 'attacker' })]);
  assert.equal(results.filter(r => r.success).length, 1); assert.equal(results.filter(r => r.conflict).length, 1);
  assert.equal(h.rows.transactions[0].userId, 'owner');
  for (const name of ['transactions', 'orders']) for (const key of ['id', 'invoiceNumber']) assert.ok(h.indexes.some(i => i.name === name && i.keys[key] === 1 && i.options.unique));
  h.rows.orders.push({ id: 'mirror-id', invoiceNumber: 'MIRROR-INVOICE', userId: 'victim' });
  for (const candidate of [{ id: 'mirror-id', invoiceNumber: 'OTHER' }, { id: 'other', invoiceNumber: 'MIRROR-INVOICE' }]) assert.equal((await h.service.createOrder(candidate)).conflict, true);
});
test('Mongo status persistence cannot overwrite established member or guest ownership', async () => {
  for (const owner of ['victim', undefined]) {
    const h = mongoFixture(); const original = { id: 'victim-id', invoiceNumber: 'VICTIM-INVOICE', ...(owner ? { userId: owner } : {}), guestAccessToken: 'original-token', paymentStatus: 'PENDING' };
    h.local.orders.push({ ...original }); for (const key of Object.keys(h.rows)) h.rows[key].push({ ...original });
    await h.service.saveOrder({ ...original, userId: 'attacker', guestAccessToken: 'attacker-token', paymentStatus: 'PAID' });
    for (const record of [h.local.orders[0], h.rows.transactions[0], h.rows.orders[0]]) { assert.equal(record.userId, owner); assert.equal(record.guestAccessToken, 'original-token'); assert.equal(record.paymentStatus, 'PAID'); }
  }
});

test('Prisma duplicate-key errors do not fall through into an overwriting file create', async () => {
  const text = fs.readFileSync(new URL('../backend/src/db/client.ts', import.meta.url), 'utf8');
  const src = ts.createSourceFile('client.ts', text, ts.ScriptTarget.Latest, true);
  const statement = src.statements.find(n => n.getText(src).startsWith('export const db:'))!;
  let writes = 0;
  const ctx: any = { rawPrisma: { order: { create: async () => { throw Object.assign(new Error('duplicate'), { code: 'P2002' }); } } }, fallbackStore: { order: { create: async () => { writes++; } } }, isPgAvailable: true };
  vm.runInNewContext(ts.transpile(statement.getText(src).replace('export const db:', 'var db:'), { target: ts.ScriptTarget.ES2022 }), ctx);
  await assert.rejects(ctx.db.order.create({ data: { id: 'victim' } }), { code: 'P2002' }); assert.equal(writes, 0);
});

test('Supabase creation uses insert, never upsert or fallback success on duplicate', async () => {
  const s = ts.createSourceFile('supa.ts', fs.readFileSync(new URL('../backend/src/services/supabaseService.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
  let method = ''; for (const n of s.statements) if (ts.isClassDeclaration(n)) for (const m of n.members) if (m.name?.getText(s) === 'saveOrder') method = m.getText(s);
  const service = vm.runInNewContext(ts.transpile('(new class { ' + method + ' })', { target: ts.ScriptTarget.ES2022 }), { console: quiet });
  let inserts = 0, upserts = 0, localWrites = 0;
  service.loadLocalFile = () => ({ orders: [{ id: 'victim', invoiceNumber: 'VICTIM', userId: 'victim' }] }); service.saveLocalFile = () => { localWrites++; };
  service.getClient = () => ({ from: () => ({ insert: async () => { inserts++; return { error: { code: '23505', message: 'duplicate' } }; }, upsert: async () => { upserts++; return { error: null }; } }) });
  await assert.rejects(service.saveOrder({ id: 'victim', invoiceNumber: 'VICTIM', userId: 'attacker' }, true), { code: '23505' });
  assert.equal(inserts, 1); assert.equal(upserts, 0); assert.equal(localWrites, 0);
});

test('file-backed Prisma creation rejects an existing ID or invoice without replacing ownership', async () => {
  const text = fs.readFileSync(new URL('../backend/src/db/client.ts', import.meta.url), 'utf8'); const src = ts.createSourceFile('client.ts', text, ts.ScriptTarget.Latest, true);
  const statement = src.statements.find(n => n.getText(src).startsWith('const fallbackStore ='))!;
  for (const data of [{ id: 'victim-id', invoiceNumber: 'NEW' }, { id: 'new-id', invoiceNumber: 'VICTIM-INVOICE' }]) {
    const victim = { id: 'victim-id', invoiceNumber: 'VICTIM-INVOICE', userId: 'victim' }; let writes = 0;
    const ctx: any = { inMemoryState: { orders: { 'victim-id': victim } }, saveFileDb: () => { writes++; } };
    vm.runInNewContext(ts.transpile(statement.getText(src).replace('const fallbackStore =', 'var fallbackStore ='), { target: ts.ScriptTarget.ES2022 }), ctx);
    await assert.rejects(ctx.fallbackStore.order.create({ data: { ...data, userId: 'attacker' } }), { code: 'P2002' });
    assert.equal(writes, 0); assert.equal(victim.userId, 'victim');
  }
});

test('concurrent creation dispatch permits only one payment and keeps winning member ownership', async () => {
  for (const collision of ['id', 'invoiceNumber']) {
    const mongo = mongoFixture(); let payments = 0; const prismaRows: any[] = [];
    mongo.service.getAllState = async () => ({ orders: [] });
    const h = routes({ mongoDbService: mongo.service,
      memberAuth: { getMember: async (req: any) => ({ id: req.headers.cookie === cookie ? 'victim' : 'attacker' }) },
      prisma: { product: { findUnique: async () => ({ id: 'fixture-product', sellingPrice: 10000 }) }, order: { findFirst: async () => null, create: async ({ data }: any) => { prismaRows.push(data); }, update: async () => ({}) } },
      supabaseService: { getOrder: async () => null, saveOrder: async () => true },
      createPaymentSession: async () => { payments++; return { gateway: 'QIOSPAY', token: 'fixture-token' }; }, pushNotificationService: { sendNewOrderNotification: async () => {} } });
    const request = (id: string, invoiceNumber: string, session: string) => ({ body: { id, invoiceNumber, productId: 'fixture-product', targetDestination: '0800000000' }, headers: { cookie: session }, query: {} });
    const first = request('new-id', 'NEW-INVOICE', cookie);
    const second = request(collision === 'id' ? 'new-id' : 'other-id', collision === 'invoiceNumber' ? 'NEW-INVOICE' : 'OTHER-INVOICE', 'wd_member_session=' + 'b'.repeat(64));
    const results = await Promise.all([h.dispatch('post', '/api/orders', first), h.dispatch('post', '/api/orders', second)]);
    assert.deepEqual(results.map(r => r.status).sort(), [201, 409]); assert.equal(payments, 1); assert.equal(prismaRows.length, 1);
    assert.equal(mongo.rows.transactions[0].userId, 'victim');
    assert.equal(mongo.rows.transactions[0].guestAccessToken, results.find(r => r.status === 201)!.body.data.guestAccessToken);
    assert.equal(prismaRows[0].deliveryMethod, results.find(r => r.status === 201)!.body.data.deliveryMethod, 'reservation preserves existing delivery metadata');
    assert.equal(prismaRows[0].promoCode, results.find(r => r.status === 201)!.body.data.promoCode);
    assert.equal((await h.dispatch('post', '/api/orders', first)).status, 409, 'even owner retries cannot recreate a reserved identity');
    assert.equal(payments, 1);
  }
});
test('creation dispatch fails closed before payments when reservation database is unavailable', async () => {
  let payments = 0;
  const h = routes({ mongoDbService: { getAllState: async () => ({ orders: [] }), createOrder: async () => ({ success: false }) },
    prisma: { product: { findUnique: async () => null }, order: { findFirst: async () => null } }, supabaseService: { getOrder: async () => null },
    createPaymentSession: async () => { payments++; } });
  assert.equal((await h.dispatch('post', '/api/orders', { body: { productId: 'fixture-product', targetDestination: '0800000000' }, headers: {}, query: {} })).status, 503);
  assert.equal(payments, 0);
});

test('tracking dispatch accepts member session alone and guest header, never phone alone', async () => {
  const h = routes();
  assert.equal((await h.dispatch('get', '/api/orders/track', { query: { invoice: 'VICTIM-INVOICE' }, headers: { cookie } })).status, 200);
  h.order.userId = undefined;
  assert.equal((await h.dispatch('get', '/api/orders/track', { query: { invoice: 'VICTIM-INVOICE' }, headers: { 'x-guest-token': h.order.guestAccessToken } })).status, 200);
  assert.equal((await h.dispatch('get', '/api/orders/track', { query: { invoice: 'VICTIM-INVOICE', phone: '08123456789' }, headers: {} })).status, 403);
  assert.equal((await h.dispatch('get', '/api/orders/track', { query: { invoice: 'VICTIM-INVOICE' }, headers: { 'x-guest-token': 'wrong-token-long' } })).status, 403);
});
