import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

test('manual premium stock parser preserves credential separators and rejects malformed or duplicate stock', async () => {
  assert.ok(fs.existsSync('src/components/PremiumManualStockPanel.tsx'), 'manual premium stock panel is missing');
  const { parsePremiumStock } = await import('../src/components/PremiumManualStockPanel');
  assert.deepEqual(parsePremiumStock('user|secret,with;punctuation\r\n KEY-1\n\n'), ['user|secret,with;punctuation', 'KEY-1']);
  assert.deepEqual(parsePremiumStock(''), []);
  assert.throws(() => parsePremiumStock('user|'), /baris/i);
  assert.throws(() => parsePremiumStock('|password'), /baris/i);
  assert.throws(() => parsePremiumStock('KEY\nKEY'), /duplikat/i);
});

test('manual storefront availability uses confirmed counts without secret arrays or invented defaults', async () => {
  assert.ok(fs.existsSync('src/components/PremiumManualStockPanel.tsx'), 'manual premium stock panel is missing');
  const { premiumAvailableStock, isManualPremium } = await import('../src/components/PremiumManualStockPanel');
  assert.equal(premiumAvailableStock({ categoryId: 'premium' } as any), 0);
  assert.equal(premiumAvailableStock({ stock: 0 } as any), 0);
  assert.equal(premiumAvailableStock({ hasVariants: true, variants: [{ stock: 0 }, { stock: 2 }] } as any), 2);
  assert.equal(isManualPremium({ categoryId: 'premium', isManualCustom: true, providerProductId: 'provider-premium' } as any), true);
  assert.equal(isManualPremium({ categoryId: 'premium', providerProductId: 'provider-premium' } as any), false);
});
