#!/bin/bash
set -e
export PATH="/www/server/nodejs/v26.10.0/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
if [ "$(id -u)" -eq 0 ]; then
  echo "=========================================="
  echo "⚠️  Terdeteksi root — berpindah ke ubuntu..."
  echo "=========================================="
  exec sudo -H -u ubuntu bash "$0" "$@"
fi
APP_DIR="/home/ubuntu/wayahetopup1"
BACKEND_DIR="$APP_DIR/backend"
cd "$APP_DIR"
echo "=========================================="
echo "🚀 [Wayahe Deploy] Memulai proses deploy..."
echo "=========================================="
echo "📥 Menarik kode terbaru dari GitHub..."
git pull origin main || git pull origin master || true
echo "🧹 Membersihkan build lama..."
rm -rf dist
echo "📦 Install frontend..."
yarn install --ignore-engines --silent 2>&1 | tail -n 20
echo "📦 Install backend..."
cd "$BACKEND_DIR"
yarn install --ignore-engines --silent 2>&1 | tail -n 20 || npm install --ignore-engines 2>&1 | tail -n 20
# generate prisma if schema exists
if [ -f "prisma/schema.prisma" ]; then
  echo "🔧 Prisma generate..."
  npx prisma generate 2>&1 | tail -n 20 || true
fi
cd "$APP_DIR"
export ADMIN_TOKEN="${ADMIN_TOKEN:-wayahe_admin_secret_token_1234}"
export VITE_ADMIN_TOKEN="${VITE_ADMIN_TOKEN:-wayahe_admin_secret_token_1234}"
if [ -f "$BACKEND_DIR/.env" ] && ! grep -q "ADMIN_TOKEN=" "$BACKEND_DIR/.env"; then
  echo 'ADMIN_TOKEN="wayahe_admin_secret_token_1234"' >> "$BACKEND_DIR/.env"
fi
echo "🏗️  Build frontend (Vite)..."
VITE_ADMIN_TOKEN="$VITE_ADMIN_TOKEN" yarn build 2>&1 | tail -n 30
cd "$BACKEND_DIR"
echo "🏗️  Build backend (tsc)..."
npm run build 2>&1 | tail -n 30 || npx tsc 2>&1 | tail -n 30
cd "$APP_DIR"
echo "🔄 Restart backend PM2..."
pm2 restart ecosystem.config.cjs --update-env 2>&1 | tail -n 20 || pm2 start ecosystem.config.cjs 2>&1 | tail -n 20
pm2 save 2>&1 | tail -n 5
echo "=========================================="
echo "✅ [Wayahe] Deploy selesai!"
echo "   Frontend dist: $APP_DIR/dist"
echo "   Backend: pm2 logs wayahe-backend"
echo "=========================================="
