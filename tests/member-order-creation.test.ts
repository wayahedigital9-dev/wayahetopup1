import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const backend = fs.readFileSync(new URL('../backend/src/index.ts', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../src/services/apiAdapter.ts', import.meta.url), 'utf8');

test('order creation requires an authenticated member before any reservation or payment work', () => {
  assert.match(backend, /const member = await memberAuth\.getMember\(req\);\s*if \(!member\)/);
  assert.match(backend, /userId:\s*member\.id/);
});

test('client does not save a local order or fabricate a QRIS fallback when backend order creation fails', () => {
  assert.match(client, /if \(!response\.ok/);
  assert.match(client, /throw new Error/);
  assert.match(client, /storage\.cacheServerOrder\(confirmed\)/);
  const creation = client.slice(client.indexOf('async createOrder('), client.indexOf('// SIMULASI PEMBAYARAN'));
  assert.doesNotMatch(creation, /convertStaticToDynamicQRIS|storage\.saveWifiVouchers/);
});
