import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const protectedPostRoutes = [
  '/api/payment/pakasir/test',
  '/api/payment/pakasir/toggle-sandbox',
  '/api/tunnel/start',
  '/api/tunnel/stop',
  '/api/supabase/test',
  '/api/mongodb/test',
];

test('sensitive operational POST routes require an admin session', () => {
  const file = new URL('../backend/src/index.ts', import.meta.url);
  const source = ts.createSourceFile(file.pathname, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const found = new Map<string, boolean>();

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(source) === 'app' && node.expression.name.text === 'post') {
      const route = node.arguments[0]?.getText(source).replace(/^['"]|['"]$/g, '');
      if (route && protectedPostRoutes.includes(route)) {
        found.set(route, node.arguments[1]?.getText(source) === 'requireAdmin');
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  assert.deepEqual([...found.keys()].sort(), [...protectedPostRoutes].sort(), 'every sensitive route must remain registered');
  for (const route of protectedPostRoutes) {
    assert.equal(found.get(route), true, `${route} must requireAdmin`);
  }
});
