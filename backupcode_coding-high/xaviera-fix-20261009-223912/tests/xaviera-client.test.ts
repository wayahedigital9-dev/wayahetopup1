import assert from 'node:assert/strict';
import test from 'node:test';

// RED: client file must exist and export the documented endpoint helpers with safe auth.
const src = await (await import('node:fs/promises')).readFile('backend/src/services/xavieraClient.ts', 'utf8');

test('xaviera client never embeds a literal API key', () => {
  assert.ok(!/xvs_[A-Za-z0-9]{16,}/.test(src), 'literal key leaked into source');
});

test('xaviera client uses Bearer auth and documented endpoints', () => {
  assert.match(src, /Authorization.*Bearer/);
  for (const ep of ['/me', '/products', '/products/order', '/orders/', '/smm/services', '/smm/order', '/games', '/games/order']) {
    assert.ok(src.includes(ep), `endpoint ${ep} missing`);
  }
});

test('xaviera client handles rate limit via retry-after', () => {
  assert.match(src, /429/);
  assert.match(src, /retry-after/i);
});

test('xaviera client refuses to call without a configured key', () => {
  assert.match(src, /belum dikonfigurasi/);
});
