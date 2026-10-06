import test from 'node:test';
import assert from 'node:assert/strict';
import {crc16,inspect,createQris} from './qris.mjs';
const enc=(tag,value)=>tag+String(value.length).padStart(2,'0')+value;
const prefix=enc('00','01')+enc('01','11')+enc('26',enc('00','TEST.MERCHANT'))+enc('52','5499')+enc('53','360')+enc('58','ID')+enc('59','TEST TOKO')+enc('60','JAKARTA')+'6304';
const original=prefix+crc16(prefix); // Fixture sintetis, bukan QRIS yang dapat dibayar.
test('known CRC vector',()=>assert.equal(crc16('123456789'),'29B1'));
test('amount and merchant preservation',()=>{
  const r=createQris(original,2000,{providerConfirmed:true});
  const before=inspect(original).values,after=inspect(r.qrString).values;
  assert.equal(after['01'],'12');assert.equal(after['54'],'2000');
  for(const tag of Object.keys(before).filter(t=>!['01','63'].includes(t))) assert.equal(after[tag],before[tag]);
  assert.equal(r.paymentStatus,'unverified');
});
test('reject unconfirmed support, bad CRC, invalid amount, dynamic input',()=>{
  assert.throws(()=>createQris(original,2000));
  assert.throws(()=>createQris(original.slice(0,-4)+'0000',2000,{providerConfirmed:true}));
  for(const n of [0,-1,2.5,10000001]) assert.throws(()=>createQris(original,n,{providerConfirmed:true}));
  const dynamic=createQris(original,2000,{providerConfirmed:true}).qrString;
  assert.throws(()=>createQris(dynamic,2000,{providerConfirmed:true}));
});
