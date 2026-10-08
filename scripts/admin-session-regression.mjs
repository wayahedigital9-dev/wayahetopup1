import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const backend = fs.readFileSync(new URL('backend/src/index.ts', root), 'utf8');
const storage = fs.readFileSync(new URL('src/services/storage.ts', root), 'utf8');
const login = fs.readFileSync(new URL('src/pages/AdminLoginPage.tsx', root), 'utf8');

assert.match(backend, /app\.post\('\/api\/admin\/login'/, 'backend must provide a server-side admin login route');
assert.match(backend, /HttpOnly/i, 'admin session cookie must be HttpOnly');
assert.match(backend, /wd_admin_session/, 'backend must validate the admin session cookie');
assert.match(backend, /createHmac\('sha256'/, 'admin session must be signed');
assert.doesNotMatch(storage, /VITE_ADMIN_TOKEN/, 'frontend must not read or ship VITE_ADMIN_TOKEN');
assert.match(login, /fetch\('\/api\/admin\/login'/, 'admin login page must authenticate against the backend');
assert.doesNotMatch(login, /activeAdminPass|adminPassword \|\| 'admin123'/, 'frontend login must not validate the admin password locally');
console.log('admin session regression check passed');
