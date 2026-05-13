import type { APIRoute } from "astro";
import { validatePaidPatch } from "../../../../../lib/admin-orders";
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
 * PATCH /admin/api/orders/[id]/paid
 *
 * Acepta dos formatos en el body:
 *  - { is_paid: boolean }     → toggle clásico de la tabla; setea paid_amount = total | 0.
 *  - { paid_amount: number }  → monto custom (seña parcial); clamps a [0, total]
 *                                y deriva is_paid (true si paid_amount >= total).
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

  const validation = validatePaidPatch(body);
  if (!validation.ok) {
    return json({ ok: false, error: validation.error }, 422);
  }

  const pb = locals.adminPB!;

  // Necesitamos el record para calcular el total y setear paid_amount coherente.
  let record: { unit_price?: number; units_ordered?: number };
  try {
    record = await pb.collection("orders").getOne(id, {
      fields: "id,unit_price,units_ordered",
    });
  } catch {
    return json({ ok: false, error: "Pedido no encontrado." }, 404);
  }

  const total = (Number(record.unit_price) || 0) * (Number(record.units_ordered) || 0);

  let newPaidAmount: number;
  let newIsPaid: boolean;

  if (validation.paid_amount !== undefined) {
    // Monto custom: clamp a [0, total] y derivar is_paid.
    newPaidAmount = Math.max(0, Math.min(validation.paid_amount, total));
    newIsPaid = total > 0 && newPaidAmount >= total;
  } else {
    // Toggle: ON = total, OFF = 0.
    newIsPaid = !!validation.is_paid;
    newPaidAmount = newIsPaid ? total : 0;
  }

  try {
    await pb.collection("orders").update(id, {
      is_paid: newIsPaid,
      paid_amount: newPaidAmount,
    });
  } catch (err: unknown) {
    return json(
      { ok: false, error: mapPBErrorToString(err, "Error al actualizar pago.") },
      500,
    );
  }

  return json({ ok: true, is_paid: newIsPaid, paid_amount: newPaidAmount });
};
