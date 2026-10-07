import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const fixture = {
  products: [{ id: 'p1', name: 'Public product', categoryId: 'wifi', sellingPrice: 5000, stock: 2, isActive: true,
    voucherCodes: ['PRIVATE-VOUCHER'], password: 'PRIVATE-PASSWORD',
    variants: [{ id: 'v1', name: 'Daily', sellingPrice: 5000, voucherCodes: ['PRIVATE-VARIANT'] }] }],
  categories: [{ id: 'wifi', name: 'WiFi', secret: 'PRIVATE-CATEGORY' }],
  catalogs: [{ id: 'c1', title: 'WiFi', targetTab: 'wifi', secret: 'PRIVATE-CATALOG' }],
  banners: [{ id: 'b1', title: 'Welcome', isActive: true }], promos: [{ id: 'promo1', code: 'WELCOME', isActive: true }],
  users: [{ id: 'u1', email: 'PRIVATE-EMAIL', password: 'PRIVATE-PASSWORD', passwordHash: 'PRIVATE-HASH' }],
  orders: [{ id: 'PRIVATE-ORDER' }], wifiVouchers: [{ code: 'PRIVATE-CODE' }], wifiBatches: [{ password: 'PRIVATE-BATCH' }],
  auditLogs: [{ details: 'PRIVATE-AUDIT' }], unknownFutureCollection: ['PRIVATE-FUTURE'],
  settings: { siteName: 'Public shop', logoUrl: '/logo.png', supportWhatsApp: 'public-contact',
    systemStatus: 'RUNNING', categoryStatus: { wifi: true, nested: { password: 'PRIVATE-NESTED' } },
    supabaseDbUrl: 'PRIVATE-DB', googleAuthSecret: 'PRIVATE-TOTP', adminPassword: 'PRIVATE-ADMIN',
    apiConfigs: { provider: { apiKey: 'PRIVATE-API' } }, unknownFutureSecret: 'PRIVATE-SECRET',
    discountPopup: { title: 'Sale', isEnabled: true, unknown: 'PRIVATE-POPUP' } },
};

// Evaluate actual route registrations, not either application entrypoint: importing
// those entrypoints initializes live persistence, network clients and workers.
async function route(file: string, method: string, endpoint: string, options: any = {}) {
  const text = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  let handlers: Function[] = [];
  let writes = 0;
  let queries = 0;
  let dto: any = {};
  try { dto = await import('../backend/src/security/stateDto.js'); } catch {}
  const context: any = {
    ...dto, console, process: { env: options.env || {} }, AbortSignal,
    CONSOLE_CONFIG: { ADMIN_TOKEN: 'exposed-fixture-token' },
    isAdminRequest: () => Boolean(options.token),
    requireAdmin: (_req: any, res: any) => res.status(401).json({ success: false }),
    mongoDbService: { getAllState: async () => structuredClone(fixture), runSampleQuery: async () => { queries++; return {}; } },
    supabaseService: { runSampleQuery: async () => { queries++; return {}; }, execSql: async () => { queries++; return {}; } },
    readDatabase: () => structuredClone(fixture), writeDatabase: () => { writes++; },
    fetch: async () => { if (options.upstream) return { ok: true, json: async () => ({ success: true, data: structuredClone(fixture) }) }; throw new Error('offline fixture'); },
    app: Object.fromEntries(['get', 'post', 'all'].map(verb => [verb, (paths: string | string[], ...fns: Function[]) => {
      if ((verb === method || verb === 'all') && [paths].flat().includes(endpoint)) handlers = fns;
    }])),
  };
  // Existing sanitizer dependencies and route code are executed in isolation.
  for (const stmt of source.statements) {
    const code = stmt.getText(source);
    if (code.startsWith('const SENSITIVE_SETTINGS_KEYS') || code.startsWith('function sanitizeSettingsForPublic')) {
      vm.runInNewContext(ts.transpile(code), context);
    }
    if (/^app\.(get|post|all)\(/.test(code) && code.includes(endpoint)) {
      vm.runInNewContext(ts.transpile(code, { target: ts.ScriptTarget.ES2022 }), context);
    }
  }
  assert.ok(handlers.length, `route registered: ${method} ${endpoint}`);
  const result: any = { status: 200, headers: {} };
  const res: any = { status: (n: number) => { result.status = n; return res; },
    setHeader: (k: string, v: string) => { result.headers[k] = v; }, json: (body: any) => { result.body = body; return res; } };
  const req = { body: { entity: 'settings', data: { siteName: 'attacker' }, sql: 'fixture query' }, headers: options.token ? { 'x-admin-token': 'exposed-fixture-token' } : {} };
  async function dispatch(i: number): Promise<any> { if (handlers[i]) return handlers[i](req, res, () => dispatch(i + 1)); }
  await dispatch(0);
  return { ...result, writes, queries };
}

test('future authenticated admin DTO strips password and authentication material without mutating persistence', async () => {
  const dto = await import('../backend/src/security/stateDto.js');
  assert.equal(typeof dto.toAdminState, 'function');
  const original = structuredClone(fixture);
  const admin = dto.toAdminState(fixture);
  assert.equal(admin.users[0].email, 'PRIVATE-EMAIL');
  assert.equal(admin.settings.siteName, 'Public shop');
  assert.equal('password' in admin.users[0], false);
  assert.equal('passwordHash' in admin.users[0], false);
  assert.equal('adminPassword' in admin.settings, false);
  assert.equal('googleAuthSecret' in admin.settings, false);
  assert.equal('password' in admin.products[0], false);
  assert.equal('password' in admin.wifiBatches[0], false);
  assert.deepEqual(fixture, original);
});

test('alternate state/settings mutations fail closed without any local writes', async () => {
  for (const endpoint of ['/api/sync/entity', '/sync/entity', '/api/sync/state', '/sync/state', '/api/settings/save', '/settings/save']) {
    for (const token of [false, true]) {
      const res = await route('../api/index.js', 'post', endpoint, { token });
      assert.equal(res.status, 503, endpoint);
      assert.equal(res.writes, 0);
      assert.equal(res.body.success, false);
    }
  }
});

test('generic database execution routes are gone regardless of static token', async () => {
  for (const file of ['../backend/src/index.ts', '../api/index.js']) {
    for (const endpoint of ['/api/supabase/exec-sql', '/api/supabase/run-query', '/api/mongodb/run-query']) {
      for (const token of [false, true]) {
        const res = await route(file, 'post', endpoint, { token });
        assert.equal(res.status, 410, `${file} ${endpoint}`);
        assert.equal(res.queries, 0);
      }
    }
  }
});

test('alternate API sanitizes both upstream and local fallback state', async () => {
  for (const endpoint of ['/api/sync/state', '/sync/state']) {
    for (const upstream of [false, true]) {
      const res = await route('../api/index.js', 'get', endpoint, { upstream, token: true });
      assert.equal(res.status, 200);
      assert.equal(JSON.stringify(res.body).includes('PRIVATE-'), false);
      assert.equal(res.body.data.products[0].variants[0].sellingPrice, 5000);
      assert.equal(res.body._sanitized, true);
      assert.match(res.headers['Cache-Control'], /no-store/);
    }
  }
});

test('backend public state is an explicit catalog DTO, even with the exposed static token', async () => {
  for (const token of [false, true]) {
    const res = await route('../backend/src/index.ts', 'get', '/api/sync/state', { token });
    assert.equal(res.status, 200);
    assert.equal(JSON.stringify(res.body).includes('PRIVATE-'), false, 'private fixture material must never reach public state');
    assert.deepEqual(Object.keys(res.body.data).sort(), ['banners', 'catalogs', 'categories', 'products', 'promos', 'settings']);
    assert.equal(res.body.data.products[0].name, 'Public product');
    assert.equal(res.body.data.products[0].variants[0].sellingPrice, 5000);
    assert.equal(res.body.data.settings.siteName, 'Public shop');
    assert.equal(res.body._sanitized, true);
    assert.match(res.headers['Cache-Control'], /no-store/);
  }
});
