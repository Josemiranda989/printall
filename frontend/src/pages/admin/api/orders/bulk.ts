import type { APIRoute } from "astro";
import { mapPBErrorToString } from "../../../../lib/admin-errors";

const VALID_ACTIONS = new Set(["paid", "delivered", "cancel"]);

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

  const b = body as Record<string, unknown>;
  const ids = Array.isArray(b.ids) ? (b.ids as unknown[]).map(String).filter(Boolean) : [];
  const action = String(b.action ?? "");

  if (!VALID_ACTIONS.has(action)) {
    return new Response(JSON.stringify({ ok: false, error: "Acción inválida" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (ids.length === 0) {
    return new Response(JSON.stringify({ ok: false, error: "Faltan ids" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (ids.length > 100) {
    return new Response(JSON.stringify({ ok: false, error: "Maximo 100 por bulk" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const pb = locals.adminPB;
  const updated: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const id of ids) {
    try {
      // Necesitamos el record actual para algunos calculos (paid → paid_amount = total).
      const record = (await pb.collection("orders").getOne(id)) as unknown as {
        unit_price: number;
        units_ordered: number;
      };

      const payload: Record<string, unknown> = {};
      if (action === "paid") {
        const total = (record.unit_price ?? 0) * (record.units_ordered ?? 0);
        payload.paid_amount = total;
        payload.is_paid = true;
      } else if (action === "delivered") {
        payload.status = "delivered";
        // El hook de orders auto-completa delivery_date si está vacío.
      } else if (action === "cancel") {
        payload.status = "cancelled";
      }

      await pb.collection("orders").update(id, payload);
      updated.push(id);
    } catch (err: unknown) {
      failed.push({ id, error: mapPBErrorToString(err, "Error al actualizar") });
    }
  }

  return new Response(
    JSON.stringify({
      ok: failed.length === 0,
      updated_count: updated.length,
      failed_count: failed.length,
      failed,
    }),
    {
      status: failed.length === 0 ? 200 : 207,
      headers: { "Content-Type": "application/json" },
    },
  );
};
