import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
// Initial RED demonstrated old signup omitted passwordHash and granted fake money.
// New behavior is exercised through actual HTTP handlers in member-auth.test.ts.
test('deployed backend wires real member routes to Mongo only, never old fallback signup', () => {
 const source=fs.readFileSync(new URL('../backend/src/index.ts',import.meta.url),'utf8');
 assert.match(source,/const memberAuth = createMemberAuth/);
 assert.match(source,/return client\.db\(mongoDbService\.getPrimaryDbName\(\)\)/);
 assert.match(source,/app\.use\('\/api\/auth',[\s\S]*?memberAuth\.router/);
 assert.ok(!source.includes("app.post('/api/auth/register'"));
 assert.ok(!source.includes('supabaseService.saveUser('));
});
