/**
 * Standard RFC 6238 TOTP (Google Authenticator) Utility
 * 100% Web Crypto API Compatible & RFC 4648 Base32
 */
import QRCode from 'qrcode';

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Generate a random Base32 secret key for Google Authenticator
 */
export function generateTotpSecret(byteLength: number = 20): string {
  const randomBytes = new Uint8Array(byteLength);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < byteLength; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }

  let bits = '';
  for (let i = 0; i < randomBytes.length; i++) {
    bits += randomBytes[i].toString(2).padStart(8, '0');
  }

  let base32 = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.substr(i, 5);
    if (chunk.length < 5) break;
    const val = parseInt(chunk, 2);
    base32 += BASE32_CHARS[val];
  }

  return base32;
}

/**
 * Decode Base32 string to Uint8Array
 */
export function base32ToUint8Array(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = '';
  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_CHARS.indexOf(clean[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }

  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.substr(i * 8, 8), 2);
  }
  return bytes;
}

/**
 * Construct Google Authenticator OtpAuth URL
 * Format: otpauth://totp/Issuer:Account?secret=XXX&issuer=Issuer&algorithm=SHA1&digits=6&period=30
 */
export function getOtpAuthUrl(
  secret: string,
  accountName: string = 'admin@wayahedigital.id',
  issuer: string = 'WayaheDigital'
): string {
  const cleanSecret = secret.toUpperCase().replace(/\s+/g, '');
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${cleanSecret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generate QR Code data URL for scanning in Google Authenticator app
 */
export async function generateTotpQRCode(otpauthUrl: string): Promise<string> {
  try {
    return await QRCode.toDataURL(otpauthUrl, {
      width: 250,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('Failed to generate TOTP QR Code:', err);
    return '';
  }
}

/**
 * Generate 6-digit TOTP code for a given secret and counter
 */
export async function generateTotpCode(secret: string, timeOffsetSeconds: number = 0): Promise<string> {
  try {
    const timeSec = Math.floor(Date.now() / 1000) + timeOffsetSeconds;
    const counter = Math.floor(timeSec / 30);

    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setBigUint64(0, BigInt(counter));

    const keyBytes = base32ToUint8Array(secret);
    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );

    const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, buffer);
    const hmac = new Uint8Array(signature);

    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    return (binary % 1000000).toString().padStart(6, '0');
  } catch (e) {
    console.error('Error generating TOTP token:', e);
    return '';
  }
}

/**
 * Verify a 6-digit TOTP code against a secret
 * Window allows +- 1 period (30s) to account for slight client/server clock drifts
 */
export async function verifyTotpCode(
  inputCode: string,
  secret: string,
  windowSteps: number = 1
): Promise<boolean> {
  const cleanCode = inputCode.trim().replace(/\s+/g, '');
  if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
    return false;
  }

  // Check current time step, plus previous and next steps
  for (let step = -windowSteps; step <= windowSteps; step++) {
    const expected = await generateTotpCode(secret, step * 30);
    if (expected && expected === cleanCode) {
      return true;
    }
  }

  return false;
}
