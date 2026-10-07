// Pembentukan payload lokal; bukan API invoice Qiospay dan bukan bukti pembayaran.
export function crc16(text) {
  let crc=0xffff;
  for(const byte of Buffer.from(text,'utf8')) {
    crc ^= byte << 8;
    for(let n=0;n<8;n++) crc=(crc & 0x8000) ? ((crc << 1)^0x1021)&0xffff : (crc << 1)&0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4,'0');
}
export function parse(payload) {
  // Starter membatasi ASCII agar panjang field tidak ambigu.
  if(typeof payload!=='string' || !/^[\x20-\x7E]+$/.test(payload) || payload.length>4096) throw new Error('Payload harus ASCII lengkap tanpa newline');
  const rows=[]; const seen=new Set();
  for(let i=0;i<payload.length;) {
    const header=payload.slice(i,i+4);
    if(!/^\d{4}$/.test(header)) throw new Error(`Header TLV rusak di posisi ${i}`);
    const tag=header.slice(0,2), length=Number(header.slice(2));
    if(!length || i+4+length>payload.length) throw new Error(`Panjang tag ${tag} tidak valid`);
    if(seen.has(tag)) throw new Error(`Tag ${tag} duplikat`);
    seen.add(tag);rows.push({tag,value:payload.slice(i+4,i+4+length)});i+=4+length;
  }
  return rows;
}
const encode=({tag,value})=>tag+String(value.length).padStart(2,'0')+value;
export function inspect(payload) {
  const rows=parse(payload), last=rows.at(-1);
  if(last?.tag!=='63' || !/^[0-9A-Fa-f]{4}$/.test(last.value)) throw new Error('CRC tag 63 harus terakhir dan 4 hex');
  if(crc16(payload.slice(0,-4))!==last.value.toUpperCase()) throw new Error('CRC payload salah');
  const values=Object.fromEntries(rows.map(r=>[r.tag,r.value]));
  if(values['00']!=='01' || !['01','11','12'].includes(values['01'])) throw new Error('Format/point of initiation tidak didukung');
  if(values['53']!=='360' || values['58']!=='ID') throw new Error('Payload harus mata uang IDR dan negara ID');
  const accounts=rows.filter(r=>Number(r.tag)>=26 && Number(r.tag)<=51);
  if(!accounts.length) throw new Error('Merchant account tidak ditemukan');
  for(const account of accounts) parse(account.value);
  if(values['62']) parse(values['62']);
  return {rows,values};
}
export function createQris(original,amount,{providerConfirmed=false}={}) {
  const targetAmount = Math.max(1, Math.round(Number(amount || 0)));
  const amtStr = String(targetAmount);
  const rows = parse(String(original).trim());
  const updated=[];
  let hasTag01=false;
  let hasTag53=false;
  let hasTag54=false;
  for(const row of rows) {
    if(row.tag==='63') continue;
    if(row.tag==='01') {
      updated.push({tag:'01',value:'12'});
      hasTag01=true;
    } else if(row.tag==='53') {
      updated.push(row);
      hasTag53=true;
    } else if(row.tag==='54') {
      updated.push({tag:'54',value:amtStr});
      hasTag54=true;
    } else if(['55','56','57'].includes(row.tag)) {
      continue;
    } else {
      updated.push(row);
    }
  }
  if(!hasTag01) updated.splice(1,0,{tag:'01',value:'12'});
  if(!hasTag53) updated.splice(2,0,{tag:'53',value:'360'});
  if(!hasTag54) {
    const idx53 = updated.findIndex(r=>r.tag==='53');
    if(idx53!==-1) updated.splice(idx53+1,0,{tag:'54',value:amtStr});
    else updated.push({tag:'54',value:amtStr});
  }
  const prefix=updated.map(encode).join('')+'6304';
  const result=prefix+crc16(prefix);
  return {qrString:result,amount:targetAmount,method:'local-payload-conversion',paymentStatus:'unverified'};
}
