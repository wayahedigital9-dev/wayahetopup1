import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/orders/[ref_id]
 * Polling status pesanan via Database untuk frontend / external integration
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ ref_id: string }> }
) {
  try {
    const { ref_id } = await params;
    const cleanRef = String(ref_id || "").trim();

    if (!cleanRef) {
      return NextResponse.json({ success: false, message: "ref_id wajib diisi" }, { status: 400 });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: orderList } = await supabase
        .from("orders")
        .select("*")
        .or(`supplierRefId.eq.${cleanRef},invoiceNumber.eq.${cleanRef},id.eq.${cleanRef}`);

      const order = orderList?.[0];
      if (order) {
        return NextResponse.json({
          success: true,
          data: order,
          paymentStatus: order.paymentStatus || order.payment_status || "PENDING",
          fulfillmentStatus: order.fulfillmentStatus || order.fulfillment_status || "NOT_STARTED",
          serialNumber: order.serialNumber || order.serial_number || null,
          refId: order.supplierRefId || order.supplier_ref_id || cleanRef,
        });
      }
    }

    return NextResponse.json(
      { success: false, message: "Order tidak ditemukan." },
      { status: 404 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
