import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const source = fs.readFileSync(path.resolve('backend/src/index.ts'), 'utf8');
const qiospaySource = fs.readFileSync(path.resolve('backend/src/services/qiospay.ts'), 'utf8');
const paymentModalSource = fs.readFileSync(path.resolve('src/components/SnapSimulatorModal.tsx'), 'utf8');

test('Qiospay orders receive a unique payable amount before their QRIS is generated', () => {
  assert.match(source, /paymentReferenceFee/);
  assert.match(source, /usedPendingAmounts/);
  assert.match(source, /grossAmount:\s*totalAmount/);
});

test('QRIS verification starts immediately and polls every two seconds', () => {
  assert.match(paymentModalSource, /const pollPaymentStatus = async \(\) =>/);
  assert.match(paymentModalSource, /void pollPaymentStatus\(\);/);
  assert.match(paymentModalSource, /}, 2000\);/);
});

test('Qiospay mutation cache does not delay fresh payment detection beyond two seconds', () => {
  assert.match(qiospaySource, /MUTASI_CACHE_TTL_MS\s*=\s*1500/);
});
