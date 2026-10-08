import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';

const sourcePath = new URL('../src/services/storage.ts', import.meta.url);
const source = fs.readFileSync(sourcePath, 'utf8');
const start = source.indexOf('async hydrateSettingsFromBackend()');
const end = source.indexOf('\n  getSettings():', start);
assert.ok(start >= 0 && end > start, 'hydrateSettingsFromBackend must exist');
const hydrate = source.slice(start, end);

assert.match(
  hydrate,
  /fetchWithFallback\('\/api\/settings\/load'/,
  'admin hydration must use /api/settings/load so persisted apiConfigs are restored'
);
assert.doesNotMatch(
  hydrate,
  /\/api\/sync\/state/,
  'admin hydration must not use the intentionally sanitized public sync endpoint'
);

const stateResponse = await fetch('http://127.0.0.1:4000/api/sync/state');
assert.ok(stateResponse.ok, 'sync/state must be reachable');
const state = await stateResponse.json();
assert.equal(
  Object.hasOwn(state.data?.settings ?? {}, 'apiConfigs'),
  false,
  'public sync/state must keep apiConfigs out of its payload'
);

const persistedSettings = JSON.parse(fs.readFileSync(new URL('../backend/data/db.json', import.meta.url), 'utf8')).settings || {};
assert.ok(persistedSettings.adminUsername && persistedSettings.adminPassword, 'admin credentials must exist for the session integration check');

function requestNginx(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 80,
      path,
      headers: { Host: 'wayahetopup.my.id', ...headers },
    }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

function loginAdmin() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ username: persistedSettings.adminUsername, password: persistedSettings.adminPassword });
    const req = http.request({
      hostname: '127.0.0.1',
      port: 80,
      path: '/api/admin/login',
      method: 'POST',
      headers: { Host: 'wayahetopup.my.id', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        const cookie = res.headers['set-cookie']?.[0]?.split(';')[0] || '';
        resolve({ status: res.statusCode, cookie, body });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const loginRes = await loginAdmin();
assert.equal(loginRes.status, 200, 'admin login must succeed in regression script');
assert.ok(loginRes.cookie, 'admin session cookie must be returned');
const adminHeaders = { Cookie: loginRes.cookie };

const settingsResponse = await requestNginx('/api/settings/load', adminHeaders);
assert.ok(settingsResponse.status === 200, 'settings/load must be reachable with admin session cookie');
const settings = JSON.parse(settingsResponse.body);
assert.ok(
  Object.keys(settings.data?.apiConfigs ?? {}).length > 0,
  'settings/load must provide persisted apiConfigs to the authenticated admin screen'
);

const publicResponse = await requestNginx('/api/settings/load');
assert.match(
  publicResponse.headers['content-type'] ?? '',
  /application\/json/i,
  'the deployed nginx site must proxy /api/settings/load to the backend instead of returning index.html'
);
const publicSettings = JSON.parse(publicResponse.body);
assert.equal(publicSettings._sanitized, true, 'unauthenticated public requests must receive a sanitized settings DTO');
assert.equal(Object.hasOwn(publicSettings.data ?? {}, 'apiConfigs'), false, 'unauthenticated requests must not receive API configuration or keys');

const publicAdminResponse = await requestNginx('/api/settings/load', adminHeaders);
assert.match(publicAdminResponse.headers['content-type'] ?? '', /application\/json/i);
const publicAdminSettings = JSON.parse(publicAdminResponse.body);
assert.equal(publicAdminSettings._sanitized, false, 'a valid admin request must receive the saved settings');
assert.ok(Object.keys(publicAdminSettings.data?.apiConfigs ?? {}).length > 0, 'a valid admin request must restore apiConfigs');

const backendSource = fs.readFileSync(new URL('../backend/src/index.ts', import.meta.url), 'utf8');
const adminStart = backendSource.indexOf('function requireAdmin');
const adminEnd = backendSource.indexOf('// 12b. MONGODB', adminStart);
assert.ok(adminStart >= 0 && adminEnd > adminStart, 'requireAdmin must exist');
const adminAuthSource = backendSource.slice(adminStart, adminEnd);
assert.doesNotMatch(adminAuthSource, /127\.0\.0\.1|::1|wayahe_admin_secret_token_1234/, 'admin authorization must not trust the reverse-proxy loopback address or a hard-coded fallback token');

console.log('settings hydration regression check passed');

const providerSource = fs.readFileSync(new URL('../src/services/providerIntegrationService.ts', import.meta.url), 'utf8');
assert.match(
  providerSource,
  /async saveApiConfig\(config: ApiProviderConfig\): Promise<void>\s*\{[\s\S]*?await storage\.saveSettings\(/,
  'saving an API config must wait for durable settings persistence'
);

const adminApiSource = fs.readFileSync(new URL('../src/components/AdminApiSettingsSection.tsx', import.meta.url), 'utf8');
const saveStart = adminApiSource.indexOf('const handleSaveConfig');
const saveEnd = adminApiSource.indexOf('\n  const handleTestConnection', saveStart);
assert.ok(saveStart >= 0 && saveEnd > saveStart, 'handleSaveConfig must exist');
assert.match(
  adminApiSource.slice(saveStart, saveEnd),
  /await providerIntegrationService\.saveApiConfig\(currentConfig\)/,
  'the UI must not announce success before API config persistence finishes'
);

console.log('API config persistence-await regression check passed');
