import type { APIRoute } from "astro";
import { validateSupplySalePaidPatch } from "../../../../../lib/admin-supply-sales";
import { mapPBErrorToString } from "../../../../../lib/admin-errors";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requireAuth(locals: App.Locals) {
  if (!locals.adminPB) return json({ ok: false, error: "No autenticado." }, 401);
  return null;
}

/**
 * PATCH /admin/api/supply_sales/[id]/paid
 * Body JSON: { is_paid: boolean }
 *
 * Toggle simple — supply_sales no tiene paid_amount, así que solo flipea is_paid.
 */
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const authError = requireAuth(locals);
  if (authError) return authError;

  const { id } = params;
  if (!id) return json({ ok: false, error: "ID requerido." }, 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Body JSON inválido." }, 400);
  }

  const validation = validateSupplySalePaidPatch(body);
  if (!validation.ok) {
    return json({ ok: false, error: validation.error }, 422);
  }

  const pb = locals.adminPB!;

  try {
    await pb.collection("supply_sales").getOne(id, { fields: "id" });
  } catch {
    return json({ ok: false, error: "Venta no encontrada." }, 404);
  }

  try {
    await pb.collection("supply_sales").update(id, { is_paid: validation.is_paid });
  } catch (err: unknown) {
    return json(
      { ok: false, error: mapPBErrorToString(err, "Error al actualizar pago.") },
      500,
    );
  }

  return json({ ok: true, is_paid: validation.is_paid });
};
