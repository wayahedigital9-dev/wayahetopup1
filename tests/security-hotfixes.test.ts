import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const accountPage = fs.readFileSync(new URL('../src/pages/AkunPage.tsx', import.meta.url), 'utf8');
const backendIndex = fs.readFileSync(new URL('../backend/src/index.ts', import.meta.url), 'utf8');

test('member voucher UI never invents a code and only lists delivered vouchers', () => {
  assert.doesNotMatch(accountPage, /MLT24-|ord\.id\.slice\(-5\)/);
  assert.match(accountPage, /fulfillmentResult\?\.voucherCode/);
  assert.match(accountPage, /fulfillmentStatus\s*===\s*['"]SUCCESS['"]/);
});

test('admin login route applies a dedicated 5-per-15-minute rate limiter', () => {
  assert.match(backendIndex, /const adminLoginLimiter\s*=\s*rateLimit\(\{[\s\S]*?windowMs:\s*15\s*\*\s*60\s*\*\s*1000,[\s\S]*?max:\s*5/);
  assert.match(backendIndex, /app\.post\(['"]\/api\/admin\/login['"],\s*adminLoginLimiter,/);
});
