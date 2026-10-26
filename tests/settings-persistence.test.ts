import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const dashboardSource = fs.readFileSync(new URL('../src/pages/AdminDashboard.tsx', import.meta.url), 'utf8');
function dashboardFunction(name: string) {
  const source = ts.createSourceFile('dashboard.tsx', dashboardSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let code = '';
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) code = node.initializer!.getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return ts.transpile(`(${code})`, { target: ts.ScriptTarget.ES2022 });
}

test('Supabase save handler never displays success after backend rejection', async () => {
  const toasts: string[] = [];
  const context: any = {
    settings: {}, sanitizeUrl: (v: string) => v,
    storage: { saveSettings: async () => { throw new Error('fixture failure'); } },
    onShowToast: (_title: string, _message: string, kind: string) => toasts.push(kind),
    setSettings() {}, setActiveTab() {}, setSettingsSubTab() {}, setEnvSystemTab() {},
  };
  try { context.persistSettings = vm.runInNewContext(dashboardFunction('persistSettings'), context); } catch {}
  await vm.runInNewContext(dashboardFunction('handleSaveSupabaseSettings'), context)();
  assert.deepEqual(toasts, ['error']);
});

test('Pakasir mode change never shows success or calls provider after rejected settings save', async () => {
  const toasts: string[] = []; let providerCalls = 0;
  const context: any = { settings: {}, setPakasirIsSandbox() {}, setSettings() {}, storage: { saveSettings: async () => { throw new Error('fixture rejection'); } }, persistSettings: async () => { toasts.push('error'); return false; }, apiAdapter: { togglePakasirSandbox: async () => { providerCalls++; } }, onShowToast: (_a: string, _b: string, type: string) => toasts.push(type) };
  await vm.runInNewContext(dashboardFunction('handleTogglePakasirMode'), context)(true);
  assert.deepEqual(toasts, ['error']); assert.equal(providerCalls, 0);
});

// Import backend only after moving away from the live cwd/.env/data.
const sandbox = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'settings-regression-'));
process.chdir(sandbox);
const { MongoDbService } = await import('../backend/src/services/mongodbService.ts');
const { SupabaseService } = await import('../backend/src/services/supabaseService.ts');
const { storage } = await import('../src/services/storage.ts');
const dbFile = path.join(sandbox, 'data/db.json');
const fixture = { supabaseSecretKey: 'fixture-server-key', digiflazzProductionKey: 'fixture-df-key', pakasirApiKey: 'fixture-payment-key', siteName: 'Before' };

 test('Mongo unavailable rejects settings patch without updating disk fallback', async () => {
  fs.writeFileSync(dbFile, JSON.stringify({ settings: fixture }));
  const service = new MongoDbService();
  service.getClient = async () => null;
  await service.syncEntity('settings', { siteName: 'After', supabaseSecretKey: '', digiflazzProductionKey: '********', pakasirApiKey: null });
  const reloaded = new MongoDbService();
  reloaded.getClient = async () => null;
  assert.deepEqual((await reloaded.getAllState()).settings, fixture);
});

test('Supabase settings patch preserves masked secrets across disk reload', async () => {
  fs.writeFileSync(dbFile, JSON.stringify({ settings: fixture }));
  const service = new SupabaseService();
  service.getClient = () => null;
  await service.syncEntity('settings', { digiflazzProductionKey: '********' });
  assert.deepEqual(JSON.parse(fs.readFileSync(dbFile, 'utf8')).settings, fixture);
});

test('Mongo cloud settings are authoritative over the local mirror', async () => {
  fs.writeFileSync(dbFile, JSON.stringify({ settings: { ...fixture, siteName: 'Newer' } }));
  const service = new MongoDbService();
  const cursor: any = { sort: () => cursor, limit: () => cursor, toArray: async () => [] };
  service.getClient = async () => ({ db: () => ({ collection: () => ({ find: () => cursor, findOne: async () => ({ data: { ...fixture, siteName: 'Stale' } }) }) }) }) as any;
  assert.equal((await service.getAllState()).settings.siteName, 'Stale');
  assert.equal(JSON.parse(fs.readFileSync(dbFile, 'utf8')).settings.siteName, 'Stale');
});

test('Supabase does not report success when its durable local write fails', async () => {
  fs.rmSync(dbFile, { force: true });
  fs.mkdirSync(dbFile);
  const service = new SupabaseService();
  service.getClient = () => null;
  try {
    await assert.rejects(service.syncEntity('settings', fixture));
  } finally {
    fs.rmdirSync(dbFile);
  }
});

test('frontend rejects failed settings save without changing confirmed cache', async () => {
  const cache = new Map<string, string>([['wd_admin_settings_v1', JSON.stringify(fixture)]]);
  globalThis.localStorage = { getItem: k => cache.get(k) ?? null, setItem: (k,v) => { cache.set(k,v); } } as Storage;
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true, data: fixture }));
  await storage.hydrateSettingsFromBackend();
  globalThis.fetch = async () => new Response(JSON.stringify({ success: false }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  await assert.rejects(async () => { await storage.saveSettings({ ...storage.getSettings(), siteName: 'Unsaved' }); });
  assert.equal(storage.getSettings().siteName, 'Before');
});

test('save is not successful when server readback is stale', async () => {
  const cache = new Map<string, string>([['wd_admin_settings_v1', JSON.stringify(fixture)]]);
  globalThis.localStorage = { getItem: k => cache.get(k) ?? null, setItem: (k,v) => { cache.set(k,v); } } as Storage;
  globalThis.fetch = async (_url, options) => new Response(JSON.stringify(options?.method === 'POST'
    ? { success: true } : { success: true, data: { settings: fixture } }), { headers: { 'Content-Type': 'application/json' } });
  await storage.hydrateSettingsFromBackend();
  await assert.rejects(storage.saveSettings({ ...storage.getSettings(), siteName: 'After' }));
  assert.equal(storage.getSettings().siteName, 'Before');
});

test('one confirmed save strips placeholders and survives fresh browser reload', async () => {
  const cache = new Map<string, string>();
  globalThis.localStorage = { getItem: k => cache.get(k) ?? null, setItem: (k,v) => { cache.set(k,v); } } as Storage;
  let remote: any = { ...fixture };
  const writes: any[] = [];
  globalThis.fetch = async (_url, options) => {
    if (options?.method === 'POST') {
      const body = JSON.parse(options.body as string);
      writes.push(body);
      remote = { ...remote, ...body };
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ success: true, data: { settings: remote } }), { headers: { 'Content-Type': 'application/json' } });
  };
  await storage.hydrateSettingsFromBackend();
  await storage.saveSettings({ ...storage.getSettings(), siteName: 'After', supabaseSecretKey: '********', digiflazzProductionKey: '' });
  assert.equal(writes.length, 1);
  assert.equal('supabaseSecretKey' in writes[0], false);
  assert.equal('digiflazzProductionKey' in writes[0], false);
  cache.clear();
  const reloaded = await storage.hydrateSettingsFromBackend();
  assert.equal(reloaded?.siteName, 'After');
  assert.equal(reloaded?.supabaseSecretKey, fixture.supabaseSecretKey);
  assert.equal(reloaded?.digiflazzProductionKey, fixture.digiflazzProductionKey);
});
