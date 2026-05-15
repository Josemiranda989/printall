import type { APIRoute } from "astro";
import { validatePaymentInput } from "../../../../lib/admin-payments";
import { mapPBErrorToString } from "../../../../lib/admin-errors";

export const POST: APIRoute = async ({ locals, request }) => {
  if (!locals.adminPB) {
    return new Response(JSON.stringify({ ok: false, error: "No autenticado." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "JSON inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = validatePaymentInput(body);
  if (!result.ok) {
    return new Response(JSON.stringify({ ok: false, error: result.error }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Verificar que el target exista — devuelve 404 si no, evita orfandad
  const targetCollection =
    result.data.target_type === "order" ? "orders" : "supply_sales";
  try {
    await locals.adminPB.collection(targetCollection).getOne(result.data.target_id);
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Target no encontrado" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const created = await locals.adminPB.collection("payments").create({
      target_type: result.data.target_type,
      target_id: result.data.target_id,
      amount: result.data.amount,
      method: result.data.method,
      paid_at: result.data.paid_at,
      notes: result.data.notes,
    });
    return new Response(JSON.stringify({ ok: true, id: created.id }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: mapPBErrorToString(err, "No se pudo registrar el pago"),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
