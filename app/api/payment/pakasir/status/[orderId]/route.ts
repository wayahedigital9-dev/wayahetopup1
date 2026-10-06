import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  GET /api/payment/pakasir/status/[orderId]                    ║
 * ║  Membaca status transaksi langsung dari DATABASE             ║
 * ║  Sumber kebenaran: Database + Webhook                        ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> | { orderId: string } }
) {
  try {
    const resolvedParams = await params;
    const orderId = resolvedParams.orderId;

    if (!orderId) {
      return NextResponse.json(
        {
          success: false,
          message: "Order ID wajib disertakan",
        },
        { status: 400 }
      );
    }

    let order: any = null;

    // 1. Baca dari Supabase
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
          .or(`invoice_number.eq.${orderId},id.eq.${orderId}`)
          .single();
        if (data) order = data;
      } catch (_) {}
    }

    // 2. Baca dari Prisma jika belum ditemukan
    if (!order) {
      try {
        const { PrismaClient } = await import("@prisma/client");
        const prisma = new PrismaClient();
        order = await prisma.order.findFirst({
          where: {
            OR: [{ id: orderId }, { invoiceNumber: orderId }],
          },
        });
        await prisma.$disconnect();
      } catch (_) {}
    }

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          error: "ORDER_NOT_FOUND",
          message: "Order tidak ditemukan",
        },
        { status: 404 }
      );
    }

    const paymentStatus = String(order.payment_status || order.paymentStatus || "pending").toLowerCase();
    const fulfillmentStatus = String(order.fulfillment_status || order.fulfillmentStatus || "waiting_payment").toLowerCase();
    const amount = Number(order.amount || order.total_amount || order.totalAmount || 0);
    const totalPayment = Number(order.total_payment || order.total_amount || order.totalAmount || amount);

    return NextResponse.json({
      success: true,
      order: {
        order_id: order.invoice_number || order.invoiceNumber || order.id,
        payment_status: paymentStatus === "paid" ? "paid" : (paymentStatus === "unpaid" ? "pending" : paymentStatus),
        fulfillment_status: fulfillmentStatus,
        amount,
        total_payment: totalPayment,
        payment_link: order.payment_link || order.paymentLink || null,
        qr_string: order.qr_string || order.qrString || null,
      },
    });
  } catch (error: any) {
    console.error("GET PAKASIR STATUS ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
