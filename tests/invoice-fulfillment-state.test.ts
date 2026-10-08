import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const invoicePath = path.resolve('src/components/InvoiceModal.tsx');
const source = fs.readFileSync(invoicePath, 'utf8');

test('WiFi voucher is shown only after server fulfillment succeeds with a real voucher code', () => {
  assert.match(
    source,
    /isWifi\s*&&\s*currentOrder\.fulfillmentStatus\s*===\s*'SUCCESS'\s*&&\s*Boolean\(wifiVoucherCode\)/,
  );
});


test('receipt polling treats the server order as authoritative and does not save order state locally', () => {
  const pollingBlock = source.split('// Auto-polling status transaksi dari backend/database setiap 3-4 detik')[1].split('// Voucher is allocated only by the backend')[0];
  assert.doesNotMatch(pollingBlock, /storage\.saveOrders\(/);
  assert.match(pollingBlock, /const serverOrder: Order/);
});
