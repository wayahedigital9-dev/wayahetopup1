import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
const source = fs.readFileSync('src/components/InvoiceModal.tsx', 'utf8');

test('WiFi voucher is shown only after server payment and fulfillment succeed with a real code', () => {
  assert.match(source, /const isPaid = currentOrder\?\.paymentStatus === 'PAID'/);
  assert.match(source, /const isFulfillmentSuccess = currentOrder\?\.fulfillmentStatus === 'SUCCESS'/);
  assert.match(source, /const mayReveal = Boolean\(isPaid && isFulfillmentSuccess\)/);
  assert.match(source, /mayReveal && isWifi && Boolean\(wifiVoucherCode\)/);
});
test('receipt polling reads canonical server snapshots and never saves fabricated local state', () => {
  assert.match(source, /const serverOrder: Order/);
  assert.match(source, /setSnapshot\(\{ key: snapshotKey, order: serverOrder \}\)/);
  assert.doesNotMatch(source, /storage\.saveOrders|processPaymentWebhook|reserveManual/);
  assert.match(source, /credentials: 'same-origin'/);
});
test('WiFi receipt displays only real admin voucher credentials with secure copy controls', () => {
  assert.doesNotMatch(source, /from 'qrcode'|wifiDefaultPassword|MelatiNet_Warga_Hotspot|hotspot\.wayahedigital\.id/);
  assert.match(source, /Voucher WiFi Resmi/);
  assert.match(source, /secret\('Kode Voucher WiFi', wifiVoucherCode/);
  assert.match(source, /onCopyText\(value, label\)/);
});
