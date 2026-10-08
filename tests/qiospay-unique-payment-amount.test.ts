import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const source = fs.readFileSync(path.resolve('backend/src/index.ts'), 'utf8');

test('Qiospay orders receive a unique payable amount before their QRIS is generated', () => {
  assert.match(source, /paymentReferenceFee/);
  assert.match(source, /usedPendingAmounts/);
  assert.match(source, /grossAmount:\s*totalAmount/);
});
