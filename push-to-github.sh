#!/bin/bash
# Script otomatis untuk push project Wayahe Digital ke GitHub

echo "🚀 Memeriksa koneksi SSH ke GitHub..."
if ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
  echo "✅ Autentikasi SSH GitHub berhasil!"
else
  echo "⚠️ Autentikasi SSH belum terdaftar di akun GitHub Anda."
  echo "👉 Silakan buka: https://github.com/settings/ssh/new"
  echo "👉 Tempelkan (Cmd + V) Public Key berikut:"
  echo ""
  cat ~/.ssh/id_ed25519.pub
  echo ""
  echo "Setelah menambahkan SSH key di GitHub, jalankan kembali skrip ini: ./push-to-github.sh"
  exit 1
fi

echo "📦 Menyiapkan berkas dan branch main..."
git branch -M main
git remote set-url origin git@github.com:wayahedigital885-rgb/wayahetopup.git

echo "⬆️ Memulai proses push ke repository wayahedigital885-rgb/wayahetopup..."
git push -u origin main

if [ $? -eq 0 ]; then
  echo "🎉 Sukses! Semua file website berhasil terunggah ke: https://github.com/wayahedigital885-rgb/wayahetopup"
else
  echo "⚠️ Push gagal. Pastikan repository 'wayahetopup' sudah dibuat di https://github.com/new"
fi
