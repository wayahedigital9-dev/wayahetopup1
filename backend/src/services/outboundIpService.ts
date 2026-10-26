import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { DIGIFLAZZ_CONFIG } from '../config/apikeys.js';
import crypto from 'crypto';
import { isIP } from 'node:net';

export interface OutboundIpStatus {
  outboundIp: string;
  configuredWhitelistIp: string;
  liveServerIp?: string;
  outboundProxy: string;
  isProxyActive: boolean;
  isWhitelisted: boolean | null;
  whitelistStatus: 'VERIFIED' | 'REJECTED' | 'UNKNOWN';
  connectionStatus: 'CONNECTED' | 'FAILED' | 'NOT_CONFIGURED';
  credentialStatus?: 'VERIFIED' | 'REJECTED' | 'UNKNOWN';
  digiflazzDetectedIp?: string;
  digiflazzMessage?: string;
  deposit?: number;
  lastChecked: string;
}

export class OutboundIpService {
  private lastStatus: OutboundIpStatus | null = null;

  /**
   * Mendapatkan Axios Client yang mendukung HTTP/HTTPS Proxy jika dikonfigurasi
   */
  public getHttpClient(customProxy?: string, timeoutMs = 8000) {
    const proxyUrl = customProxy !== undefined ? customProxy : DIGIFLAZZ_CONFIG.OUTBOUND_PROXY;
    if (proxyUrl && proxyUrl.trim().length > 0) {
      const cleanProxy = proxyUrl.trim();
      const agent = new HttpsProxyAgent(cleanProxy);
      return axios.create({
        httpsAgent: agent,
        httpAgent: agent,
        proxy: false,
        timeout: timeoutMs,
      });
    }
    return axios.create({ timeout: timeoutMs, proxy: false });
  }

  /**
   * Mendeteksi IP publik outbound server/VPS secara realtime melalui beberapa provider
   */
  async detectLiveVpsIp(customProxy?: string): Promise<string> {
    const client = this.getHttpClient(customProxy, 5000);
    const providers = [
      { url: 'https://api.ipify.org?format=json', parser: (d: any) => d?.ip },
      { url: 'https://api4.my-ip.io/ip.json', parser: (d: any) => d?.ip },
      { url: 'https://icanhazip.com', parser: (d: any) => typeof d === 'string' ? d.trim() : d },
      { url: 'https://ifconfig.me/ip', parser: (d: any) => typeof d === 'string' ? d.trim() : d },
    ];

    for (const p of providers) {
      try {
        const res = await client.get(p.url);
        const parsed = p.parser(res.data);
        if (parsed && typeof parsed === 'string') {
          const candidate = parsed.trim();
          if (isIP(candidate)) {
            return candidate;
          }
        }
      } catch (_) {
        // Coba provider berikutnya
      }
    }

    throw new Error('Tidak dapat mendeteksi IP publik outbound server. IP konfigurasi bukan hasil deteksi live.');
  }

  /**
   * Deteksi IP Publik keluar (Outbound IP) dari server ini.
   * Hanya hasil deteksi jaringan live; IP whitelist terkonfigurasi bukan bukti IP outbound.
   */
  async detectOutboundIp(customProxy?: string): Promise<string> {
    return this.detectLiveVpsIp(customProxy);
  }

  /**
   * Tes langsung ke Digiflazz Buyer API untuk memastikan apakah IP server sudah masuk Whitelist
   */
  async checkDigiflazzWhitelist(customProxy?: string): Promise<OutboundIpStatus> {
    const proxyUrl = customProxy !== undefined ? customProxy : (DIGIFLAZZ_CONFIG.OUTBOUND_PROXY || '');
    const configuredIp = (DIGIFLAZZ_CONFIG.WHITELIST_IP || '').trim();
    let liveServerIp = '';
    try {
      liveServerIp = await this.detectLiveVpsIp(proxyUrl);
    } catch (_) {}
    const outboundIp = liveServerIp;

    const username = DIGIFLAZZ_CONFIG.USERNAME;
    const apiKey = DIGIFLAZZ_CONFIG.API_KEY;

    if (!username || username.startsWith('YOUR_') || !apiKey) {
      const status: OutboundIpStatus = {
        outboundIp,
        configuredWhitelistIp: configuredIp,
        liveServerIp,
        outboundProxy: proxyUrl,
        isProxyActive: Boolean(proxyUrl),
        isWhitelisted: null,
        whitelistStatus: 'UNKNOWN',
        connectionStatus: 'NOT_CONFIGURED',
        digiflazzMessage: 'Kredensial Digiflazz belum dikonfigurasi untuk mode aktif.',
        lastChecked: new Date().toISOString(),
      };
      this.lastStatus = status;
      return status;
    }

    const sign = crypto.createHash('md5').update(`${username}${apiKey}depo`).digest('hex');
    const client = this.getHttpClient(proxyUrl, 10000);

    try {
      const response = await client.post(`${DIGIFLAZZ_CONFIG.BASE_URL}/cek-saldo`, {
        cmd: 'deposit',
        username,
        sign,
      });

      const data = response.data?.data;
      if (data && data.deposit !== undefined && data.deposit !== null && data.deposit !== '' && Number.isFinite(Number(data.deposit)) && (!data.rc || String(data.rc) === '00')) {
        const status: OutboundIpStatus = {
          outboundIp,
          configuredWhitelistIp: configuredIp,
          liveServerIp,
          outboundProxy: proxyUrl,
          isProxyActive: Boolean(proxyUrl),
          isWhitelisted: true,
          whitelistStatus: 'VERIFIED',
          connectionStatus: 'CONNECTED',
          credentialStatus: 'VERIFIED',
          digiflazzDetectedIp: outboundIp,
          digiflazzMessage: 'Koneksi Digiflazz dan akses whitelist terverifikasi melalui cek saldo.',
          deposit: Number(data.deposit || 0),
          lastChecked: new Date().toISOString(),
        };
        this.lastStatus = status;
        return status;
      }

      // Periksa kode respon Digiflazz
      const rc = data?.rc;
      const msg = data?.message || 'Gagal verifikasi saldo Digiflazz';
      const ipMatch = msg.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
      const detectedIp = ipMatch ? ipMatch[1] : outboundIp;

      const ipRejected = String(rc) === '45' || String(msg).toLowerCase().includes('ip anda tidak kami kenali');

      const status: OutboundIpStatus = {
        outboundIp,
        configuredWhitelistIp: configuredIp,
        liveServerIp,
        outboundProxy: proxyUrl,
        isProxyActive: Boolean(proxyUrl),
        isWhitelisted: ipRejected ? false : null,
        whitelistStatus: ipRejected ? 'REJECTED' : 'UNKNOWN',
        connectionStatus: 'FAILED',
        credentialStatus: /signature/i.test(String(msg)) ? 'REJECTED' : 'UNKNOWN',
        digiflazzDetectedIp: detectedIp,
        digiflazzMessage: msg,
        lastChecked: new Date().toISOString(),
      };
      this.lastStatus = status;
      return status;
    } catch (err: any) {
      const respData = err.response?.data?.data || err.response?.data;
      const msg = respData?.message || err.message;
      const rc = respData?.rc;
      const ipMatch = msg.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
      const detectedIp = ipMatch ? ipMatch[1] : outboundIp;

      const ipRejected = String(rc) === '45' || String(msg).toLowerCase().includes('ip anda tidak kami kenali');

      const status: OutboundIpStatus = {
        outboundIp,
        configuredWhitelistIp: configuredIp,
        liveServerIp,
        outboundProxy: proxyUrl,
        isProxyActive: Boolean(proxyUrl),
        isWhitelisted: ipRejected ? false : null,
        whitelistStatus: ipRejected ? 'REJECTED' : 'UNKNOWN',
        connectionStatus: 'FAILED',
        credentialStatus: /signature/i.test(String(msg)) ? 'REJECTED' : 'UNKNOWN',
        digiflazzDetectedIp: detectedIp,
        digiflazzMessage: rc === '45' 
          ? `⚠️ IP ${detectedIp} belum terdaftar di whitelist Digiflazz. Daftarkan di member.digiflazz.com.`
          : `Respon Digiflazz: ${msg}`,
        lastChecked: new Date().toISOString(),
      };
      this.lastStatus = status;
      return status;
    }
  }

  /**
   * Simpan IP Whitelist & Proxy ke file .env
   */
  async updateConfig(whitelistIp?: string, outboundProxy?: string): Promise<{ success: boolean; message: string }> {
    try {
      const cleanIp = (whitelistIp || '').trim();
      const cleanProxy = (outboundProxy || '').trim();

      if (cleanIp) {
        DIGIFLAZZ_CONFIG.WHITELIST_IP = cleanIp;
        process.env.DIGIFLAZZ_WHITELIST_IP = cleanIp;
      }

      DIGIFLAZZ_CONFIG.OUTBOUND_PROXY = cleanProxy;
      process.env.DIGIFLAZZ_OUTBOUND_PROXY = cleanProxy;

      // Update backend/.env file
      const envPath = path.join(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        let content = fs.readFileSync(envPath, 'utf8');

        // Update DIGIFLAZZ_WHITELIST_IP
        if (cleanIp) {
          if (content.includes('DIGIFLAZZ_WHITELIST_IP=')) {
            content = content.replace(/DIGIFLAZZ_WHITELIST_IP=["']?.*?["']?(\r?\n|$)/, `DIGIFLAZZ_WHITELIST_IP="${cleanIp}"$1`);
          } else {
            content += `\nDIGIFLAZZ_WHITELIST_IP="${cleanIp}"\n`;
          }
        }

        // Update DIGIFLAZZ_OUTBOUND_PROXY
        if (content.includes('DIGIFLAZZ_OUTBOUND_PROXY=')) {
          content = content.replace(/DIGIFLAZZ_OUTBOUND_PROXY=["']?.*?["']?(\r?\n|$)/, `DIGIFLAZZ_OUTBOUND_PROXY="${cleanProxy}"$1`);
        } else {
          content += `\nDIGIFLAZZ_OUTBOUND_PROXY="${cleanProxy}"\n`;
        }

        fs.writeFileSync(envPath, content, 'utf8');
      }

      console.log(`✅ [OUTBOUND IP CONFIG] Konfigurasi IP diperbarui: Whitelist IP=${cleanIp}, Proxy=${cleanProxy || '(Direct Host)'}`);
      return { success: true, message: 'Konfigurasi IP & Proxy Digiflazz berhasil disimpan.' };
    } catch (err: any) {
      console.error('❌ [OUTBOUND IP CONFIG ERROR]:', err.message);
      return { success: false, message: `Gagal menyimpan konfigurasi: ${err.message}` };
    }
  }
}

export const outboundIpService = new OutboundIpService();
