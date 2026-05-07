import type { APIRoute } from "astro";
import { mapPBErrorToString } from "../../../../lib/admin-errors";

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
 * PATCH /admin/api/categories/reorder
 * Body JSON: { order: string[] }
 * Reordena las categorías. Los IDs deben corresponder exactamente al conjunto
 * de categorías existentes.
 */
export const PATCH: APIRoute = async ({ request, locals }) => {
  const authError = requireAuth(locals);
  if (authError) return authError;

  const pb = locals.adminPB!;

  let body: { order?: unknown };
  try {
    body = (await request.json()) as { order?: unknown };
  } catch {
    return json({ ok: false, error: "Body JSON inválido." }, 400);
  }

  const order = body.order;
  if (!Array.isArray(order) || order.some((x) => typeof x !== "string")) {
    return json({ ok: false, error: "order debe ser un array de strings (IDs)." }, 400);
  }

  // Leer todas las categorías existentes
  let existingCategories: { id: string }[];
  try {
    existingCategories = (await pb.collection("categories").getFullList({
      fields: "id",
    })) as unknown as { id: string }[];
  } catch {
    return json({ ok: false, error: "Error al obtener las categorías." }, 500);
  }

  // Set-equality check
  const existingSet = new Set(existingCategories.map((c) => c.id));
  const incomingSet = new Set(order as string[]);

  const hasSameElements =
    existingSet.size === incomingSet.size &&
    [...existingSet].every((catId) => incomingSet.has(catId));

  if (!hasSameElements) {
    return json(
      {
        ok: false,
        error:
          "El array de orden debe contener exactamente los mismos IDs de categorías.",
      },
      400,
    );
  }

  // Actualizar order en serie para evitar conflictos de PocketBase
  for (let i = 0; i < (order as string[]).length; i++) {
    const catId = (order as string[])[i];
    try {
      await pb.collection("categories").update(catId, { order: i });
    } catch (err: unknown) {
      return json(
        {
          ok: false,
          error: mapPBErrorToString(err, `Error al actualizar orden de la categoría ${catId}.`),
        },
        500,
      );
    }
  }

  return json({ ok: true });
};
