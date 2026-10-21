/**
 * ══════════════════════════════════════════════════════════════
 *   QRIS EMVCo Generator, Parser & Inspector (Standar ASPI / Bank Indonesia)
 *   Modul pembentukan payload lokal; bukan API invoice Qiospay dan bukan bukti pembayaran.
 * ══════════════════════════════════════════════════════════════
 */

export interface TLVRow {
  tag: string;
  value: string;
}

export interface InspectResult {
  rows: TLVRow[];
  values: Record<string, string>;
}

export interface CreateQrisOptions {
  providerConfirmed?: boolean;
}

export interface CreateQrisResult {
  qrString: string;
  amount: number;
  method: string;
  paymentStatus: 'unverified' | 'verified';
}

/**
 * Kalkulasi Checksum CRC16-CCITT-FALSE (Polynomial 0x1021, Init 0xFFFF)
 */
export function crc16(text: string): string {
  let crc = 0xffff;
  for (const byte of Buffer.from(text, 'utf8')) {
    crc ^= byte << 8;
    for (let n = 0; n < 8; n++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Format TLV dengan 2-digit tag & 2-digit length
 */
export function formatTLV(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${tag}${len}${value}`;
}

const encode = ({ tag, value }: TLVRow) => tag + String(value.length).padStart(2, '0') + value;

/**
 * Parsing payload QRIS ke baris TLV (dengan proteksi ASCII dan validasi buffer)
 */
export function parse(payload: string): TLVRow[] {
  // Starter membatasi ASCII agar panjang field tidak ambigu.
  if (typeof payload !== 'string' || !/^[\x20-\x7E]+$/.test(payload) || payload.length > 4096) {
    throw new Error('Payload harus ASCII lengkap tanpa newline');
  }
  const rows: TLVRow[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < payload.length;) {
    const header = payload.slice(i, i + 4);
    if (!/^\d{4}$/.test(header)) throw new Error(`Header TLV rusak di posisi ${i}`);
    const tag = header.slice(0, 2);
    const length = Number(header.slice(2));
    if (!length || i + 4 + length > payload.length) throw new Error(`Panjang tag ${tag} tidak valid`);
    if (seen.has(tag)) throw new Error(`Tag ${tag} duplikat`);
    seen.add(tag);
    rows.push({ tag, value: payload.slice(i + 4, i + 4 + length) });
    i += 4 + length;
  }
  return rows;
}

/**
 * Inspeksi validitas struktur TLV, CRC16, POI, IDR/ID, dan Merchant Account
 */
export function inspect(payload: string): InspectResult {
  const rows = parse(payload);
  const last = rows.at(-1);
  if (last?.tag !== '63' || !/^[0-9A-Fa-f]{4}$/.test(last.value)) {
    throw new Error('CRC tag 63 harus terakhir dan 4 hex');
  }
  if (crc16(payload.slice(0, -4)) !== last.value.toUpperCase()) {
    throw new Error('CRC payload salah');
  }
  const values = Object.fromEntries(rows.map(r => [r.tag, r.value]));
  if (values['00'] !== '01' || !['01', '11', '12'].includes(values['01'])) {
    throw new Error('Format/point of initiation tidak didukung');
  }
  if (values['53'] !== '360' || values['58'] !== 'ID') {
    throw new Error('Payload harus mata uang IDR dan negara ID');
  }
  const accounts = rows.filter(r => Number(r.tag) >= 26 && Number(r.tag) <= 51);
  if (!accounts.length) throw new Error('Merchant account tidak ditemukan');
  for (const account of accounts) parse(account.value);
  if (values['62']) parse(values['62']);
  return { rows, values };
}

/**
 * Pembuatan payload Dynamic QRIS dengan jaminan penyisipan nominal otomatis (Tag 54)
 * - Mendukung konversi dari QRIS Statis maupun update nominal pada QRIS Dinamis
 * - Mengubah POI (Tag 01) menjadi '12' (Dinamis)
 * - Mempertahankan seluruh identitas terminal, nama toko, dan routing acquirer asli
 */
export function createQris(original: string, amount: number, _options: CreateQrisOptions = {}): CreateQrisResult {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Nominal QRIS harus bilangan rupiah positif.');
  if (typeof original !== 'string' || !original.trim()) throw new Error('QR merchant asli wajib dikonfigurasi.');
  const { rows } = inspect(original.trim());
  const updated = rows.filter(row => row.tag !== '63' && row.tag !== '54').map(row => row.tag === '01' ? { tag: '01', value: '12' } : row);
  const currency = updated.findIndex(row => row.tag === '53');
  updated.splice(currency + 1, 0, { tag: '54', value: String(amount) });
  const prefix = updated.map(encode).join('') + '6304';
  const qrString = prefix + crc16(prefix);
  inspect(qrString);
  return { qrString, amount, method: 'local-payload-conversion', paymentStatus: 'unverified' };
}

// Backward compatibility helper
export const calculateCRC16 = crc16;
export const parseTLV = parse;
export const validateQRISPayload = (raw: string) => {
  try {
    const { rows, values } = inspect(raw);
    return {
      isValid: true,
      type: values['01'] === '12' ? 'DYNAMIC' as const : 'STATIC' as const,
      merchantName: values['59'] || 'MERCHANT',
      merchantCity: values['60'] || 'INDONESIA',
      amount: values['54'] ? Number(values['54']) : null,
      crc: rows.at(-1)?.value || '',
      tagsCount: rows.length,
    };
  } catch (e: any) {
    return {
      isValid: false,
      error: e.message,
    };
  }
};
export const convertStaticToDynamicQRIS = (raw: string, amount: number, inv?: string, opts?: any) => {
  try {
    return createQris(raw, amount, { providerConfirmed: true }).qrString;
  } catch (_) {
    return generateDynamicQRIS({
      amount,
      invoiceNumber: inv,
      merchantName: opts?.merchantName,
      gateway: opts?.gateway,
    });
  }
};

export const generateDynamicQRIS = (params: { 
  amount: number; 
  merchantName?: string; 
  merchantCity?: string; 
  invoiceNumber?: string; 
  nmid?: string;
  gateway?: string;
}) => {
  const enc = (tag: string, val: string) => tag + String(val.length).padStart(2, '0') + val;
  const gateway = (params.gateway || '').toUpperCase();
  const isPakasir = gateway === 'PAKASIR';
  const isQiospay = gateway === 'QIOSPAY';

  const inv = (params.invoiceNumber || `INV${Date.now()}`).replace(/[^a-zA-Z0-9]/g, '');
  const invSuffix = inv.slice(-8).padStart(8, '0');

  let tag26 = '';
  let tag51 = '';

  if (isQiospay) {
    // Qiospay QRIS: Menggunakan Acquirer Nobu Bank dan NMID Qiospay
    tag26 = enc('00', 'COM.NOBUBANK.WWW') + 
            enc('01', '936005030000090718') + 
            enc('02', '000000000000000') + 
            enc('03', 'UMI');
    tag51 = enc('00', 'ID.CO.QRIS.WWW') + 
            enc('01', params.nmid || 'ID1026524496431') + 
            enc('02', '00000000');
  } else if (isPakasir) {
    // Pakasir QRIS: Menggunakan Standar Nasional ASPI / Pakasir (Bebas dari LinkAja/Nobu Bank)
    tag26 = enc('00', 'ID.CO.QRIS.WWW') + 
            enc('01', `9360099900${invSuffix}`) + 
            enc('02', '000000000000000') + 
            enc('03', 'UMI');
    if (params.nmid && params.nmid.trim()) {
      tag51 = enc('00', 'ID.CO.QRIS.WWW') + 
              enc('01', params.nmid.trim()) + 
              enc('02', '00000000');
    }
  } else {
    // Standard National Dynamic QRIS
    tag26 = enc('00', 'ID.CO.QRIS.WWW') + 
            enc('01', `9360099900${invSuffix}`) + 
            enc('02', '000000000000000') + 
            enc('03', 'UMI');
    if (params.nmid && params.nmid.trim()) {
      tag51 = enc('00', 'ID.CO.QRIS.WWW') + 
              enc('01', params.nmid.trim()) + 
              enc('02', '00000000');
    }
  }

  // Nama merchant resmi sesuai gateway yang aktif
  const defaultMerchant = isQiospay 
    ? 'WAROENG DIGITAL QP48797' 
    : (isPakasir ? 'WAYAHE DIGITAL' : 'WAYAHE DIGITAL');
  const merchantName = (params.merchantName || defaultMerchant).substring(0, 25).toUpperCase();
  const merchantCity = (params.merchantCity || 'SURABAYA').substring(0, 15).toUpperCase();
  const tag62 = enc('01', inv.substring(0, 20)) + enc('07', 'A01');

  let prefix = enc('00', '01') + 
               enc('01', '12') + 
               enc('26', tag26);

  if (tag51) {
    prefix += enc('51', tag51);
  }

  prefix += enc('52', '5411') + 
            enc('53', '360') + 
            enc('54', String(Math.round(params.amount))) + 
            enc('58', 'ID') + 
            enc('59', merchantName) + 
            enc('60', merchantCity) + 
            enc('61', '60119') + 
            enc('62', tag62) + 
            '6304';

  return prefix + crc16(prefix);
};
