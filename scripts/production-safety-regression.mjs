import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';

const root = new URL('../', import.meta.url);
const backend = fs.readFileSync(new URL('backend/src/index.ts', root), 'utf8');
const qiospay = fs.readFileSync(new URL('backend/src/services/qiospay.ts', root), 'utf8');
const paymentRouter = fs.readFileSync(new URL('backend/src/services/paymentRouter.ts', root), 'utf8');
const config = fs.readFileSync(new URL('backend/src/config/apikeys.ts', root), 'utf8');

function routeBlock(marker, nextMarker) {
  const start = backend.indexOf(marker);
  const end = backend.indexOf(nextMarker, start);
  assert.ok(start >= 0 && end > start, `could not locate ${marker}`);
  return backend.slice(start, end);
}

for (const [marker, nextMarker] of [
  ["app.all('/api/digiflazz/balance'", '// Transaksi Digiflazz'],
  ["app.post('/api/digiflazz/transaction'", '// Sinkronisasi Katalog'],
  ["app.post(['/api/orders/:id/fulfill'", '// 4c. SYSTEM GATEWAY'],
  ["app.post('/api/payment/pakasir/simulate'", '// 3. Admin Events Inspector'],
  ["app.get('/api/tunnel/status'", '// 12. SUPABASE'],
]) {
  assert.match(routeBlock(marker, nextMarker), /requireAdmin/, `${marker} must require admin authorization`);
}

const simulate = routeBlock("app.post('/api/payment/pakasir/simulate'", '// 3. Admin Events Inspector');
assert.match(simulate, /CONSOLE_CONFIG\.isProduction/, 'Pakasir simulation must be disabled in production');
assert.doesNotMatch(qiospay, /callback_scret|312d3971811869d9f3a6c740b944f9bf841369d17479bdcaaa9080d1658ba4cb/, 'Qiospay callback must not accept placeholder or fallback secrets');
assert.doesNotMatch(config, /wayahe_admin_secret_token_1234|\|\| 'mysecret'/, 'configuration must not include known fallback secrets');
assert.doesNotMatch(paymentRouter, /generateDynamicQRIS\(|convertStaticToDynamicQRIS\(/, 'production router must not fabricate a payment QR when gateway creation fails');

const persistedSettings = JSON.parse(fs.readFileSync(new URL('backend/data/db.json', root), 'utf8')).settings || {};
assert.ok(persistedSettings.adminUsername && persistedSettings.adminPassword, 'admin credentials must exist for the session integration check');

function request(path, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: 80, path, method, headers: { Host: 'wayahetopup.my.id', ...headers } }, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', c => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, contentType: res.headers['content-type'] || '', body: data }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

for (const route of ['/api/digiflazz/balance', '/api/tunnel/status']) {
  const response = await request(route);
  assert.equal(response.status, 401, `${route} must reject anonymous callers`);
}
for (const route of ['/api/payment/pakasir/simulate', '/api/orders/test/fulfill']) {
  const response = await request(route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: {} });
  assert.equal(response.status, 401, `${route} must reject anonymous callers`);
}

const adminProbe = await request('/api/orders/test/fulfill', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: {} });
assert.equal(adminProbe.status, 401, 'unauthenticated request to fulfill must return 401');

console.log('production safety regression check passed');
