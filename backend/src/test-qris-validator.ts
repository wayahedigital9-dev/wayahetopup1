import { inspect, createQris, crc16 } from './utils/qris.js';

function createValidTestStaticQRIS(): string {
  const enc = (tag: string, val: string) => tag + String(val.length).padStart(2, '0') + val;
  const tag26 = enc('26', enc('00', 'ID.CO.QIOSPAY.WWW') + enc('01', '936009110020000000') + enc('02', '000000000000000') + enc('03', 'UME'));
  const tag51 = enc('51', enc('00', 'ID.CO.QRIS.WWW') + enc('01', 'ID1020021000000') + enc('02', '00000000'));
  const prefix = enc('00', '01') + enc('01', '11') + tag26 + tag51 + enc('52', '5411') + enc('53', '360') + enc('58', 'ID') + enc('59', 'WAYAHE DIGITAL') + enc('60', 'BANDUNG') + enc('61', '40115') + enc('62', enc('07', 'A01')) + '6304';
  return prefix + crc16(prefix);
}

console.log('═══════════════════════════════════════════════════════');
console.log('   EMVCo QRIS INSPECT & CREATE-QRIS TEST');
console.log('═══════════════════════════════════════════════════════');

const sampleStatic = createValidTestStaticQRIS();
console.log('\n[1] Inspect QRIS Statis Asli:');
const inspRaw = inspect(sampleStatic);
console.log('   Merchant Name:', inspRaw.values['59']);
console.log('   City:', inspRaw.values['60']);
console.log('   POI (Tag 01):', inspRaw.values['01']);
console.log('   CRC:', inspRaw.values['63']);

console.log('\n[2] createQris (Nominal Rp 25.000):');
const dynamicResult = createQris(sampleStatic, 25000, { providerConfirmed: true });
const inspDyn = inspect(dynamicResult.qrString);
console.log('   POI (Tag 01):', inspDyn.values['01']);
console.log('   Nominal (Tag 54):', inspDyn.values['54']);
console.log('   CRC:', inspDyn.values['63']);
console.log('   Payment Status:', dynamicResult.paymentStatus);

console.log('\n[3] Breakdown Tag Dynamic QRIS:');
inspDyn.rows.forEach(r => {
  console.log(`   Tag ${r.tag} (${r.value.length.toString().padStart(2, ' ')}B): "${r.value}"`);
});

console.log('\n═══════════════════════════════════════════════════════');
