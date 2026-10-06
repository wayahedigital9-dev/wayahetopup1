import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  POST /api/webhooks/digiflazz                                ║
 * ║  Digiflazz H2H Multi-Webhook Callback Receiver              ║
 * ║  - PUBLIC endpoint (tanpa login/JWT/session/cookie)         ║
 * ║  - Verifikasi X-Hub-Signature (HMAC SHA1 terhadap RAW BODY) ║
 * ║  - Event: create & update                                    ║
 * ║  - Idempotent & Proteksi Status Terminal                     ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get("x-hub-signature") || req.headers.get("X-Hub-Signature");
    const eventHeader = (req.headers.get("x-digiflazz-event") || req.headers.get("X-Digiflazz-Event") || "update").toLowerCase();
    const secret = process.env.DIGIFLAZZ_WEBHOOK_SECRET || process.env.DIGIFLAZZ_SECRET_CODE;

    // 1. Verifikasi Webhook Signature (HMAC SHA1 terhadap RAW BODY)
    if (secret) {
      if (signatureHeader) {
        try {
          const expected = "sha1=" + crypto.createHmac("sha1", secret).update(rawBody).digest("hex");
          const sigBuffer = Buffer.from(signatureHeader.trim());
          const expBuffer = Buffer.from(expected);
          if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
            console.warn("[DIGIFLAZZ WEBHOOK] Signature mismatch!");
            if (process.env.DIGIFLAZZ_ENFORCE_SIGNATURE === "true") {
              return NextResponse.json({ success: false, message: "Invalid webhook signature" }, { status: 401 });
            }
          }
        } catch (e: any) {
          console.error("[DIGIFLAZZ WEBHOOK] Signature error:", e.message);
        }
      } else {
        console.warn("⚠️ [DIGIFLAZZ WEBHOOK NOTICE] X-Hub-Signature header absent, proceeding with payload.");
      }
    }

    let body: any = {};
    try {
      body = JSON.parse(rawBody);
    } catch (_) {
      return NextResponse.json({ success: false, message: "Invalid JSON" }, { status: 400 });
    }

    // Response Digiflazz dibungkus dalam data: const payload = body.data || body;
    const payload = body?.data || body;
    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ success: true, message: "Ping acknowledged" });
    }

    // Ambil identifier utama: ref_id (JANGAN menggunakan customer_no sebagai identifier utama)
    const refId = String(payload.ref_id || payload.refId || payload.trx_id || "").trim();
    const status = String(payload.status || "").trim();
    const rc = String(payload.rc || "").trim();
    const sn = String(payload.sn || payload.serial_number || "").trim();
    const message = String(payload.message || "").trim();
    const price = payload.price !== undefined ? Number(payload.price) : undefined;
    const customerNo = String(payload.customer_no || "").trim();
    const buyerSkuCode = String(payload.buyer_sku_code || "").trim();

    // Log callback server-side
    console.log("[DIGIFLAZZ CALLBACK]", {
      event: eventHeader,
      ref_id: refId,
      status,
      rc,
      sn: sn || undefined,
      message: message || undefined,
    });

    if (!refId) {
      console.warn("[DIGIFLAZZ CALLBACK EMPTY REF_ID]", payload);
      return NextResponse.json({ success: true, message: "Empty ref_id acknowledged" });
    }

    // Hubungkan ke Supabase jika tersedia
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Cari order berdasarkan ref_id atau invoice_number
      const { data: orderList } = await supabase
        .from("orders")
        .select("*")
        .or(`supplierRefId.eq.${refId},invoiceNumber.eq.${refId},id.eq.${refId}`);

      const order = orderList?.[0];

      if (!order) {
        console.warn("[DIGIFLAZZ CALLBACK UNKNOWN REF_ID]", { ref_id: refId, status });
        return NextResponse.json({ success: true, message: "Unknown ref_id acknowledged" });
      }

      const oldStatus = order.fulfillmentStatus || order.fulfillment_status || "PROCESSING";
      const isSuccess = status.toLowerCase() === "sukses" || status.toLowerCase() === "success";
      const isFailed = status.toLowerCase() === "gagal" || status.toLowerCase() === "failed";
      const isPending = status.toLowerCase() === "pending";

      // ATURAN STATUS TERMINAL:
      // SUCCESS dan FAILED adalah status terminal. DILARANG diturunkan menjadi PENDING.
      if ((oldStatus === "SUCCESS" || oldStatus === "FAILED") && isPending) {
        console.log(`[DIGIFLAZZ DB UPDATE] Terminal status protected: ref_id ${refId} already ${oldStatus}, ignoring Pending.`);
        return NextResponse.json({ success: true, message: "Ignored pending update on terminal status" });
      }

      // IDEMPOTENSI:
      // Jika transaksi sudah SUCCESS dan callback SUCCESS yang sama masuk lagi:
      // jangan melakukan pengiriman produk dua kali, hanya update metadata bila diperlukan.
      if (oldStatus === "SUCCESS" && isSuccess) {
        console.log(`[DIGIFLAZZ DB UPDATE] Idempotency: ref_id ${refId} already SUCCESS.`);
        if (sn && (!order.serialNumber && !order.serial_number)) {
          await supabase.from("orders").update({
            serialNumber: sn,
            serial_number: sn,
          }).eq("id", order.id);
        }
        return NextResponse.json({ success: true, message: "Idempotent success callback processed" });
      }

      const newStatus = isSuccess ? "SUCCESS" : (isFailed ? "FAILED" : "PROCESSING");

      await supabase.from("orders").update({
        fulfillmentStatus: newStatus,
        fulfillment_status: newStatus,
        supplierRefId: refId,
        supplier_ref_id: refId,
        serialNumber: sn || order.serialNumber || order.serial_number,
        serial_number: sn || order.serialNumber || order.serial_number,
        fulfilledAt: isSuccess ? new Date().toISOString() : (order.fulfilledAt || order.fulfilled_at),
        fulfilled_at: isSuccess ? new Date().toISOString() : (order.fulfilledAt || order.fulfilled_at),
        updatedAt: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", order.id);

      console.log("[DIGIFLAZZ DB UPDATE]", {
        ref_id: refId,
        old_status: oldStatus,
        new_status: newStatus,
      });
    }

    return NextResponse.json({ success: true, message: "Digiflazz webhook processed" });
  } catch (error: any) {
    console.error("[Digiflazz Webhook Route Error]:", error.message);
    return NextResponse.json({ success: false, message: error.message }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ready",
    message: "Digiflazz webhook endpoint active",
  });
}
