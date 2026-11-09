import axios from 'axios';
import { mongoDbService } from './mongodbService.js';
import { supabaseService } from './supabaseService.js';
import { createPaymentSession, detectActiveGateway } from './paymentRouter.js';
import { BOT_CONFIG } from '../config/apikeys.js';
import { resolveManualCheckout } from './manualCheckout.js';
import crypto from 'node:crypto';

export interface TelegramBotConfig {
  botToken: string;
  chatId: string;
  botUsername: string;
  storeEnabled: boolean;
  storeMode: 'webhook' | 'polling';
  webhookUrl: string;
  webAppUrl: string;
  welcomeMessage: string;
  csUsername: string;
  channelUrl: string;
  alertsEnabled: boolean;
}

interface UserShoppingSession {
  step: 'IDLE' | 'AWAITING_TARGET' | 'AWAITING_STATUS_INVOICE';
  category?: string;
  provider?: string;
  productId?: string;
  productName?: string;
  price?: number;
  lastInvoice?: string;
  updatedAt: number;
}

const formatRupiah = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
};

export class TelegramBotService {
  private config: TelegramBotConfig;
  private sessions = new Map<string, UserShoppingSession>();
  private isPolling = false;
  private pollingTimeout: NodeJS.Timeout | null = null;
  private lastUpdateId = 0;
  private qrPhotoMsgByOrder = new Map<string, { chatId: string | number; messageId: number }>();

  constructor() {
    this.config = {
      botToken: BOT_CONFIG.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '',
      chatId: BOT_CONFIG.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '',
      botUsername: process.env.TELEGRAM_BOT_USERNAME || '',
      storeEnabled: true,
      storeMode: 'webhook',
      webhookUrl: process.env.TELEGRAM_WEBHOOK_URL || '',
      webAppUrl: process.env.TELEGRAM_WEBAPP_URL || process.env.APP_URL || 'https://wayahetopup.my.id',
      welcomeMessage: '',
      csUsername: process.env.TELEGRAM_CS_USERNAME || '',
      channelUrl: process.env.TELEGRAM_CHANNEL_URL || '',
      alertsEnabled: true,
    };
  }

  public refreshConfig(newConfig: Partial<TelegramBotConfig>) {
    this.config = { ...this.config, ...newConfig };
    if (newConfig.botToken) {
      BOT_CONFIG.TELEGRAM_TOKEN = newConfig.botToken;
    }
    if (newConfig.chatId) {
      BOT_CONFIG.TELEGRAM_CHAT_ID = newConfig.chatId;
    }
  }

  public getConfig(): TelegramBotConfig {
    return { ...this.config };
  }

  public isConfigured(): boolean {
    return Boolean(this.config.botToken && this.config.botToken.includes(':'));
  }

  /**
   * Helper pemanggil Telegram Bot API
   */
  private async callApi(method: string, payload: any = {}): Promise<any> {
    const token = this.config.botToken;
    if (!token) return { ok: false, description: 'Bot token belum diisi' };

    try {
      const url = `https://api.telegram.org/bot${token}/${method}`;
      const res = await axios.post(url, payload, { timeout: 15000 });
      return res.data;
    } catch (err: any) {
      const desc = err.response?.data?.description || err.message;
      console.warn(`[Telegram Bot API Error] ${method}:`, desc);
      return { ok: false, description: desc };
    }
  }

  public async getMe(): Promise<any> {
    return await this.callApi('getMe');
  }

  public async setWebhook(url: string): Promise<any> {
    this.config.webhookUrl = url;
    return await this.callApi('setWebhook', { url });
  }

  public async deleteWebhook(): Promise<any> {
    return await this.callApi('deleteWebhook');
  }

  public async sendMessage(chatId: string | number, text: string, options: any = {}): Promise<any> {
    return await this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...options,
    });
  }

  public async sendPhoto(chatId: string | number, photo: string, caption: string, options: any = {}): Promise<any> {
    return await this.callApi('sendPhoto', {
      chat_id: chatId,
      photo,
      caption,
      parse_mode: 'HTML',
      ...options,
    });
  }

  public async deleteMessage(chatId: string | number, messageId: number): Promise<any> {
    return await this.callApi('deleteMessage', {
      chat_id: chatId,
      message_id: messageId,
    });
  }

  public async editMessageText(chatId: string | number, messageId: number, text: string, options: any = {}): Promise<any> {
    return await this.callApi('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      ...options,
    });
  }

  public async answerCallbackQuery(callbackQueryId: string, text?: string, showAlert = false): Promise<any> {
    return await this.callApi('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // PRODUK DARI DATABASE WEBSITE
  // ─────────────────────────────────────────────────────────────
  private async getWebsiteProducts(): Promise<any[]> {
    try {
      const state = await mongoDbService.getAllState();
      const list = Array.isArray(state?.products) ? state.products : Object.values(state?.products || {});
      return list.filter((p: any) => p.isActive !== false);
    } catch (err) {
      console.error('[TelegramBot] Gagal mengambil katalog produk:', err);
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────
  // UPDATE DISPATCHER (WEBHOOK & POLLING)
  // ─────────────────────────────────────────────────────────────
  public async handleUpdate(update: any) {
    if (!update) return;

    // Handle Callback Query (tombol inline ditekan)
    if (update.callback_query) {
      await this.processCallbackQuery(update.callback_query);
      return;
    }

    // Handle Pesan Teks
    if (update.message) {
      await this.processMessage(update.message);
      return;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // MESSAGE PROCESSOR (/start, /katalog, /status, /cs, text input)
  // ─────────────────────────────────────────────────────────────
  private async processMessage(message: any) {
    const chatId = message.chat?.id;
    if (!chatId) return;

    const text = (message.text || '').trim();
    const from = message.from || {};
    const firstName = from.first_name || 'Pelanggan';

    // Bersihkan sesi lama (> 30 menit)
    const session = this.sessions.get(String(chatId));
    if (session && Date.now() - session.updatedAt > 30 * 60 * 1000) {
      this.sessions.delete(String(chatId));
    }

    // 1. COMMAND /start (tampilkan statistik akun & bot di pesan sambutan)
    if (text.startsWith('/start')) {
      this.sessions.set(String(chatId), { step: 'IDLE', updatedAt: Date.now() });
      try {
        const state = await mongoDbService.getAllState();
        const orders = Array.isArray(state?.orders) ? state.orders : Object.values(state?.orders || {});
        const totalOrder = orders.length;
        const totalPenjualan = orders.reduce((s,o:any) => s + (Number(o.totalAmount||0)), 0);
        const users = new Set(orders.map((o:any)=>o.telegramChatId||o.customerId||o.id).filter(Boolean));
        const statsText =
          `\n━━━━━━━━━━━━━━━━━━━━━\n` +
          `📊 <b>Statistik Toko Anda</b>\n` +
          `• Total Order: <b>${totalOrder}</b>\n` +
          `• Total Penjualan: <b>Rp ${totalPenjualan.toLocaleString('id-ID')}</b>\n` +
          `• Total Pengguna Bot: <b>${users.size}</b>`;
        await this.sendMainMenu(chatId, firstName, statsText);
      } catch (_) {
        await this.sendMainMenu(chatId, firstName);
      }
    // COMMAND /stock
    if (text === '/stock') {
      this.sessions.set(String(chatId), { step: 'IDLE', updatedAt: Date.now() });
      await this.sendCategorySelection(chatId);
      return;
    }

    // COMMAND /saldo
    if (text === '/saldo') {
      const bal = 'Saldo Anda akan ditampilkan setelah login di WebApp Toko.';
      await this.sendMessage(chatId, `💰 <b>Cek Saldo & Deposit</b>\n\n${bal}\n\nKlik tombol <b>Buka Toko Mini App</b> di menu untuk melihat saldo realtime dan melakukan top up saldo.`);
      return;
    }

    // COMMAND /id
    if (text === '/id') {
      await this.sendMessage(chatId, `🆔 <b>Chat ID Anda</b>\n\nKode chat: <code>${chatId}</code>\nGunakan kode ini untuk verifikasi atau hubungi admin.`);
      return;
    }

    // COMMAND /waktu (tampilkan waktu & tanggal lokal)
    if (text === '/waktu') {
      const now = new Date();
      const opsi = { weekday:'long' as const, year:'numeric' as const, month:'long' as const, day:'numeric' as const, hour:'2-digit' as const, minute:'2-digit' as const, second:'2-digit' as const, timeZone:'Asia/Jakarta' };
      await this.sendMessage(chatId, `🕒 <b>Waktu & Tanggal Lokal</b>\n\n${now.toLocaleString('id-ID', opsi)} WIB\n\nAtur zona waktu di pengaturan akun di WebApp Toko agar notifikasi & pesanan tertimestamp dengan benar.`);
      return;
    }

    // COMMAND /statistik (akun & bot)
    if (text === '/statistik') {
      try {
        const state = await mongoDbService.getAllState();
        const orders = Array.isArray(state?.orders) ? state.orders : Object.values(state?.orders || {});
        const totalOrder = orders.length;
        const totalPenjualan = orders.reduce((s,o:any) => s + (Number(o.totalAmount||0)), 0);
        const users = new Set(orders.map((o:any)=>o.telegramChatId||o.customerId||o.id).filter(Boolean));
        const saldoAktif = 'Tersinkron via WebApp Toko';
        const text =
          `📊 <b>Statistik Akun & Bot</b>\n\n` +
          `👤 <b>Akun:</b>\n` +
          `• Saldo Aktif: <code>${saldoAktif}</code>\n` +
          `• Total Order: <b>${totalOrder}</b>\n` +
          `• Total Penjualan: <b>Rp ${totalPenjualan.toLocaleString('id-ID')}</b>\n\n` +
          `🤖 <b>Bot:</b>\n` +
          `• Total Pengguna: <b>${users.size}</b>\n` +
          `• Total Penjualan: <b>Rp ${totalPenjualan.toLocaleString('id-ID')}</b>\n`;
        await this.sendMessage(chatId, text);
      } catch (e: any) {
        await this.sendMessage(chatId, `❌ Gagal memuat statistik: ${e.message}`);
      }
      return;
    }

    // COMMAND /kontak
    if (text === '/kontak') {
      await this.sendCsInfo(chatId);
      return;
    }

      return;
    }

    // 2. COMMAND /katalog
    if (text === '/katalog') {
      await this.sendCategorySelection(chatId);
      return;
    }

    // 3. COMMAND /status
    if (text.startsWith('/status')) {
      const parts = text.split(/\s+/);
      if (parts.length > 1) {
        await this.handleCheckOrder(chatId, parts[1]);
      } else {
        this.sessions.set(String(chatId), { step: 'AWAITING_STATUS_INVOICE', updatedAt: Date.now() });
        await this.sendMessage(chatId, '🔍 <b>Cek Status Pesanan</b>\n\nSilakan ketik <b>Nomor Invoice</b> pesanan Anda (contoh: <code>INV/20261108/WD/1234</code>):');
      }
      return;
    }

    // 4. COMMAND /cs atau /bantuan
    if (text === '/cs' || text === '/bantuan') {
      await this.sendCsInfo(chatId);
      return;
    }

    // 5. COMMAND /ping
    if (text === '/ping') {
      await this.sendMessage(chatId, '🏓 <b>Pong!</b> Bot Toko WayaheDigital aktif & terhubung secara realtime ke website. ⚡');
      return;
    }

    // 6. SEDANG MENUNGGU TARGET TRANSAKSI (AWAITING_TARGET)
    if (session?.step === 'AWAITING_TARGET' && session.productId) {
      await this.handleTargetInput(chatId, text, session, from);
      return;
    }

    // 7. SEDANG MENUNGGU NOMOR INVOICE CEK STATUS
    if (session?.step === 'AWAITING_STATUS_INVOICE') {
      this.sessions.delete(String(chatId));
      await this.handleCheckOrder(chatId, text);
      return;
    }

    // Fallback pesan umum
    await this.sendMessage(
      chatId,
      `Halo <b>${firstName}</b>! 👋\nPerintah tidak dikenali. Ketik /start untuk membuka Menu Toko, atau /katalog untuk melihat produk kami.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🛍️ Buka Menu Toko', callback_data: 'nav_home' }],
          ],
        },
      }
    );
  }

  // ─────────────────────────────────────────────────────────────
  // CALLBACK QUERY PROCESSOR (Inline Buttons)
  // ─────────────────────────────────────────────────────────────
  private async processCallbackQuery(cq: any) {
    const callbackId = cq.id;
    const chatId = cq.message?.chat?.id;
    const messageId = cq.message?.message_id;
    const data = cq.data || '';

    if (!chatId) return;

    // Acknowledge callback immediately
    await this.answerCallbackQuery(callbackId);

    // Navigasi Menu Utama
    if (data === 'nav_home') {
      this.sessions.set(String(chatId), { step: 'IDLE', updatedAt: Date.now() });
      const text = this.getMainMenuText(cq.from?.first_name || 'Pelanggan');
      const keyboard = this.getMainMenuKeyboard();
      await this.editMessageText(chatId, messageId, text, { reply_markup: { inline_keyboard: keyboard } });
      return;
    }

    // Navigasi Kategori
    if (data === 'nav_cat_game') {
      await this.sendGameSelection(chatId, messageId);
      return;
    }

    if (data === 'nav_cat_pulsa') {
      await this.sendPulsaOperatorSelection(chatId, messageId, 'pulsa');
      return;
    }

    if (data === 'nav_cat_kuota') {
      await this.sendPulsaOperatorSelection(chatId, messageId, 'kuota');
      return;
    }

    if (data === 'nav_cat_premium') {
      await this.sendPremiumSelection(chatId, messageId);
      return;
    }

    if (data === 'nav_cat_pln') {
      await this.sendPlnSelection(chatId, messageId);
      return;
    }

    if (data === 'nav_cat_wifi') {
      await this.sendWifiSelection(chatId, messageId);
      return;
    }

    if (data === 'nav_check_order') {
      this.sessions.set(String(chatId), { step: 'AWAITING_STATUS_INVOICE', updatedAt: Date.now() });
      await this.sendMessage(chatId, '🔍 <b>Cek Status Pesanan</b>\n\nSilakan ketik nomor invoice Anda (contoh: <code>INV/20261108/WD/1234</code>):');
      return;
    }

    if (data === 'nav_cs') {
      await this.sendCsInfo(chatId);
      return;
    }

    // Pemilihan Provider Game (misal game_Mobile Legends)
    if (data.startsWith('game_')) {
      const provider = data.replace('game_', '');
      await this.sendProductListByProvider(chatId, messageId, 'game', provider);
      return;
    }

    // Pemilihan Provider Operator Pulsa (misal op_Telkomsel)
    if (data.startsWith('op_')) {
      const provider = data.replace('op_', '');
      await this.sendProductListByProvider(chatId, messageId, 'pulsa', provider);
      return;
    }

    // Pemilihan Produk Tertentu (prod_prm-netflix-4k)
    if (data.startsWith('prod_')) {
      const productId = data.replace('prod_', '');
      await this.handleProductSelection(chatId, productId);
      return;
    }

    // Cek Status Pembayaran Tertentu (chk_INV/...)
    if (data.startsWith('chk_')) {
      const invoice = data.replace('chk_', '');
      await this.handleCheckOrder(chatId, invoice, callbackId);
      return;
    }

    // Batalkan Pembelian
    if (data.startsWith('cancel_')) {
      this.sessions.delete(String(chatId));
      await this.sendMessage(chatId, '❌ <i>Pesanan dibatalkan. Anda dapat memilih produk lainnya kapan saja dari menu.</i>', {
        reply_markup: {
          inline_keyboard: [[{ text: '🛍️ Buka Menu Toko', callback_data: 'nav_home' }]],
        },
      });
      return;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // MENU UTAMA & TEMPLATE TEXT
  // ─────────────────────────────────────────────────────────────
  private getMainMenuText(firstName: string): string {
    const customWelcome = this.config.welcomeMessage;
    if (customWelcome && customWelcome.trim().length > 10) {
      return customWelcome.replace('{name}', firstName);
    }

    return (
      `👋 <b>Halo, ${firstName}!</b>\n` +
      `Selamat Datang di <b>WayaheDigital Store</b> 🚀\n\n` +
      `⚡ <i>Platform Top Up Game, Pulsa, Kuota, Token PLN & Akun Premium Resmi 24 Jam Nonstop!</i>\n\n` +
      `🛡️ <b>Keunggulan Berbelanja di Sini:</b>\n` +
      `• Otomatis 1-3 Detik Kilat\n` +
      `• Stok Realtime Tersinkron ke Website\n` +
      `• 100% Legal & Bergaransi Anti-Hold\n` +
      `• Bayar Instan via QRIS (Semua E-Wallet & Bank)\n\n` +
      `Silakan pilih layanan di bawah atau gunakan WebApp Toko untuk pengalaman belanja visual terlengkap:`
    );
  }

  private getMainMenuKeyboard(): any[][] {
    const webAppUrl = this.config.webAppUrl || 'https://wayahetopup.my.id';
    const storeUrl = webAppUrl.includes('?') ? `${webAppUrl}&tg=1` : `${webAppUrl}?tg=1`;

    const keyboard: any[][] = [];

    // Row 1: Tombol WebApp Mini App (Buka Toko)
    keyboard.push([
      {
        text: '🛍️ Buka Toko Mini App (Visual)',
        web_app: { url: storeUrl },
      },
    ]);

    // Row 2: Game & Pulsa & Kuota
    keyboard.push([
      { text: '🎮 Top Up Game', callback_data: 'nav_cat_game' },
      { text: '📱 Pulsa', callback_data: 'nav_cat_pulsa' },
      { text: '📶 Kuota', callback_data: 'nav_cat_kuota' },
    ]);

    // Row 3: Akun Premium & PLN
    keyboard.push([
      { text: '👑 Akun Premium', callback_data: 'nav_cat_premium' },
      { text: '⚡ Token PLN', callback_data: 'nav_cat_pln' },
    ]);

    // Row 4: WiFi Voucher & Cek Pesanan
    keyboard.push([
      { text: '📶 WiFi Voucher', callback_data: 'nav_cat_wifi' },
      { text: '🔍 Cek Status Pesanan', callback_data: 'nav_check_order' },
    ]);

    // Row 5: CS & Channel Promo
    const row5: any[] = [{ text: '💬 Hubungi CS', callback_data: 'nav_cs' }];
    if (this.config.channelUrl) {
      row5.push({ text: '📢 Channel Promo', url: this.config.channelUrl });
    }
    keyboard.push(row5);

    return keyboard;
  }

  public async sendMainMenu(chatId: string | number, firstName = 'Pelanggan', statsText = '') {
    const text = this.getMainMenuText(firstName) + statsText;
    const keyboard = this.getMainMenuKeyboard();
    await this.sendMessage(chatId, text, {
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  private async sendCategorySelection(chatId: string | number) {
    await this.sendMainMenu(chatId);
  }

  // ─────────────────────────────────────────────────────────────
  // MENU KATALOG GAME
  // ─────────────────────────────────────────────────────────────
  private async sendGameSelection(chatId: string | number, messageId?: number) {
    const text =
      `🎮 <b>Katalog Top Up Game Populer</b>\n\n` +
      `Pilih game yang ingin Anda top up dengan proses instan 1-3 detik:`;

    const keyboard = [
      [
        { text: '⚔️ Mobile Legends', callback_data: 'game_Mobile Legends' },
        { text: '🔥 Free Fire', callback_data: 'game_Free Fire' },
      ],
      [
        { text: '🎯 VALORANT', callback_data: 'game_VALORANT' },
        { text: '✨ Genshin Impact', callback_data: 'game_Genshin Impact' },
      ],
      [
        { text: '🔫 PUBG Mobile', callback_data: 'game_PUBG Mobile' },
        { text: '🧱 Roblox Robux', callback_data: 'game_Roblox' },
      ],
      [
        { text: '👑 Honor of Kings', callback_data: 'game_Honor of Kings' },
        { text: '💣 Point Blank', callback_data: 'game_Point Blank' },
      ],
      [{ text: '◀️ Kembali ke Menu Utama', callback_data: 'nav_home' }],
    ];

    if (messageId) {
      await this.editMessageText(chatId, messageId, text, { reply_markup: { inline_keyboard: keyboard } });
    } else {
      await this.sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard } });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // MENU OPERATOR PULSA & DATA
  // ─────────────────────────────────────────────────────────────
  private async sendPulsaOperatorSelection(chatId: string | number, messageId?: number, category: 'pulsa' | 'kuota' = 'pulsa') {
    const isKuota = category === 'kuota';
    const text =
      `📶 <b>${isKuota ? 'Paket Kuota Internet' : 'Pulsa & Paket Data'}</b>\n\n` +
      `Pilih operator seluler Anda untuk melihat daftar ${isKuota ? 'paket data kuota' : 'pulsa & kuota'} hemat:`;

    const keyboard = [
      [
        { text: '🔴 Telkomsel', callback_data: 'op_Telkomsel' },
        { text: '🟡 Indosat Ooredoo', callback_data: 'op_Indosat' },
      ],
      [
        { text: '🔵 XL Axiata', callback_data: 'op_XL' },
        { text: '🟣 AXIS', callback_data: 'op_Axis' },
      ],
      [
        { text: '🟠 Tri (3)', callback_data: 'op_Tri' },
        { text: '🔴 Smartfren', callback_data: 'op_Smartfren' },
      ],
      [{ text: '◀️ Kembali ke Menu Utama', callback_data: 'nav_home' }],
    ];

    if (messageId) {
      await this.editMessageText(chatId, messageId, text, { reply_markup: { inline_keyboard: keyboard } });
    } else {
      await this.sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard } });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // MENU AKUN & APLIKASI PREMIUM (DENGAN CEK STOK REALTIME)
  // ─────────────────────────────────────────────────────────────
  private async sendPremiumSelection(chatId: string | number, messageId?: number) {
    const products = await this.getWebsiteProducts();
    const premiumList = products.filter((p: any) => p.categoryId === 'premium');

    const text =
      `👑 <b>Katalog Akun & Langganan Premium</b>\n` +
      `Private akun & garansi resmi 100% anti on-screen sharing:\n\n` +
      `Silakan pilih produk premium di bawah ini:`;

    const keyboard: any[][] = [];

    // Batasi 8 produk teratas
    const displayList = premiumList.slice(0, 10);
    for (let i = 0; i < displayList.length; i += 2) {
      const row: any[] = [];
      const p1 = displayList[i];
      const p2 = displayList[i + 1];

      const stock1 = p1.stock !== undefined ? (p1.stock > 0 ? `(Stok ${p1.stock})` : '(Habis)') : '';
      row.push({
        text: `${p1.name.slice(0, 16)} ${formatRupiah(p1.sellingPrice)}`,
        callback_data: `prod_${p1.id}`,
      });

      if (p2) {
        row.push({
          text: `${p2.name.slice(0, 16)} ${formatRupiah(p2.sellingPrice)}`,
          callback_data: `prod_${p2.id}`,
        });
      }
      keyboard.push(row);
    }

    keyboard.push([{ text: '◀️ Kembali ke Menu Utama', callback_data: 'nav_home' }]);

    if (messageId) {
      await this.editMessageText(chatId, messageId, text, { reply_markup: { inline_keyboard: keyboard } });
    } else {
      await this.sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard } });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // MENU PLN & TOKEN LISTRIK
  // ─────────────────────────────────────────────────────────────
  private async sendPlnSelection(chatId: string | number, messageId?: number) {
    const products = await this.getWebsiteProducts();
    const plnList = products.filter((p: any) => p.categoryId === 'pln' || (p.provider || '').toLowerCase().includes('pln'));

    const text =
      `⚡ <b>Token Listrik PLN Prabayar</b>\n\n` +
      `Beli token PLN langsung masuk 24 jam nonstop. Pilih nominal:`;

    const keyboard: any[][] = [];
    const list = plnList.length > 0 ? plnList.slice(0, 8) : [
      { id: 'pln-20k', name: 'Token PLN 20.000', sellingPrice: 20500 },
      { id: 'pln-50k', name: 'Token PLN 50.000', sellingPrice: 50500 },
      { id: 'pln-100k', name: 'Token PLN 100.000', sellingPrice: 100500 },
      { id: 'pln-200k', name: 'Token PLN 200.000', sellingPrice: 200500 },
    ];

    for (let i = 0; i < list.length; i += 2) {
      const row: any[] = [];
      const item1 = list[i];
      const item2 = list[i + 1];

      row.push({ text: `${item1.name} - ${formatRupiah(item1.sellingPrice)}`, callback_data: `prod_${item1.id}` });
      if (item2) {
        row.push({ text: `${item2.name} - ${formatRupiah(item2.sellingPrice)}`, callback_data: `prod_${item2.id}` });
      }
      keyboard.push(row);
    }

    keyboard.push([{ text: '◀️ Kembali ke Menu Utama', callback_data: 'nav_home' }]);

    if (messageId) {
      await this.editMessageText(chatId, messageId, text, { reply_markup: { inline_keyboard: keyboard } });
    } else {
      await this.sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard } });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // MENU WIFI VOUCHER
  // ─────────────────────────────────────────────────────────────
  private async sendWifiSelection(chatId: string | number, messageId?: number) {
    const products = await this.getWebsiteProducts();
    const wifiList = products.filter((p: any) => p.categoryId === 'wifi');

    const text =
      `📶 <b>Voucher WiFi RT/RW Net</b>\n\n` +
      `Pilih paket voucher internet kilat:`;

    const keyboard: any[][] = [];
    const list = wifiList.slice(0, 6);

    for (const item of list) {
      keyboard.push([
        {
          text: `${item.name} (${item.duration || 'Aktif'}) - ${formatRupiah(item.sellingPrice)}`,
          callback_data: `prod_${item.id}`,
        },
      ]);
    }

    keyboard.push([{ text: '◀️ Kembali ke Menu Utama', callback_data: 'nav_home' }]);

    if (messageId) {
      await this.editMessageText(chatId, messageId, text, { reply_markup: { inline_keyboard: keyboard } });
    } else {
      await this.sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard } });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // DAFTAR NOMINAL SESUAI PROVIDER (GAME / PULSA)
  // ─────────────────────────────────────────────────────────────
  private async sendProductListByProvider(chatId: string | number, messageId: number, category: string, provider: string) {
    const products = await this.getWebsiteProducts();
    const filtered = products.filter((p: any) => {
      const cat = String(p.categoryId || '').toLowerCase();
      let matchCat: boolean;
      if (category === 'game') matchCat = cat === 'game';
      else if (category === 'pulsa') matchCat = cat === 'pulsa';
      else if (category === 'kuota') matchCat = cat === 'kuota';
      else matchCat = cat === 'pulsa' || cat === 'kuota';
      const matchProv = (p.provider || '').toLowerCase().includes(provider.toLowerCase()) || (p.name || '').toLowerCase().includes(provider.toLowerCase());
      return matchCat && matchProv;
    });

    const text =
      `📦 <b>Pilihan Nominal & Paket ${provider}</b>\n\n` +
      `Pilih paket yang ingin dibeli:`;

    const keyboard: any[][] = [];

    // Tampilkan hingga 12 produk teratas
    const displayItems = filtered.slice(0, 12);

    if (displayItems.length === 0) {
      keyboard.push([{ text: '❌ Produk sedang kosong/maintenance', callback_data: 'nav_home' }]);
    } else {
      for (const item of displayItems) {
        keyboard.push([
          {
            text: `${item.name} • ${formatRupiah(item.sellingPrice)}`,
            callback_data: `prod_${item.id}`,
          },
        ]);
      }
    }

    keyboard.push([{ text: '◀️ Kembali', callback_data: category === 'game' ? 'nav_cat_game' : (category === 'kuota' ? 'nav_cat_kuota' : 'nav_cat_pulsa') }]);

    await this.editMessageText(chatId, messageId, text, { reply_markup: { inline_keyboard: keyboard } });
  }

  // ─────────────────────────────────────────────────────────────
  // PEMILIHAN PRODUK & INSTRUKSI TARGET
  // ─────────────────────────────────────────────────────────────
  private async handleProductSelection(chatId: string | number, productId: string) {
    const products = await this.getWebsiteProducts();
    const product = products.find((p: any) => p.id === productId);

    if (!product) {
      await this.sendMessage(chatId, '❌ Produk tidak ditemukan atau telah dinonaktifkan.');
      return;
    }

    // Cek Stok
    const isAvailable = product.isActive !== false && (product.stock === undefined || product.stock > 0 || product.unlimitedStock);
    if (!isAvailable) {
      await this.sendMessage(chatId, `⚠️ <b>Stok Habis</b>\n\nMaaf, produk <b>${product.name}</b> saat ini sedang kosong dari server supplier. Silakan pilih produk lainnya.`, {
        reply_markup: {
          inline_keyboard: [[{ text: '🛍️ Pilih Produk Lain', callback_data: 'nav_home' }]],
        },
      });
      return;
    }

    // Set user session to awaiting destination
    this.sessions.set(String(chatId), {
      step: 'AWAITING_TARGET',
      productId: product.id,
      productName: product.name,
      price: product.sellingPrice,
      category: product.categoryId,
      provider: product.provider,
      updatedAt: Date.now(),
    });

    // Sesuaikan instruksi sesuai kategori
    let instruction = 'Ketik <b>Nomor HP / Akun Tujuan</b> Anda:';
    let example = 'Contoh: <code>081234567890</code>';

    const cat = (product.categoryId || '').toLowerCase();
    const prov = (product.provider || '').toLowerCase();

    if (cat === 'game' || prov.includes('mobile legends')) {
      if (prov.includes('mobile legends') || product.name.toLowerCase().includes('mobile legends')) {
        instruction = 'Ketik <b>User ID & Zone ID</b> Mobile Legends Anda:';
        example = 'Contoh: <code>12345678 2020</code>';
      } else if (prov.includes('free fire')) {
        instruction = 'Ketik <b>Player ID</b> Free Fire Anda:';
        example = 'Contoh: <code>1234567890</code>';
      } else if (prov.includes('valorant')) {
        instruction = 'Ketik <b>Riot ID & Tagline</b> Anda:';
        example = 'Contoh: <code>PlayerName#1234</code>';
      } else {
        instruction = 'Ketik <b>ID Akun Game / Server</b> Anda:';
        example = 'Contoh: <code>123456789</code>';
      }
    } else if (cat === 'premium') {
      instruction = 'Ketik <b>Email atau WhatsApp</b> untuk menerima detail akun:';
      example = 'Contoh: <code>user@gmail.com</code> atau <code>08123456789</code>';
    } else if (cat === 'pln') {
      instruction = 'Ketik <b>Nomor Meter / ID Pelanggan PLN</b> Anda:';
      example = 'Contoh: <code>14123456789</code>';
    }

    const text =
      `🛒 <b>KONFIRMASI PEMBELIAN</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• Produk: <b>${product.name}</b>\n` +
      `• Provider: <b>${product.provider || 'Resmi'}</b>\n` +
      `• Harga: <b>${formatRupiah(product.sellingPrice)}</b>\n` +
      `• Garansi: <b>100% Legal & Cepat</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `✏️ ${instruction}\n` +
      `${example}\n\n` +
      `<i>Balas chat ini langsung dengan data tujuan Anda.</i>`;

    await this.sendMessage(chatId, text, {
      reply_markup: {
        inline_keyboard: [[{ text: '❌ Batalkan', callback_data: 'cancel_buy' }]],
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // PEMBUATAN AUTO ORDER DARI CHAT TELEGRAM
  // ─────────────────────────────────────────────────────────────
  private async handleTargetInput(chatId: string | number, targetText: string, session: UserShoppingSession, from: any) {
    if (!targetText || targetText.length < 3) {
      await this.sendMessage(chatId, '⚠️ Data tujuan terlalu pendek. Silakan masukkan data tujuan yang benar.');
      return;
    }

    const products = await this.getWebsiteProducts();
    const product = products.find((p: any) => p.id === session.productId);

    if (!product) {
      this.sessions.delete(String(chatId));
      await this.sendMessage(chatId, '❌ Produk tidak ditemukan. Silakan pilih kembali dari menu.', {
        reply_markup: { inline_keyboard: [[{ text: '🛍️ Menu Utama', callback_data: 'nav_home' }]] },
      });
      return;
    }

    // Reset status sesi
    this.sessions.set(String(chatId), { step: 'IDLE', updatedAt: Date.now() });

    await this.sendMessage(chatId, '⏳ <i>Membuat pesanan & menerbitkan QRIS resmi... Mohon tunggu 1-2 detik...</i>');

    try {
      const invoiceNumber = `INV/${new Date().toISOString().slice(0, 10).replace(/-/g, '')}/WD/${Math.floor(1000 + Math.random() * 9000)}`;
      const orderId = `ord_tg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const totalAmount = product.sellingPrice;

      // Buat reservation di database
      const orderRecord = {
        id: orderId,
        invoiceNumber,
        userId: `tg_${from.id || chatId}`,
        guestAccessToken: `gst_tg_${crypto.randomBytes(16).toString('hex')}`,
        productId: product.id,
        targetDestination: targetText.trim(),
        customerName: from.first_name || 'Member Telegram',
        customerPhone: targetText.replace(/[^0-9]/g, '') || '',
        customerEmail: targetText.includes('@') ? targetText.trim() : '',
        category: product.categoryId || 'GAME',
        subtotal: totalAmount,
        adminFee: 0,
        discount: 0,
        totalAmount,
        promoCode: '',
        deliveryMethod: product.deliveryMethod || 'AUTOMATIC',
        paymentStatus: 'UNPAID',
        fulfillmentStatus: 'NOT_STARTED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          source: 'telegram_bot',
          telegramChatId: String(chatId),
          telegramUsername: from.username ? `@${from.username}` : '',
          buyerName: from.first_name || 'Pembeli Telegram',
        },
      };

      // Simpan ke MongoDB kanonis
      await mongoDbService.createOrder(orderRecord);
      await supabaseService.saveOrder(orderRecord, true);

      // Buat Payment Session QRIS
      const activeGateway = detectActiveGateway();
      const paymentResult = await createPaymentSession({
        orderId: invoiceNumber,
        grossAmount: totalAmount,
        customerName: from.first_name || 'Member Telegram',
        customerPhone: targetText.replace(/[^0-9]/g, '') || '',
        preferredGateway: activeGateway,
        paymentMethod: 'qris',
        items: [{ id: product.id, name: product.name, price: totalAmount, quantity: 1 }],
      });

      const qrString = paymentResult.qrString || (paymentResult as any).qr_string || '';
      const qrImageUrl = paymentResult.qrImageUrl || (paymentResult as any).qr_image_url ||
        (qrString ? `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(qrString)}` : '');

      const invoiceCaption =
        `🧾 <b>INVOICE PEMBAYARAN WAYAHEDIGITAL</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `No. Invoice: <code>${invoiceNumber}</code>\n` +
        `Layanan: <b>${product.name}</b>\n` +
        `Tujuan: <code>${targetText}</code>\n` +
        `Total Bayar: <b>${formatRupiah(totalAmount)}</b>\n` +
        `Metode: <b>QRIS Realtime (Semua E-Wallet/Bank)</b>\n` +
        `Status: ⏳ <b>MENUNGGU PEMBAYARAN</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📲 <b>Cara Bayar:</b>\n` +
        `1. Scan foto QRIS di bawah ini dengan DANA, GoPay, OVO, ShopeePay, BCA, atau Mobile Banking apa saja.\n` +
        `2. Pastikan nominal pembayaran pas: <b>${formatRupiah(totalAmount)}</b>.\n` +
        `3. Setelah transfer berhasil, klik tombol <b>'🔄 Cek Pembayaran'</b> di bawah ini.`;

      const actionButtons = [
        [
          { text: '🔄 Cek Status Pembayaran', callback_data: `chk_${invoiceNumber}` },
        ],
        [
          { text: '❌ Batalkan Pesanan', callback_data: `cancel_${invoiceNumber}` },
          { text: '🏠 Menu Utama', callback_data: 'nav_home' },
        ],
      ];

      // Kirim pesan dengan foto QRIS jika tersedia
      if (qrImageUrl) {
        const sent = await this.sendPhoto(chatId, qrImageUrl, invoiceCaption, {
          reply_markup: { inline_keyboard: actionButtons },
        });
        try {
          const msgId = (sent as any)?.result?.message_id || (sent as any)?.message_id;
          if (msgId && invoiceNumber) {
            this.qrPhotoMsgByOrder.set(invoiceNumber, { chatId, messageId: Number(msgId) });
          }
        } catch (_) {}
      } else {
        await this.sendMessage(chatId, invoiceCaption, {
          reply_markup: { inline_keyboard: actionButtons },
        });
      }

      // Notifikasi ke Admin jika alert diaktifkan
      if (this.config.alertsEnabled && this.config.chatId) {
        const adminAlert =
          `🔔 <b>ORDER BARU VIA TELEGRAM BOT!</b>\n` +
          `• Invoice: <code>${invoiceNumber}</code>\n` +
          `• Produk: <b>${product.name}</b>\n` +
          `• Tujuan: <code>${targetText}</code>\n` +
          `• Total: <b>${formatRupiah(totalAmount)}</b>\n` +
          `• Pembeli: ${from.first_name || ''} (@${from.username || '-'})`;
        await this.sendMessage(this.config.chatId, adminAlert);
      }
    } catch (err: any) {
      console.error('[TelegramBot] Gagal membuat pesanan:', err);
      await this.sendMessage(chatId, `❌ Gagal membuat pesanan: ${err.message || 'Terjadi kesalahan sistem'}. Silakan coba lagi.`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // CEK STATUS PESANAN REALTIME
  // ─────────────────────────────────────────────────────────────
  public async handleCheckOrder(chatId: string | number, invoiceNumber: string, callbackQueryId?: string) {
    if (!invoiceNumber || invoiceNumber.length < 5) {
      await this.sendMessage(chatId, '⚠️ Nomor invoice tidak valid.');
      return;
    }

    try {
      const state = await mongoDbService.getAllState();
      const orders = Array.isArray(state?.orders) ? state.orders : Object.values(state?.orders || {});
      const order = orders.find((o: any) =>
        String(o.invoiceNumber).toUpperCase() === invoiceNumber.toUpperCase().trim() ||
        String(o.id).toUpperCase() === invoiceNumber.toUpperCase().trim()
      );

      if (!order) {
        if (callbackQueryId) {
          await this.answerCallbackQuery(callbackQueryId, 'Pesanan belum ditemukan di sistem.', true);
        }
        await this.sendMessage(chatId, `❌ Pesanan dengan invoice <code>${invoiceNumber}</code> tidak ditemukan di sistem.`);
        return;
      }

      const isPaid = order.paymentStatus === 'PAID';
      const isSuccess = order.fulfillmentStatus === 'SUCCESS';
      const isFailed = order.paymentStatus === 'FAILED' || order.fulfillmentStatus === 'FAILED';

      if (isPaid || isSuccess) {
        if (callbackQueryId) {
          await this.answerCallbackQuery(callbackQueryId, 'Pembayaran berhasil dikonfirmasi! ✅', false);
        }

        const snText = order.serialNumber ? `\n• <b>Serial Number (SN):</b>\n<code>${order.serialNumber}</code>` : '';
        const voucherText = order.voucherCode ? `\n• <b>Kode Voucher / Akun:</b>\n<code>${order.voucherCode}</code>` : '';

        const text =
          `✅ <b>STATUS PESANAN: PEMBAYARAN LUNAS</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━\n` +
          `No. Invoice: <code>${order.invoiceNumber}</code>\n` +
          `Layanan: <b>${order.category || 'Produk Digital'}</b>\n` +
          `Tujuan: <code>${order.targetDestination}</code>\n` +
          `Total Bayar: <b>${formatRupiah(order.totalAmount)}</b>\n` +
          `Status Pengiriman: <b>${isSuccess ? '✅ SUKSES SELESAI' : '⚡ SEDANG DIPROSES OTOMATIS'}</b>` +
          snText +
          voucherText +
          `\n━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `<i>Terima kasih telah berbelanja di WayaheDigital! Transaksi Anda telah tercatat resmi.</i>`;

        await this.sendMessage(chatId, text, {
          reply_markup: {
            inline_keyboard: [[{ text: '🛍️ Belanja Lagi', callback_data: 'nav_home' }]],
          },
        });
        return;
      }

      if (isFailed) {
        if (callbackQueryId) {
          await this.answerCallbackQuery(callbackQueryId, 'Status pesanan dibatalkan atau gagal.', true);
        }
        await this.sendMessage(chatId, `❌ <b>Pesanan Dibatalkan / Gagal</b>\n\nInvoice <code>${order.invoiceNumber}</code> berstatus gagal atau kedaluwarsa.`);
        return;
      }

      // Masih UNPAID / PENDING
      if (callbackQueryId) {
        await this.answerCallbackQuery(callbackQueryId, '⏳ Pembayaran belum terdeteksi. Silakan scan QRIS untuk menyelesaikan.', true);
      } else {
        await this.sendMessage(
          chatId,
          `⏳ <b>PESANAN BELUM DIBAYAR</b>\n\n` +
          `Invoice: <code>${order.invoiceNumber}</code>\n` +
          `Total: <b>${formatRupiah(order.totalAmount)}</b>\n` +
          `Status: <i>Menunggu Pembayaran QRIS</i>\n\n` +
          `Silakan selesaikan pembayaran sesuai nominal yang tertera.`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔄 Cek Lagi', callback_data: `chk_${order.invoiceNumber}` }],
                [{ text: '🏠 Menu Utama', callback_data: 'nav_home' }],
              ],
            },
          }
        );
      }
    } catch (err: any) {
      console.error('[TelegramBot] Gagal cek status pesanan:', err);
      await this.sendMessage(chatId, '❌ Terjadi kendala saat memeriksa pesanan.');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // NOTIFIKASI KETIKA ORDER DIBAYAR (TRIGGERED DARI WEBHOOK PEMBAYARAN)
  // ─────────────────────────────────────────────────────────────
  public async notifyOrderPaid(order: any) {
    if (!order) return;

    // 1. Notifikasi ke Pembeli Telegram jika order dibuat via Bot
    const buyerChatId = order.metadata?.telegramChatId;
    if (buyerChatId) {
      // 1a. Hapus foto QRIS lama dari chat pembeli (agar tidak dipakai lagi setelah lunas) + animasi sukses
      const invoiceNumber = order.invoiceNumber;
      const qrEntry = invoiceNumber ? this.qrPhotoMsgByOrder.get(invoiceNumber) : null;
      if (qrEntry) {
        try { await this.deleteMessage(qrEntry.chatId, qrEntry.messageId); } catch (_) {}
        this.qrPhotoMsgByOrder.delete(invoiceNumber);
      }
      const voucherText = order.voucherCode ? `\n• <b>Data Akun / Voucher:</b>\n<code>${order.voucherCode}</code>` : '';

      const buyerMsg =
        `🎉 <b>PEMBAYARAN DITERIMA! PESANAN DIPROSES</b> ⚡\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `No. Invoice: <code>${order.invoiceNumber}</code>\n` +
        `Tujuan: <code>${order.targetDestination}</code>\n` +
        `Total: <b>${formatRupiah(order.totalAmount)}</b>\n` +
        `Status: <b>LUNAS & SEDANG DIPENUHI</b>` +
        snText +
        voucherText +
        `\n━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `<i>Sistem kami sedang memproses transaksi Anda ke server tujuan.</i>`;

      await this.sendMessage(buyerChatId, buyerMsg, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Cek Status Transaksi', callback_data: `chk_${order.invoiceNumber}` }],
            [{ text: '🛍️ Belanja Lagi', callback_data: 'nav_home' }],
          ],
        },
      });
    }

    // 2. Broadcast ke Admin Chat ID
    if (this.config.alertsEnabled && this.config.chatId) {
      const adminMsg =
        `💰 <b>PEMBAYARAN MASUK (QRIS LUNAS)!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `• Invoice: <code>${order.invoiceNumber}</code>\n` +
        `• Pelanggan: <b>${order.customerName || 'Tamu'}</b>\n` +
        `• Tujuan: <code>${order.targetDestination}</code>\n` +
        `• Total: <b>${formatRupiah(order.totalAmount)}</b>\n` +
        `• Sumber: ${order.metadata?.source === 'telegram_bot' ? '🤖 Telegram Bot' : '🌐 Website'}\n` +
        `━━━━━━━━━━━━━━━━━━━━━`;

      await this.sendMessage(this.config.chatId, adminMsg);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // BANTUAN CS & KONTAK
  // ─────────────────────────────────────────────────────────────
  private async sendCsInfo(chatId: string | number) {
    const csUser = this.config.csUsername ? `@${this.config.csUsername.replace('@', '')}` : '@AdminWayahe';
    const text =
      `💬 <b>Layanan Bantuan & Customer Service</b>\n\n` +
      `Butuh bantuan pesanan, konfirmasi saldo, atau kemitraan?\n\n` +
      `• Telegram CS: <b>${csUser}</b>\n` +
      `• Jam Operasional: <b>24 Jam Nonstop</b>\n` +
      `• Website Resmi: <code>${this.config.webAppUrl || 'https://wayahetopup.my.id'}</code>` +
      `Customer service kami siap membantu Anda dengan ramah dan cepat.`;

    const keyboard: any[][] = [];
    if (this.config.csUsername) {
      keyboard.push([{ text: '💬 Hubungi CS Telegram', url: `https://t.me/${this.config.csUsername.replace('@', '')}` }]);
    }
    keyboard.push([{ text: '◀️ Kembali ke Menu Utama', callback_data: 'nav_home' }]);

    await this.sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard } });
  }

  // ─────────────────────────────────────────────────────────────
  // LONG POLLING SUPPORT (UNTUK LOCALHOST TANPA WEBHOOK PUBLIK)
  // ─────────────────────────────────────────────────────────────
  public async registerCommands() {
    if (!this.isConfigured()) return;
    try {
      const token = this.config.botToken;
      await axios.post(
        `https://api.telegram.org/bot${token}/setMyCommands`,
        { commands: [
          { command: 'start', description: 'Buka Menu Toko Utama' },
          { command: 'katalog', description: 'Lihat Semua Kategori Produk' },
          { command: 'status', description: 'Cek Status &amp; Riwayat Pesanan' },
          { command: 'cs', description: 'Layanan Bantuan Customer Service' },
          { command: 'ping', description: 'Cek Kecepatan Respon Bot' },
        ] },
        { timeout: 15000 },
      );
    } catch (_) {}
  }

  public async startPolling() {
    if (this.isPolling) return;
    if (!this.isConfigured()) {
      console.log('[TelegramBot] Polling tidak dimulai: bot token belum diisi.');
      return;
    }

    this.isPolling = true;
    console.log('[TelegramBot] Long Polling aktif melayani pesan...');

    // Hapus webhook lama agar update datang via polling (bukan dikirim ke endpoint)
    try {
      await axios.post(
        `https://api.telegram.org/bot${this.config.botToken}/deleteWebhook`,
        { drop_pending_updates: true },
        { timeout: 15000 },
      );
    } catch (_) {}

    const poll = async () => {
      if (!this.isPolling) return;

      try {
        const token = this.config.botToken;
        const res = await axios.get(`https://api.telegram.org/bot${token}/getUpdates`, {
          params: { offset: this.lastUpdateId + 1, timeout: 20 },
          timeout: 25000,
        });

        if (res.data?.ok && Array.isArray(res.data.result)) {
          for (const update of res.data.result) {
            this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);
            await this.handleUpdate(update);
          }
        }
      } catch (err: any) {
        // Abaikan timeout axios biasa
        if (err.code !== 'ECONNABORTED') {
          // console.warn('[TelegramBot Polling Error]:', err.message);
        }
      }

      if (this.isPolling) {
        this.pollingTimeout = setTimeout(poll, 1500);
      }
    };

    poll();
  }

  public stopPolling() {
    this.isPolling = false;
    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout);
      this.pollingTimeout = null;
    }
  }
}

export const telegramBotService = new TelegramBotService();
