export function detectOperator(phone: string): string | null {
  if (!phone) return null;
  // Clean phone number: remove non-digit characters, replace +62 or 62 with 0
  let clean = phone.replace(/[^0-9]/g, '');
  if (clean.startsWith('62')) {
    clean = '0' + clean.slice(2);
  }

  if (clean.length < 4) return null;
  const prefix = clean.substring(0, 4);

  // Telkomsel
  if (['0811', '0812', '0813', '0821', '0822', '0823', '0852', '0853', '0851'].includes(prefix)) {
    return 'Telkomsel';
  }
  // Indosat
  if (['0814', '0815', '0816', '0855', '0856', '0857', '0858'].includes(prefix)) {
    return 'Indosat';
  }
  // XL
  if (['0817', '0818', '0819', '0859', '0877', '0878'].includes(prefix)) {
    return 'XL';
  }
  // Axis
  if (['0831', '0832', '0833', '0838'].includes(prefix)) {
    return 'Axis';
  }
  // Tri
  if (['0895', '0896', '0897', '0898', '0899'].includes(prefix)) {
    return 'Tri';
  }
  // Smartfren
  if (['0881', '0882', '0883', '0884', '0885', '0886', '0887', '0888', '0889'].includes(prefix)) {
    return 'Smartfren';
  }

  return null;
}

export function formatRupiah(amount: number): string {
  return 'Rp ' + amount.toLocaleString('id-ID');
}

export function formatDateWIB(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Jakarta',
    }).format(d) + ' WIB';
  } catch {
    return isoDate;
  }
}

export const OPERATORS = ['Telkomsel', 'Indosat', 'XL', 'Axis', 'Tri', 'Smartfren'];
