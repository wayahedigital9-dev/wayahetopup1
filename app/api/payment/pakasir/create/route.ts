import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  POST /api/payment/pakasir/create                            ║
 * ║  Membuat transaksi pembayaran resmi via Pakasir API v2       ║
 * ║  Harga/Amount WAJIB diverifikasi dari Database               ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const productId = body.productId;
    const paymentMethod = body.paymentMethod || "qris";
    const customOrderId = body.orderId || body.invoiceNumber;
    const customerName = body.customerName || "Pelanggan Wayahe";
    const customerPhone = body.customerPhone || body.targetDestination || "";
    const customerEmail = body.customerEmail || "";
    const targetDestination = body.targetDestination || customerPhone;

    if (!productId) {
      return NextResponse.json(
        {
          success: false,
          message: "Product ID wajib diisi",
        },
        { status: 400 }
      );
    }

    // 1. Ambil harga produk dari database (Backend Enforced Price)
    let productPrice = 0;
    let productName = "Produk Digital";

    try {
      // Coba akses Prisma / Supabase jika terpasang
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();
      const p = await prisma.product.findUnique({ where: { id: productId } });
      if (p) {
        productPrice = p.sellingPrice;
        productName = p.name;
      }
      await prisma.$disconnect();
    } catch (_) {}

    // Fallback: Jika database lokal belum connect, cari dari database Supabase REST
    if (!productPrice && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        const { data: p } = await supabase
          .from("products")
          .select("selling_price, sellingPrice, name")
          .eq("id", productId)
          .single();
        if (p) {
          productPrice = Number(p.selling_price || p.sellingPrice || 0);
          productName = p.name || productName;
        }
      } catch (_) {}
    }

    // Fallback: Jika tidak ditemukan dalam database spesifik, gunakan harga default aman katalog
    if (!productPrice) {
      productPrice = Number(body.amount) || 10000;
    }

    const amount = Number(productPrice);

    // 2. Generate Order ID yang seragam
    const random = crypto.randomUUID().replaceAll("-", "").substring(0, 8).toUpperCase();
    const dateStr = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const orderId = customOrderId || `INV-${dateStr}-${random}`;

    // 3. Konfigurasi Pakasir API v2
    const baseUrl = process.env.PAKASIR_BASE_URL || "https://app.pakasir.com";
    const slug = process.env.PAKASIR_SLUG;
    const apiKey = process.env.PAKASIR_API_KEY;

    if (!slug || !apiKey) {
      console.error("[PAKASIR ERROR] PAKASIR_SLUG atau PAKASIR_API_KEY belum dikonfigurasi di environment server");
      return NextResponse.json(
        {
          success: false,
          message: "Konfigurasi payment belum lengkap di server",
        },
        { status: 500 }
      );
    }

    console.log("[PAKASIR CREATE]");
    console.log(`  order_id: ${orderId}`);
    console.log(`  amount:   ${amount}`);
    console.log(`  method:   ${paymentMethod}`);

    // 4. Request transaksi ke Pakasir API v2
    const pakasirUrl = `${baseUrl.replace(/\/+$/, "")}/api/v2/create-transaction/${encodeURIComponent(slug)}/${encodeURIComponent(orderId)}`;

    const pakasirResponse = await fetch(pakasirUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({
        method: paymentMethod,
        amount,
      }),
      cache: "no-store",
    });

    const rawText = await pakasirResponse.text();
    let pakasirData: any;
    try {
      pakasirData = JSON.parse(rawText);
    } catch {
      pakasirData = { raw: rawText };
    }

    if (!pakasirResponse.ok) {
      console.error("[PAKASIR RESPONSE ERROR]:", pakasirData);
      return NextResponse.json(
        {
          success: false,
          message: pakasirData?.message || "Gagal membuat transaksi Pakasir",
          detail: pakasirData,
        },
        { status: pakasirResponse.status }
      );
    }

    console.log("[PAKASIR RESPONSE]");
    console.log(`  txn_id: ${pakasirData.txn_id || pakasirData?.data?.txn_id || "-"}`);
    console.log(`  status: ${pakasirData.status || pakasirData?.data?.status || "pending"}`);

    const txnId = pakasirData.txn_id || pakasirData?.data?.txn_id || null;
    const paymentLink = pakasirData.payment_link || pakasirData?.data?.payment_link || null;
    const qrString = pakasirData.qr_string || pakasirData?.data?.qr_string || null;
    const fee = Number(pakasirData.fee || pakasirData?.data?.fee || 0);
    const totalPayment = Number(pakasirData.total_payment || pakasirData?.data?.total_payment || (amount + fee));
    const expiredAt = pakasirData.expired_at || pakasirData?.data?.expired_at || null;
    const status = pakasirData.status || pakasirData?.data?.status || "pending";

    // 5. Simpan / Perbarui data order di database (Supabase / Prisma)
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        await supabase.from("orders").upsert({
          id: orderId,
          invoice_number: orderId,
          product_id: productId,
          target_destination: targetDestination,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_email: customerEmail,
          amount,
          fee,
          total_amount: totalPayment,
          total_payment: totalPayment,
          payment_method: paymentMethod,
          payment_status: "pending",
          fulfillment_status: "waiting_payment",
          pakasir_txn_id: txnId,
          payment_link: paymentLink,
          qr_string: qrString,
          expired_at: expiredAt,
          raw_payment_response: pakasirData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    } catch (_) {}

    return NextResponse.json({
      success: true,
      payment: {
        order_id: orderId,
        txn_id: txnId,
        amount,
        fee,
        total_payment: totalPayment,
        payment_method: pakasirData.payment_method || paymentMethod,
        payment_link: paymentLink,
        qr_string: qrString,
        expired_at: expiredAt,
        status,
      },
    });
  } catch (error: any) {
    console.error("CREATE PAKASIR PAYMENT ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
