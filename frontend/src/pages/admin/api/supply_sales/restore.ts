import type { APIRoute } from "astro";
import { mapPBErrorToString } from "../../../../lib/admin-errors";

export const POST: APIRoute = async ({ locals, request }) => {
  if (!locals.adminPB) {
    return new Response(JSON.stringify({ ok: false, error: "No autenticado." }), { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), { status: 400 });
  }

  if (!body.customer_name || !body.item) {
    return new Response(JSON.stringify({ ok: false, error: "Faltan campos requeridos" }), { status: 400 });
  }

  try {
    const payload: Record<string, unknown> = {
      customer_name: body.customer_name,
      customer_whatsapp: body.customer_whatsapp || "",
      item: body.item,
      quantity: body.quantity ?? 1,
      unit_price: body.unit_price ?? 0,
      status: body.status || "reservado",
      is_paid: body.is_paid ?? false,
      color: body.color || "",
      sale_date: body.sale_date || new Date().toISOString().slice(0, 10),
      delivery_date: body.delivery_date || "",
      notes: body.notes || "",
    };
    const created = await locals.adminPB.collection("supply_sales").create(payload);
    return new Response(JSON.stringify({ ok: true, id: created.id }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    return new Response(JSON.stringify({ ok: false, error: mapPBErrorToString(err, "No se pudo restaurar") }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
