# RENCANA: Qiospay QRIS + VA, hapus Midtrans/Xendit/Tripay

Target repo: /home/ubuntu/wayahetopup1 (WayaheTopup, wayahetopup.my.id)
Keputusan Mas Ulum:
- Gateway: QIOSPAY QRIS + VA + PAKASIR (+ pilihan VA dari Pakasir)
- VA H2H Qiospay: BELUM aktif -> kode dibuat siap-pakai, channel VA otomatis muncul saat kredensial+aktivasi ada
- Bank VA: BRI, BNI, Mandiri, BSI

Konteks penting: Postgres/Supabase sudah mati (tenant not found) -> data nyata =
MongoDB + backend/data/db.json. Postgres/Prisma = sekunder (tetap dijaga, jangan sampai crash).

## TAHAP 1 - Hapus Midtrans/Xendit/Tripay
1. backend/src/db/schema.ts: midtransSnapToken -> gatewayRefId, hapus midtransOrderId
2. backend/prisma/schema.prisma: idem
3. backend/src/index.ts: tulis gatewayRefId (bukan midtransSnapToken)
4. backend/package.json: buang dependensi midtrans-client
5. src/services/apiAdapter.ts: hapus handleMidtransWebhook
6. src/components/SnapSimulatorModal.tsx + pemakaian di App.tsx: buang/renama netral
7. Teks UI yang menyebut Midtrans/Snap dibersihkan
8. Data lama: buang field midtransSnapToken dari order di Mongo + db.json (snapToken tetap ada)

## TAHAP 2 - Qiospay VA (backend)
9.  config/apikeys.ts: QIOSPAY_CONFIG + H2H_USERNAME, PIN(us_apikey), VA_ENABLED, VA_BANKS
10. services/qiospay.ts: createVirtualAccount() -> POST /api/create/va (username,pin,amount,bank_code,
    partner_reff unik,customer_*,url_callback); baca additionalfee dari respons (jangan hardcode)
11. services/qiospay.ts: proses callback VA (match partner_reff -> order, durable PAID, dispatch fulfillment)
12. index.ts: POST /api/webhook/qiospay-va (+alias) + GET readiness
13. paymentRouter.ts: dukung method qris | va:<bank> untuk QIOSPAY & PAKASIR
14. index.ts /api/orders: terima paymentMethod, buat VA bila diminta, simpan vaNumber/bankCode/bankName
15. index.ts gateway-status & gateway-info: laporkan kesiapan VA (jujur: belum aktif = false)
16. index.ts: GET /api/payment/methods -> daftar channel + fee/minAmount dari server

## TAHAP 3 - Frontend
17. types/index.ts: Order + vaNumber/bankCode/bankName/gatewayRefId; Settings + qiospay VA
18. apiAdapter.ts: kirim paymentMethod; tambah getPaymentMethods()
19. CheckoutPage/InvoiceModal: pilihan QRIS + VA (BRI/BNI/Mandiri/BSI) + tampilkan nomor VA + salin
20. Bersihkan teks Snap/Midtrans

## TAHAP 4 - Verifikasi (wajib sebelum lapor)
21. tsc backend + vite build frontend hijau
22. Probe read-only: gateway-status (VA jujur belum aktif), /api/payment/methods, callback VA tanpa
    kredensial harus DITOLAK
23. Jalankan regresi: admin-session-regression.mjs, production-safety-regression.mjs,
    regression-settings-hydration.mjs
24. Deploy + health 200 + verifikasi order QRIS lama tetap bisa dibuat (tidak merusak yang jalan)
25. Lapor: kredensial apa yang Mas Ulum harus isi (QIOSPAY_H2H_USERNAME, QIOSPAY_H2H_PIN) + URL callback


## STATUS (2026-10-26) — SELESAI
- QRIS Qiospay tetap jalan; VA H2H Qiospay terpasang (siap-pakai, channel 'unavailable' sampai kredensial diisi).
- Midtrans/Xendit/Tripay dihapus dari kode aktif, dependensi, skema, tipe, dan data lama.
- Verifikasi: tsc frontend+backend bersih, 7/7 uji router LULUS, endpoint publik 200, aplikasi boot tanpa error.
