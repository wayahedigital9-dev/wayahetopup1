import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { resolveManualCheckout } from '../backend/src/services/manualCheckout';

test('manual checkout uses selected admin variant price and stock, not browser values',()=>{
  const result=resolveManualCheckout({id:'wifi',categoryId:'wifi',name:'Wifi',isActive:true,sellingPrice:999,variants:[{id:'1h',name:'1 Jam',sellingPrice:2000,voucherCodes:['fixture']},{id:'1d',name:'1 Hari',sellingPrice:10000,voucherCodes:['fixture2']}]},'1d');
  assert.equal(result.product.sellingPrice,10000);assert.equal(result.variantId,'1d');assert.equal(result.product.stock,1);
});
test('manual checkout rejects empty stock even when a forged numeric stock exists',()=>{
  assert.throws(()=>resolveManualCheckout({categoryId:'premium',name:'Premium',isActive:true,sellingPrice:5000,stock:99,voucherCodes:[]}),/Stok produk kosong/);
});
test('manual checkout rejects invalid or missing variant before payment',()=>{
  const product={categoryId:'wifi',isActive:true,variants:[{id:'real',sellingPrice:2000,voucherCodes:['fixture']}]};
  assert.throws(()=>resolveManualCheckout(product,'forged'),/varian/i);assert.throws(()=>resolveManualCheckout(product),/varian/i);
});
test('supplier synced premium products stay on supplier checkout path',()=>{
  const product={categoryId:'premium',isDigiflazzSynced:true,sellingPrice:9000};assert.equal(resolveManualCheckout(product).product,product);
});
test('canonical invoice item includes the server selling price expected by receipt UI',()=>{
  const source=fs.readFileSync('backend/src/index.ts','utf8');
  const snapshot=source.slice(source.indexOf('const formattedOrder ='),source.indexOf('// 2. Simpan order'));
  assert.match(snapshot,/sellingPrice:\s*product\.sellingPrice/);
});
