import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve('.');
const fulfillment = fs.readFileSync(path.join(root, 'backend/src/services/fulfillment.ts'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');

test('paid WiFi orders stored in Mongo can be fulfilled without a Prisma mirror', () => {
  assert.match(fulfillment, /const state = await mongoDbService\.getAllState\(\)/);
  assert.match(fulfillment, /fulfillManualWifiOrder/);
  assert.match(fulfillment, /reserveManualWifiVoucher/);
});

test('customer catalog hydrates manual inventory from the admin database on app startup', () => {
  assert.match(app, /storage\.hydrateManualInventory\(\).*loadData\(\)/s);
});
