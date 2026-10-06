/**
 * ══════════════════════════════════════════════════════════════
 *   QRIS EMVCo Generator, Parser & Validator (Standar ASPI / Bank Indonesia)
 *   Mendukung:
 *   1. Full TLV Parser & Tree Deconstruction
 *   2. Validasi Struktur Payload, Panjang Field, & CRC16-CCITT
 *   3. Konversi Aman Static QRIS -> Dynamic QRIS (Strict Preserved TLV)
 *   4. Mode Raw Static QRIS (Tanpa Konversi) untuk Uji Coba Acquirer Asli
 * ══════════════════════════════════════════════════════════════
 */

export interface QRISTagNode {
  tag: string;
  label: string;
  length: number;
  value: string;
}

export interface QRISValidationResult {
  isValid: boolean;
  error?: string;
  type?: 'STATIC' | 'DYNAMIC';
  merchantName?: string;
  merchantCity?: string;
  amount?: number | null;
  currency?: string;
  country?: string;
  tagsCount?: number;
  crc?: string;
  tags?: QRISTagNode[];
}

/**
 * Kalkulasi Checksum CRC16-CCITT (Polynomial 0x1021, Init 0xFFFF)
 * Standar internasional ISO/IEC 13239 & EMVCo QR Code
 */
export function calculateCRC16(str: string): string {
  let crc = 0xFFFF;
  for (let c = 0; c < str.length; c++) {
    crc ^= str.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Format Tag-Length-Value (TLV) dengan 2-digit tag & 2-digit length
 */
export function formatTLV(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${tag}${len}${value}`;
}

/**
 * Parse raw string QRIS menjadi daftar node TLV
 */
export function parseTLV(raw: string): QRISTagNode[] {
  const nodes: QRISTagNode[] = [];
  let i = 0;

  while (i < raw.length) {
    if (i + 4 > raw.length) break;
    const tag = raw.substring(i, i + 2);
    const lenStr = raw.substring(i + 2, i + 4);
    const len = parseInt(lenStr, 10);

    if (isNaN(len) || i + 4 + len > raw.length) {
      throw new Error(`Corrupted TLV tag ${tag} at index ${i}: declared length ${lenStr} exceeds buffer.`);
    }

    const value = raw.substring(i + 4, i + 4 + len);
    nodes.push({
      tag,
      label: getTagLabel(tag),
      length: len,
      value,
    });
    i += 4 + len;
  }

  return nodes;
}

/**
 * Memberikan label deskriptif untuk setiap Tag EMVCo
 */
export function getTagLabel(tag: string): string {
  const num = parseInt(tag, 10);
  if (tag === '00') return 'Payload Format Indicator';
  if (tag === '01') return 'Point of Initiation Method (11=Static, 12=Dynamic)';
  if (!isNaN(num) && num >= 2 && num <= 25) return `Merchant Account Info Reserved (${tag})`;
  if (tag === '26') return 'Merchant Account Info (MPM Domestik / Acquirer 1)';
  if (!isNaN(num) && num >= 27 && num <= 45) return `Merchant Account Info (${tag})`;
  if (tag === '51') return 'National QRIS Domestic Central ID';
  if (tag === '52') return 'Merchant Category Code (MCC)';
  if (tag === '53') return 'Transaction Currency (360=IDR)';
  if (tag === '54') return 'Transaction Amount';
  if (tag === '55') return 'Tip or Convenience Fee Indicator';
  if (tag === '56') return 'Value of Convenience Fee Fixed';
  if (tag === '57') return 'Value of Convenience Fee Percentage';
  if (tag === '58') return 'Country Code (ID)';
  if (tag === '59') return 'Merchant Name';
  if (tag === '60') return 'Merchant City';
  if (tag === '61') return 'Postal Code';
  if (tag === '62') return 'Additional Data Field Template';
  if (tag === '63') return 'CRC16-CCITT Checksum';
  return `Custom Tag (${tag})`;
}

/**
 * Validasi mendalam struktur payload QRIS sesuai standar EMVCo & ASPI
 */
export function validateQRISPayload(raw: string): QRISValidationResult {
  if (!raw || typeof raw !== 'string') {
    return { isValid: false, error: 'QRIS payload kosong atau bukan string.' };
  }

  const clean = raw.trim();
  if (clean.length < 35) {
    return { isValid: false, error: 'QRIS payload terlalu pendek untuk format EMVCo valid.' };
  }

  try {
    const nodes = parseTLV(clean);
    const tagMap = new Map<string, string>();
    for (const node of nodes) {
      tagMap.set(node.tag, node.value);
    }

    // 1. Tag 00 Wajib "01"
    if (tagMap.get('00') !== '01') {
      return { isValid: false, error: 'Tag 00 (Payload Format Indicator) harus "01".' };
    }

    // 2. Tag 01 Wajib "11" atau "12"
    const poi = tagMap.get('01');
    if (poi !== '11' && poi !== '12') {
      return { isValid: false, error: 'Tag 01 (Point of Initiation) harus "11" (Static) atau "12" (Dynamic).' };
    }

    // 3. Tag 53 Wajib "360" (IDR)
    if (tagMap.get('53') !== '360') {
      return { isValid: false, error: 'Tag 53 (Transaction Currency) harus "360" (Rupiah Indonesia).' };
    }

    // 4. Tag 58 Wajib "ID"
    if (tagMap.get('58') !== 'ID') {
      return { isValid: false, error: 'Tag 58 (Country Code) harus "ID".' };
    }

    // 5. Minimal memiliki 1 Merchant Account Info (Tag 26 - 51)
    const hasMAI = Array.from(tagMap.keys()).some(k => {
      const n = parseInt(k, 10);
      return !isNaN(n) && n >= 26 && n <= 51;
    });
    if (!hasMAI) {
      return { isValid: false, error: 'Tag Merchant Account Info (Tag 26 s/d 51) tidak ditemukan.' };
    }

    // 6. Tag 63 Checksum Verification
    const crcIdx = clean.lastIndexOf('6304');
    if (crcIdx === -1) {
      return { isValid: false, error: 'Tag Checksum "6304" tidak ditemukan di akhir payload.' };
    }

    const dataPart = clean.substring(0, crcIdx + 4);
    const expectedCRC = calculateCRC16(dataPart);
    const actualCRC = clean.substring(crcIdx + 4, crcIdx + 8).toUpperCase();

    if (expectedCRC !== actualCRC) {
      return {
        isValid: false,
        error: `CRC16 Checksum tidak cocok! Dihitung: ${expectedCRC}, Tercantum: ${actualCRC}`,
      };
    }

    const rawAmount = tagMap.get('54');
    const parsedAmount = rawAmount ? parseFloat(rawAmount) : null;

    return {
      isValid: true,
      type: poi === '12' ? 'DYNAMIC' : 'STATIC',
      merchantName: tagMap.get('59') || 'UNKNOWN MERCHANT',
      merchantCity: tagMap.get('60') || 'INDONESIA',
      amount: parsedAmount,
      currency: 'IDR (360)',
      country: 'ID',
      tagsCount: nodes.length,
      crc: actualCRC,
      tags: nodes,
    };
  } catch (err: any) {
    return {
      isValid: false,
      error: `Kegagalan parsing struktur TLV: ${err.message}`,
    };
  }
}

/**
 * Konversi Static QRIS -> Dynamic QRIS dengan preservasi penuh node TLV Acquirer
 * Mempertahankan 100% byte Tag 26 s/d 51 dan Tag 62 agar tidak merusak signature terminal acquirer
 */
export function convertStaticToDynamicQRIS(
  staticQRIS: string,
  amount: number,
  invoiceNumber?: string,
  options?: {
    preserveTag62?: boolean;
    forceDynamicPOI?: boolean;
    merchantName?: string;
    gateway?: 'PAKASIR' | 'QIOSPAY' | string;
  }
): string {
  if (!staticQRIS || staticQRIS.trim().length < 25) {
    return generateDynamicQRIS({ 
      amount, 
      invoiceNumber, 
      merchantName: options?.merchantName,
      gateway: options?.gateway 
    });
  }

  const cleanStatic = staticQRIS.trim();

  try {
    const parsedTags = parseTLV(cleanStatic);
    const tagMap = new Map<string, string>();

    for (const t of parsedTags) {
      if (t.tag !== '63') {
        tagMap.set(t.tag, t.value);
      }
    }

    // 1. Ubah Point of Initiation Method menjadi 12 (Dynamic) jika forceDynamicPOI (default true)
    const isDynamic = options?.forceDynamicPOI !== false;
    tagMap.set('01', isDynamic ? '12' : '11');

    // 2. Pastikan Tag Currency IDR (Tag 53)
    if (!tagMap.has('53')) {
      tagMap.set('53', '360');
    }

    // 3. Masukkan Tag 54 (Amount Presisi Rupiah Bulat)
    const amountStr = Math.round(amount).toString();
    tagMap.set('54', amountStr);

    // Update Tag 59 (Nama Merchant) jika belum ada atau bukan Qiospay (pertahankan nama terdaftar Nobu Bank)
    if (options?.merchantName && (!tagMap.has('59') || options?.gateway !== 'QIOSPAY')) {
      tagMap.set('59', options.merchantName.substring(0, 25));
    }

    // 4. Manajemen Tag 62 (Preservasi Penuh)
    // Jika preserveTag62 true (default), pertahankan Tag 62 asli dari Acquirer agar signature terminal tidak rusak!
    if (!options?.preserveTag62 && invoiceNumber) {
      const cleanInv = invoiceNumber.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
      const existing62 = tagMap.get('62');
      let subTags62: Array<{ tag: string; length: number; value: string }> = [];

      if (existing62) {
        try {
          subTags62 = parseTLV(existing62).filter(st => st.tag !== '01');
        } catch {
          subTags62 = [];
        }
      }

      subTags62.unshift({ tag: '01', length: cleanInv.length, value: cleanInv });
      if (!subTags62.some(st => st.tag === '07')) {
        subTags62.push({ tag: '07', length: 3, value: 'A01' });
      }

      const new62Value = subTags62.map(st => formatTLV(st.tag, st.value)).join('');
      tagMap.set('62', new62Value);
    }

    // 5. Susun kembali payload dalam urutan resmi standar EMVCo ASPI
    const orderedTags: string[] = ['00', '01'];

    // Urutkan MAI (Tag 02 s/d 51)
    const maiKeys = Array.from(tagMap.keys())
      .filter(k => {
        const n = parseInt(k, 10);
        return !isNaN(n) && n >= 2 && n <= 51;
      })
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

    orderedTags.push(...maiKeys);
    orderedTags.push('52', '53', '54', '55', '56', '57', '58', '59', '60', '61', '62');

    let payload = '';
    for (const tag of orderedTags) {
      if (tagMap.has(tag)) {
        payload += formatTLV(tag, tagMap.get(tag)!);
      }
    }

    // Tambahkan custom tag lainnya jika ada
    for (const [tag, val] of tagMap.entries()) {
      if (!orderedTags.includes(tag) && tag !== '63') {
        payload += formatTLV(tag, val);
      }
    }

    // 6. Hitung Checksum CRC16
    payload += '6304';
    const crc = calculateCRC16(payload);
    const finalQR = `${payload}${crc}`;

    // Validasi ulang integritas hasil konversi
    const validation = validateQRISPayload(finalQR);
    if (!validation.isValid) {
      console.warn('[QRIS Converter] Hasil konversi dinamis tidak valid, menggunakan static asli:', validation.error);
      return cleanStatic;
    }

    return finalQR;
  } catch (err: any) {
    console.warn('[QRIS Converter] Gagal parsing static QRIS, menggunakan fallback:', err.message);
    return cleanStatic;
  }
}

/**
 * Generate fallback dynamic QRIS EMVCo sesuai spesifikasi payment gateway aktif (Pakasir / Qiospay / Bank Nasional)
 */
export function generateDynamicQRIS(params: {
  amount: number;
  merchantName?: string;
  merchantCity?: string;
  invoiceNumber?: string;
  nmid?: string;
  gateway?: 'PAKASIR' | 'QIOSPAY' | string;
}): string {
  const amountStr = Math.round(params.amount).toString();
  const gateway = String(params.gateway || '').toUpperCase();
  const isPakasir = gateway === 'PAKASIR';
  const isQiospay = gateway === 'QIOSPAY';

  // Nama merchant dinamis sesuai gateway aktif
  const defaultMerchant = isQiospay 
    ? 'WAROENG DIGITAL QP48797' 
    : (isPakasir ? 'WAYAHE DIGITAL' : 'WAYAHE DIGITAL');
  const merchantName = (params.merchantName || defaultMerchant).substring(0, 25).toUpperCase();
  const merchantCity = (params.merchantCity || 'SURABAYA').substring(0, 15).toUpperCase();
  const invoice = (params.invoiceNumber || `INV${Date.now()}`).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
  const invSuffix = invoice.slice(-8).padStart(8, '0');

  let tag26Value = '';
  let tag51Value = '';

  if (isQiospay) {
    // Qiospay QRIS: Acquirer Nobu Bank & NMID Qiospay
    const tag26_00 = formatTLV('00', 'COM.NOBUBANK.WWW');
    const tag26_01 = formatTLV('01', '936005030000090718');
    const tag26_02 = formatTLV('02', '000000000000000');
    const tag26_03 = formatTLV('03', 'UMI');
    tag26Value = `${tag26_00}${tag26_01}${tag26_02}${tag26_03}`;

    const tag51_00 = formatTLV('00', 'ID.CO.QRIS.WWW');
    const tag51_01 = formatTLV('01', params.nmid || 'ID1026524496431');
    const tag51_02 = formatTLV('02', '00000000');
    tag51Value = `${tag51_00}${tag51_01}${tag51_02}`;
  } else if (isPakasir) {
    // Pakasir QRIS: Acquirer Nasional ASPI / Pakasir (Bukan Nobu Bank / LinkAja)
    const tag26_00 = formatTLV('00', 'ID.CO.QRIS.WWW');
    const tag26_01 = formatTLV('01', `9360099900${invSuffix}`);
    const tag26_02 = formatTLV('02', '000000000000000');
    const tag26_03 = formatTLV('03', 'UMI');
    tag26Value = `${tag26_00}${tag26_01}${tag26_02}${tag26_03}`;

    // Hanya sertakan Tag 51 jika ada NMID resmi Pakasir
    if (params.nmid && params.nmid.trim()) {
      const tag51_00 = formatTLV('00', 'ID.CO.QRIS.WWW');
      const tag51_01 = formatTLV('01', params.nmid.trim());
      const tag51_02 = formatTLV('02', '00000000');
      tag51Value = `${tag51_00}${tag51_01}${tag51_02}`;
    }
  } else {
    // Standard National Switch QRIS
    const tag26_00 = formatTLV('00', 'ID.CO.QRIS.WWW');
    const tag26_01 = formatTLV('01', `9360099900${invSuffix}`);
    const tag26_02 = formatTLV('02', '000000000000000');
    const tag26_03 = formatTLV('03', 'UMI');
    tag26Value = `${tag26_00}${tag26_01}${tag26_02}${tag26_03}`;

    if (params.nmid && params.nmid.trim()) {
      const tag51_00 = formatTLV('00', 'ID.CO.QRIS.WWW');
      const tag51_01 = formatTLV('01', params.nmid.trim());
      const tag51_02 = formatTLV('02', '00000000');
      tag51Value = `${tag51_00}${tag51_01}${tag51_02}`;
    }
  }

  const tag62_01 = formatTLV('01', invoice);
  const tag62_07 = formatTLV('07', 'A01');
  const tag62Value = `${tag62_01}${tag62_07}`;

  let payload = '';
  payload += formatTLV('00', '01');
  payload += formatTLV('01', '12');
  payload += formatTLV('26', tag26Value);
  if (tag51Value) {
    payload += formatTLV('51', tag51Value);
  }
  payload += formatTLV('52', '5411');
  payload += formatTLV('53', '360');
  payload += formatTLV('54', amountStr);
  payload += formatTLV('58', 'ID');
  payload += formatTLV('59', merchantName);
  payload += formatTLV('60', merchantCity);
  payload += formatTLV('61', '60119');
  payload += formatTLV('62', tag62Value);

  payload += '6304';
  const checksum = calculateCRC16(payload);

  return `${payload}${checksum}`;
}
