import type { APIRoute } from "astro";
import { mapPBErrorToString } from "../../../../../lib/admin-errors";

/**
 * POST /admin/api/quotes/[id]/convert
 *
 * Convierte un quote en un order:
 *  1. Crea un order con los datos del quote (project_name = quote.title)
 *  2. Marca el quote como "converted" con el order_id linkeado
 *
 * Si el quote ya está convertido, devuelve el order existente sin duplicar.
 */
export const POST: APIRoute = async ({ locals, params }) => {
  if (!locals.adminPB) {
    return new Response(JSON.stringify({ ok: false, error: "No autenticado." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const id = params.id;
  if (!id) {
    return new Response(JSON.stringify({ ok: false, error: "Falta id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const pb = locals.adminPB;

  let quote: Record<string, unknown>;
  try {
    quote = (await pb.collection("quotes").getOne(id)) as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Cotización no encontrada." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Idempotente: si ya está convertido, devolver el order existente.
  if (quote.status === "converted" && quote.converted_order_id) {
    return new Response(
      JSON.stringify({ ok: true, order_id: quote.converted_order_id }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const orderPayload = {
      project_name: String(quote.title ?? "Cotización"),
      customer_name: String(quote.customer_name ?? ""),
      customer_whatsapp: String(quote.customer_whatsapp ?? ""),
      material: "pla", // default — se puede editar después
      color: "negro",
      priority: "medium",
      status: "pending",
      unit_price: Number(quote.unit_price ?? 0),
      units_ordered: Number(quote.quantity ?? 1),
      units_done: 0,
      paid_amount: 0,
      is_paid: false,
      // order_date es required schema-level: la validación de PB corre antes
      // del hook que lo autocompleta, así que tenemos que pasarlo explícito.
      order_date: new Date().toISOString(),
      notes: [String(quote.description ?? ""), String(quote.notes ?? "")]
        .filter(Boolean)
        .join("\n\n"),
    };

    const order = await pb.collection("orders").create(orderPayload);

    // Marcar la quote como convertida
    await pb.collection("quotes").update(id, {
      status: "converted",
      converted_order_id: order.id,
    });

    return new Response(
      JSON.stringify({ ok: true, order_id: order.id }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: mapPBErrorToString(err, "No se pudo convertir la cotización"),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
