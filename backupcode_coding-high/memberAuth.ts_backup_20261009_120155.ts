import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { Db } from 'mongodb';

const COOKIE = 'wd_member_session';
const TTL = 7 * 24 * 60 * 60 * 1000;
const digest = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const norm = (v: unknown) => typeof v === 'string' ? v.trim().toLowerCase() : '';
const phoneKey = (v: unknown) => { const d = norm(v).replace(/[^0-9]/g, ''); return d.startsWith('62') ? '0' + d.slice(2) : d; };
const exact = (v: string) => new RegExp('^' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (e, key) => e ? reject(e) : resolve(key)));
}
export async function hashMemberPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$32768$8$3$${salt}$${(await derive(password, salt)).toString('hex')}`;
}
async function checkPassword(password: string, user: any): Promise<boolean> {
  if (typeof user.passwordHash === 'string') {
    const parts = user.passwordHash.split('$');
    if (parts.length !== 6 || parts.slice(0,4).join('$') !== 'scrypt$32768$8$3' || !/^[a-f0-9]{32}$/.test(parts[4]) || !/^[a-f0-9]{128}$/.test(parts[5])) return false;
    const actual = await derive(password, parts[4]);
    return crypto.timingSafeEqual(actual, Buffer.from(parts[5], 'hex'));
  }
  // Only already-persisted legacy credentials; never trust browser accounts.
  return typeof user.password === 'string' && user.password.length > 0 && crypto.timingSafeEqual(Buffer.from(digest(password)), Buffer.from(digest(user.password)));
}
export function memberDto(u: any) {
  const out: Record<string, any> = {};
  for (const key of 'id username email name phone role memberTier balance rewardPoints avatar createdAt isGmailVerified'.split(' ')) {
    if (['string','number','boolean'].includes(typeof u[key])) out[key] = u[key];
  }
  out.balance = typeof u.balance === 'number' ? u.balance : 0;
  out.rewardPoints = typeof u.rewardPoints === 'number' ? u.rewardPoints : 0;
  return out;
}
export function createMemberAuth(getDb: () => Promise<Db>, secure = true, orderCollection = 'orders') {
  const router = Router();
  const cookieOptions = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/', maxAge: TTL };
  let ready: Promise<void> | undefined;
  async function database() {
    const db = await getDb();
    if (!db) throw new Error('unavailable');
    if (!ready) ready = (async () => {
      for (const key of ['usernameKey','emailKey','phoneKey']) {
        await db.collection('users').createIndex({ [key]: 1 }, { unique: true, partialFilterExpression: { [key]: { $type: 'string' } } });
      }
      await db.collection('member_sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    })().catch(e => { ready = undefined; throw e; });
    await ready;
    return db;
  }
  const token = (req: Request) => (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1) || '';
  async function getMember(req: Request): Promise<any | null> {
    const value = token(req);
    if (!/^[a-f0-9]{64}$/.test(value)) return null;
    const db = await database();
    const session = await db.collection('member_sessions').findOne({ _id: digest(value) as any, expiresAt: { $gt: new Date() } });
    if (!session) return null;
    return db.collection('users').findOne({ id: session.userId });
  }
  async function session(req: Request, res: Response, db: Db, u: any) {
    const value = crypto.randomBytes(32).toString('hex');
    const result = await db.collection('member_sessions').insertOne({ _id: digest(value) as any, userId: u.id, expiresAt: new Date(Date.now() + TTL), createdAt: new Date() });
    if (!result.acknowledged) throw new Error('unavailable');
    if (token(req)) await db.collection('member_sessions').deleteOne({ _id: digest(token(req)) as any });
    res.cookie(COOKIE, value, cookieOptions);
  }
  const unavailable = (res: Response) => res.status(503).json({ success: false, message: 'Database tidak tersedia. Silakan coba lagi; data belum dikonfirmasi tersimpan.' });
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET','HEAD'].includes(req.method)) {
      if (req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({ success: false, message: 'Origin tidak diizinkan.' });
      if (req.headers.origin) {
        try { if (new URL(req.headers.origin).host !== req.get('host')) return res.status(403).json({ success: false, message: 'Origin tidak diizinkan.' }); }
        catch { return res.status(403).json({ success: false }); }
      }
    }
    next();
  });
  router.post('/register', async (req, res) => {
    const username = norm(req.body?.username), email = norm(req.body?.email), phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
    const password = req.body?.password;
    if (!/^[a-z][a-z0-9_]{2,31}$/.test(username) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || typeof password !== 'string' || password.length < 8 || password.length > 128 || (phone && !/^0[0-9]{8,14}$/.test(phoneKey(phone)))) return res.status(400).json({ success: false, message: 'Username 3–32 karakter diawali huruf, email valid, dan kata sandi 8–128 karakter wajib diisi. Periksa nomor HP.' });
    try {
      const db = await database();
      const clauses: any[] = [{ username: exact(username) }, { email: exact(email) }];
      if (phone) clauses.push({ phoneKey: phoneKey(phone) }, { phone: { $in: [phone, phoneKey(phone), '62' + phoneKey(phone).slice(1), '+62' + phoneKey(phone).slice(1)] } });
      if (await db.collection('users').findOne({ $or: clauses })) return res.status(409).json({ success: false, message: 'Username, email, atau nomor HP sudah terdaftar.' });
      const user = { id: 'usr_' + crypto.randomUUID(), username, usernameKey: username, email, emailKey: email, ...(phone ? { phoneKey: phoneKey(phone) } : {}), phone, name: typeof req.body?.name === 'string' ? req.body.name.trim().slice(0,100) || username : username, passwordHash: await hashMemberPassword(password), role: 'CUSTOMER', memberTier: 'MEMBER', balance: 0, rewardPoints: 0, isGmailVerified: false, createdAt: new Date().toISOString() };
      const result = await db.collection('users').insertOne(user);
      if (!result.acknowledged || !await db.collection('users').findOne({ id: user.id })) throw new Error('unavailable');
      await session(req, res, db, user);
      return res.status(201).json({ success: true, data: memberDto(user) });
    } catch (e: any) { if (e?.code === 11000) return res.status(409).json({ success: false, message: 'Identitas sudah terdaftar.' }); return unavailable(res); }
  });
  router.post('/login', async (req, res) => {
    const identifier = norm(req.body?.identifier || req.body?.username), password = req.body?.password;
    if (!identifier || identifier.length > 254 || typeof password !== 'string' || !password || password.length > 128) return res.status(400).json({ success: false, message: 'Identitas dan kata sandi wajib diisi.' });
    try {
      const db = await database();
      const query: any[] = [{ username: exact(identifier) }, { email: exact(identifier) }];
      if (/^[+0-9\s-]+$/.test(identifier)) query.push({ phoneKey: phoneKey(identifier) }, { phone: { $in: [identifier, phoneKey(identifier), '62' + phoneKey(identifier).slice(1), '+62' + phoneKey(identifier).slice(1)] } });
      const matches = await db.collection('users').find({ $or: query }).limit(2).toArray();
      const user = matches.length === 1 ? matches[0] : null;
      if (!user || !await checkPassword(password, user)) {
        if (!user) await derive(password, '00000000000000000000000000000000');
        return res.status(401).json({ success: false, message: 'Identitas atau kata sandi tidak valid. Akun lama tanpa kredensial server memerlukan bantuan admin.' });
      }
      if (!user.passwordHash) {
        const migrated = await db.collection('users').updateOne({ id: user.id, password: user.password }, { $set: { passwordHash: await hashMemberPassword(password) }, $unset: { password: '' } });
        if (!migrated.acknowledged || migrated.matchedCount !== 1) throw new Error('unavailable');
      }
      await session(req, res, db, user);
      return res.json({ success: true, data: memberDto(user) });
    } catch { return unavailable(res); }
  });
  router.get('/me', async (req, res) => {
    try { const u = await getMember(req); return u ? res.json({ success: true, data: memberDto(u) }) : res.status(401).json({ success: false, message: 'Silakan login.' }); } catch { return unavailable(res); }
  });
  router.patch('/me', async (req, res) => {
    try {
      const u = await getMember(req); if (!u) return res.status(401).json({ success: false });
      if (!req.body || Object.keys(req.body).some(k => k !== 'name')) return res.status(400).json({ success: false, message: 'Hanya nama profil dapat diubah. Saldo, peran dan identitas tidak dapat diubah oleh klien.' });
      const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
      if (!name || name.length > 100) return res.status(400).json({ success: false });
      const db = await database(); const result = await db.collection('users').updateOne({ id: u.id }, { $set: { name } });
      if (!result.acknowledged || result.matchedCount !== 1) throw new Error('unavailable');
      return res.json({ success: true, data: memberDto(await db.collection('users').findOne({ id: u.id })) });
    } catch { return unavailable(res); }
  });
  router.get('/orders', async (req, res) => {
    try { const u = await getMember(req); if (!u) return res.status(401).json({ success: false }); const db = await database(); const orders = await db.collection(orderCollection).find({ userId: u.id }).sort({ createdAt: -1 }).limit(100).toArray(); return res.json({ success: true, data: orders.map(({ _id, guestAccessToken, ...o }) => o) }); } catch { return unavailable(res); }
  });
  router.post('/logout', async (req, res) => {
    try { const db = await database(); if (token(req)) await db.collection('member_sessions').deleteOne({ _id: digest(token(req)) as any }); res.clearCookie(COOKIE, { ...cookieOptions, maxAge: undefined }); return res.json({ success: true }); } catch { return unavailable(res); }
  });
  return { router, getMember };
}
