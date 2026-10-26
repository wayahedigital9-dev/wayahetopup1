import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const index = fs.readFileSync('backend/src/index.ts', 'utf8');

test('Xaviera catalog is exposed only through an authenticated backend route', () => {
  assert.match(index, /app\.get\(['"]\/api\/provider\/catalog['"],\s*requireAdmin,/);
  assert.match(index, /xavieraProducts|xavieraSmmServices|xavieraGames/);
  assert.doesNotMatch(index, /req\.body\??\.apiKey|req\.query\??\.apiKey/);
});
