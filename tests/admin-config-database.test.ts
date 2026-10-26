import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const sandbox = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'admin-config-db-'));
process.chdir(sandbox);
const { MongoDbService } = await import('../backend/src/services/mongodbService.ts');
const { mergeSettings } = await import('../backend/src/services/settingsMerge.ts');
const { storage } = await import('../src/services/storage.ts');
const file = path.join(sandbox, 'data/db.json');
const fixture = { siteName: 'Database', digiflazzProductionKey: 'fixture-df', apiConfigs: { premium: { apiKey: 'fixture-provider', apiUrl: 'https://fixture.invalid', marginValue: 12 }, smm: { apiKey: 'fixture-smm' } } };
function database(service: any, initial = fixture, fail = false) {
  let saved = structuredClone(initial);
  const cursor: any = { sort: () => cursor, limit: () => cursor, toArray: async () => [] };
  const collection = { find: () => cursor, findOne: async () => ({ data: structuredClone(saved) }), updateOne: async (_filter: any, update: any) => {
    if (fail) throw new Error('fixture DB unavailable');
    saved = structuredClone(update.$set.data); return { acknowledged: true };
  } };
  service.getClient = async () => ({ db: () => ({ collection: () => collection }) });
  return () => saved;
}

test('Mongo settings reads prefer database over conflicting local mirror', async () => {
  fs.writeFileSync(file, JSON.stringify({ settings: { ...fixture, siteName: 'Stale local', apiConfigs: {} } }));
  const service = new MongoDbService(); database(service);
  assert.deepEqual((await service.getAllState()).settings, fixture);
});

test('nested provider blank/masked keys and omitted providers survive a confirmed database save and new service', async () => {
  fs.writeFileSync(file, JSON.stringify({ settings: { siteName: 'Stale local' } }));
  const service = new MongoDbService(); const saved = database(service);
  assert.equal(await service.syncEntity('settings', { apiConfigs: { premium: { apiKey: '', marginValue: 19 } }, digiflazzProductionKey: '********' }), true);
  assert.deepEqual(saved(), { ...fixture, apiConfigs: { ...fixture.apiConfigs, premium: { ...fixture.apiConfigs.premium, marginValue: 19 } } });
  const fresh = new MongoDbService(); database(fresh, saved());
  assert.deepEqual((await fresh.getAllState()).settings, saved());
});

test('full-state settings writer also preserves nested provider keys and cannot bypass DB commit', async () => {
  const service = new MongoDbService(); const saved = database(service);
  await service.syncAllState({ settings: { apiConfigs: { premium: { apiKey: '', marginValue: 23 } } } });
  assert.equal(saved().apiConfigs.premium.apiKey, fixture.apiConfigs.premium.apiKey);
  assert.equal(saved().apiConfigs.smm.apiKey, fixture.apiConfigs.smm.apiKey);
});

test('database rejection never changes confirmed server mirror', async () => {
  fs.writeFileSync(file, JSON.stringify({ settings: fixture }));
  const before = fs.readFileSync(file, 'utf8');
  const service = new MongoDbService(); database(service, fixture, true);
  assert.equal(await service.syncEntity('settings', { siteName: 'Unconfirmed' }), false);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('nested credential placeholders and presence flags are not persisted', () => {
  assert.deepEqual(mergeSettings(fixture, { hasDigiflazzProductionKey: true, apiConfigs: { premium: { apiKey: '********', hasApiKey: true } } }), fixture);
});

test('admin hydration and save never use browser configuration storage', async () => {
  const cache = new Map([['wd_admin_settings_v1', JSON.stringify({ siteName: 'Stale browser' })]]);
  globalThis.localStorage = { getItem: k => cache.get(k) ?? null, setItem: (k,v) => { cache.set(k,v); }, removeItem: k => { cache.delete(k); } } as Storage;
  let remote: any = structuredClone(fixture);
  globalThis.fetch = async (_url, options) => {
    if (options?.method === 'POST') { remote = mergeSettings(remote, JSON.parse(options.body as string)); return new Response(JSON.stringify({ success: true, mongoPersisted: true })); }
    return new Response(JSON.stringify({ success: true, _sanitized: false, data: remote }));
  };
  await storage.hydrateSettingsFromBackend();
  await storage.saveSettings({ ...storage.getSettings(), siteName: 'Confirmed', apiConfigs: { premium: { ...fixture.apiConfigs.premium, apiKey: '' } } } as any);
  assert.equal(cache.has('wd_admin_settings_v1'), false);
  assert.equal(storage.getSettings().apiConfigs?.premium.apiKey, fixture.apiConfigs.premium.apiKey);
  cache.clear();
  assert.equal((await storage.hydrateSettingsFromBackend())?.siteName, 'Confirmed');
  globalThis.fetch = async () => new Response(JSON.stringify({ success: false }), { status: 503 });
  await assert.rejects(storage.saveSettings({ ...storage.getSettings(), siteName: 'Lost' }));
  assert.equal(storage.getSettings().siteName, 'Confirmed');
});

test('provider form waits for authenticated hydration instead of locking in empty defaults', async () => {
  const text = fs.readFileSync(new URL('../src/components/AdminApiSettingsSection.tsx', import.meta.url), 'utf8');
  const source = ts.createSourceFile('component.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let effect = '';
  function visit(node: ts.Node) { if (!effect && ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect') effect = node.arguments[0].getText(source); ts.forEachChild(node, visit); }
  visit(source);
  let resolve: any; let loaded = false; let ready = false;
  const context: any = { storage: { hydrateSettingsFromBackend: () => new Promise(r => { resolve = r; }) }, providerIntegrationService: { getApiConfigs: () => fixture.apiConfigs }, setConfigs: () => { loaded=true; }, setConfigsReady: (v: boolean) => { ready=v; }, onShowToast() {} };
  vm.runInNewContext(ts.transpile(`(${effect})`, { target: ts.ScriptTarget.ES2022 }), context)();
  assert.equal(loaded, false);
  resolve(fixture); await new Promise(r => setImmediate(r));
  assert.equal(loaded, true); assert.equal(ready, true);
});

test('nested provider placeholders leave unchanged fields out of the request', async () => {
  let sent: any; globalThis.fetch = async (_url, options) => {
    if (options?.method === 'POST') { sent = JSON.parse(options.body as string); return new Response(JSON.stringify({ success: true })); }
    return new Response(JSON.stringify({ success: true, data: fixture }));
  };
  await storage.hydrateSettingsFromBackend();
  await storage.saveSettings({ ...storage.getSettings(), apiConfigs: { premium: { ...fixture.apiConfigs.premium, apiKey: '********' } } } as any);
  assert.equal('apiConfigs' in sent, false);
});

function backendRoute(endpoint: string, context: any) {
  const text = fs.readFileSync(new URL('backend/src/index.ts', root), 'utf8');
  const source = ts.createSourceFile('index.ts', text, ts.ScriptTarget.Latest, true);
  let handler: any;
  context.app = { get: (_path: string, fn: any) => { handler = fn; }, post: (_path: string, _auth: any, fn: any) => { handler = fn; } };
  for (const node of source.statements) {
    const code = node.getText(source);
    if (code.startsWith('const SENSITIVE_SETTINGS_KEYS') || code.startsWith('function sanitizeSettingsForPublic') || (/^app\.(get|post)\(/.test(code) && code.includes(`'${endpoint}'`))) vm.runInNewContext(ts.transpile(code, { target: ts.ScriptTarget.ES2022 }), context);
  }
  return handler;
}

test('public settings load excludes every provider credential including noubu and future keys', async () => {
  const dto = await import('../backend/src/security/stateDto.js');
  const context = { ...dto, mongoDbService: { getAllState: async () => ({ settings: { ...fixture, noubuApiKey: 'PRIVATE-NOUBU', futureSecret: 'PRIVATE-FUTURE' } }) }, isAdminRequest: () => false };
  const handler = backendRoute('/api/settings/load', context);
  let body: any; const res: any = { setHeader() {}, json: (v: any) => { body = v; }, status: () => res };
  await handler({}, res);
  assert.equal(JSON.stringify(body).includes('PRIVATE-'), false);
  assert.equal('apiConfigs' in body.data, false);
});

test('settings save rejects database failure before runtime or environment changes', async () => {
  let effects = 0; let status = 200; let body: any;
  const context: any = { requireAdmin() {}, mergeSettings, console, mongoDbService: { getAllState: async () => ({ settings: fixture }), syncEntity: async () => false }, resolveEnvPath: () => { effects++; return ''; }, fs: { existsSync: () => false }, PAKASIR_CONFIG: {}, QIOSPAY_CONFIG: {}, DIGIFLAZZ_CONFIG: {}, pakasirService: { refreshConfig: () => { effects++; } }, digiflazzService: { refreshConfig: () => { effects++; } } };
  const handler = backendRoute('/api/settings/save', context);
  const res: any = { status: (n: number) => { status = n; return res; }, json: (v: any) => { body = v; return res; } };
  await handler({ body: { siteName: 'Rejected' } }, res);
  assert.equal(status, 503); assert.equal(body.success, false); assert.equal(effects, 0);
});
