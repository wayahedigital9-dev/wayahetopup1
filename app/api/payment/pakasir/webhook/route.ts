import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Validasi timing-safe untuk X-Secret
 */
function safeCompare(received: string, expected: string) {
  try {
    const a = Buffer.from(received);
    const b = Buffer.from(expected);

    if (a.length !== b.length || a.length === 0) {
      return false;
    }

    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  POST /api/payment/pakasir/webhook                           ║
 * ║  Menerima callback resmi dari server Pakasir                 ║
 * ║  Header: X-Secret: PAKASIR_WEBHOOK_SECRET                    ║
 * ║  Idempotent & Digiflazz Fulfillment Integration              ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
export async function POST(req: Request) {
  try {
    const receivedSecret = req.headers.get("x-secret") || req.headers.get("X-Secret");
    const expectedSecret = process.env.PAKASIR_WEBHOOK_SECRET;

    if (!expectedSecret) {
      console.error("[PAKASIR WEBHOOK] PAKASIR_WEBHOOK_SECRET belum dikonfigurasi");
      return NextResponse.json(
        {
          success: false,
          message: "Server configuration missing",
        },
        { status: 500 }
      );
    }

    if (!receivedSecret || !safeCompare(receivedSecret, expectedSecret)) {
      console.warn("[PAKASIR WEBHOOK] Ditolak: invalid secret (WEBHOOK_SECRET_INVALID)");
      return NextResponse.json(
        {
          success: false,
          error: "WEBHOOK_SECRET_INVALID",
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const rawBody = await req.text();
    let payload: any;

    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error("[PAKASIR WEBHOOK] Webhook bukan JSON valid:", rawBody);
      return NextResponse.json(
        {
          success: false,
          message: "Invalid payload",
        },
        { status: 400 }
      );
    }

    const {
      txn_id,
      order_id,
      amount,
      status,
      completed_at,
      is_sandbox,
    } = payload;

    console.log("[PAKASIR WEBHOOK]");
    console.log(`  order_id: ${order_id}`);
    console.log(`  txn_id:   ${txn_id}`);
    console.log(`  amount:   ${amount}`);
    console.log(`  status:   ${status}`);

    if (!txn_id || !order_id || typeof amount === "undefined" || !status) {
      return NextResponse.json(
        {
          success: false,
          message: "Payload tidak lengkap",
        },
        { status: 400 }
      );
    }

    // 1. Cari order dari Database (Supabase / Prisma)
    let order: any = null;

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        const { data } = await supabase
          .from("orders")
          .select("*")
          .or(`invoice_number.eq.${order_id},id.eq.${order_id}`)
          .single();
        if (data) order = data;
      } catch (_) {}
    }

    if (!order) {
      try {
        const { PrismaClient } = await import("@prisma/client");
        const prisma = new PrismaClient();
        order = await prisma.order.findFirst({
          where: {
            OR: [{ id: order_id }, { invoiceNumber: order_id }],
          },
          include: { items: true },
        });
        await prisma.$disconnect();
      } catch (_) {}
    }

    if (!order) {
      console.warn(`[PAKASIR WEBHOOK] Order tidak ditemukan: ${order_id}`);
      return NextResponse.json(
        {
          success: false,
          error: "ORDER_NOT_FOUND",
          message: "Order tidak ditemukan",
        },
        { status: 404 }
      );
    }

    // 2. Verifikasi Data Keamanan
    if (order.pakasir_txn_id && order.pakasir_txn_id !== txn_id) {
      console.warn(`[PAKASIR WEBHOOK] Mismatch Txn ID (Expected: ${order.pakasir_txn_id}, Got: ${txn_id})`);
      return NextResponse.json(
        {
          success: false,
          error: "TRANSACTION_ID_MISMATCH",
          message: "Transaction ID tidak sesuai",
        },
        { status: 400 }
      );
    }

    const orderAmount = Number(order.amount || order.total_amount || order.totalAmount || 0);
    const receivedAmount = Number(amount);

    if (orderAmount > 0 && Math.abs(orderAmount - receivedAmount) > 5) {
      console.warn(`[PAKASIR WEBHOOK] Mismatch Amount (Order: ${orderAmount}, Received: ${receivedAmount})`);
      return NextResponse.json(
        {
          success: false,
          error: "PAYMENT_AMOUNT_MISMATCH",
          message: "Nominal pembayaran tidak cocok dengan database",
        },
        { status: 400 }
      );
    }

    // 3. Proses Status
    if (status === "completed" || status === "paid") {
      const currentPaymentStatus = String(order.payment_status || order.paymentStatus || "").toLowerCase();

      // IDEMPOTENCY CHECK
      if (currentPaymentStatus === "paid") {
        console.log(`[PAKASIR WEBHOOK] IDEMPOTENT: Order ${order_id} sudah dibayar. Skip fulfillment ulang.`);
        return NextResponse.json({
          success: true,
          received: true,
          message: "Order already paid (idempotent)",
        });
      }

      console.log(`[PAYMENT VERIFIED] order_id: ${order_id}`);

      // Update Database Status ke 'paid' & fulfillment_status ke 'processing'
      const completedTime = completed_at ? new Date(completed_at).toISOString() : new Date().toISOString();

      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        try {
          const { createClient } = await import("@supabase/supabase-js");
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
          );
          await supabase
            .from("orders")
            .update({
              payment_status: "paid",
              completed_at: completedTime,
              pakasir_txn_id: txn_id,
              raw_webhook: payload,
              fulfillment_status: "processing",
              updated_at: new Date().toISOString(),
            })
            .or(`invoice_number.eq.${order_id},id.eq.${order_id}`);
        } catch (_) {}
      }

      // 4. Eksekusi Fulfillment (Digiflazz / Wifi / Pulsa)
      // SETELAH DATABASE RESMI PAID
      try {
        const { PrismaClient } = await import("@prisma/client");
        const prisma = new PrismaClient();
        const { FulfillmentService } = await import("@/backend/src/services/fulfillment.js");
        const fulfillmentService = new FulfillmentService(prisma);
        await fulfillmentService.fulfillOrder(order.id);
        await prisma.$disconnect();
      } catch (fulfillErr: any) {
        console.log("[FULFILLMENT NOTE]:", fulfillErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      received: true,
    });
  } catch (error: any) {
    console.error("PAKASIR WEBHOOK ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
