import type { APIRoute } from "astro";
import { validateProgressPatch } from "../../../../../lib/admin-orders";
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
 * PATCH /admin/api/orders/[id]/progress
 * Body JSON: { units_done: number } | { delta: number }
 *
 * Acepta un valor absoluto o un delta (+1/-1). El servidor clampea entre
 * 0 y units_ordered para evitar valores fuera de rango.
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

  const validation = validateProgressPatch(body);
  if (!validation.ok) {
    return json({ ok: false, error: validation.error }, 422);
  }

  const pb = locals.adminPB!;

  let current: { units_done?: number; units_ordered?: number };
  try {
    current = await pb.collection("orders").getOne(id, {
      fields: "units_done,units_ordered",
    });
  } catch {
    return json({ ok: false, error: "Pedido no encontrado." }, 404);
  }

  const ordered = current.units_ordered ?? 0;
  let newDone: number;
  if (validation.units_done !== undefined) {
    newDone = validation.units_done;
  } else {
    newDone = (current.units_done ?? 0) + (validation.delta ?? 0);
  }
  // Clamp 0..units_ordered
  newDone = Math.max(0, Math.min(newDone, ordered));

  try {
    await pb.collection("orders").update(id, { units_done: newDone });
  } catch (err: unknown) {
    return json(
      { ok: false, error: mapPBErrorToString(err, "Error al actualizar progreso.") },
      500,
    );
  }

  return json({ ok: true, units_done: newDone, units_ordered: ordered });
};
