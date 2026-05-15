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

  if (!body.customer_name || !body.project_name) {
    return new Response(JSON.stringify({ ok: false, error: "Faltan campos requeridos" }), { status: 400 });
  }

  try {
    const payload: Record<string, unknown> = {
      project_name: body.project_name,
      customer_name: body.customer_name,
      customer_whatsapp: body.customer_whatsapp || "",
      material: body.material || "",
      color: body.color || "",
      priority: body.priority || "normal",
      status: body.status || "pending",
      is_paid: body.is_paid ?? false,
      unit_price: body.unit_price ?? 0,
      units_ordered: body.units_ordered ?? 1,
      units_done: body.units_done ?? 0,
      paid_amount: body.paid_amount ?? 0,
      order_date: body.order_date || new Date().toISOString().slice(0, 10),
      delivery_date: body.delivery_date || "",
      notes: body.notes || "",
    };
    const created = await locals.adminPB.collection("orders").create(payload);
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
