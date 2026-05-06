import type { APIRoute } from "astro";
import { validateAttribute } from "../../../../../../lib/admin-attributes";

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
 * POST /admin/api/products/[id]/attributes
 * Body JSON: { key, value }
 * Crea un nuevo atributo para el producto.
 */
export const POST: APIRoute = async ({ params, request, locals }) => {
  const authError = requireAuth(locals);
  if (authError) return authError;

  const { id } = params;
  if (!id) return json({ ok: false, error: "ID requerido." }, 400);

  const pb = locals.adminPB!;

  let body: { key?: unknown; value?: unknown };
  try {
    body = (await request.json()) as { key?: unknown; value?: unknown };
  } catch {
    return json({ ok: false, error: "Body JSON inválido." }, 400);
  }

  // Validar key y value
  const validation = validateAttribute({ key: body.key, value: body.value });
  if (!validation.ok) {
    return json({ ok: false, errors: validation.errors }, 422);
  }

  const { key, value } = validation.data;

  // Verificar que el producto existe
  try {
    await pb.collection("products").getOne(id, { fields: "id" });
  } catch {
    return json({ ok: false, error: "Producto no encontrado." }, 404);
  }

  // Calcular order: max(orders existentes) + 1, o 0 si no hay attrs
  let nextOrder = 0;
  try {
    const existing = (await pb.collection("product_attributes").getFullList({
      filter: `product = "${id}"`,
      fields: "order",
    })) as unknown as { order?: number }[];

    if (existing.length > 0) {
      const maxOrder = Math.max(...existing.map((a) => a.order ?? 0));
      nextOrder = maxOrder + 1;
    }
  } catch {
    // Si falla la consulta, usamos 0 como fallback — no bloquear la creación
    nextOrder = 0;
  }

  // Crear el atributo
  let created: { id: string; key: string; value: string; order: number };
  try {
    created = (await pb.collection("product_attributes").create({
      product: id,
      key,
      value,
      order: nextOrder,
    })) as unknown as { id: string; key: string; value: string; order: number };
  } catch (err: unknown) {
    const e = err as { message?: string };
    return json({ ok: false, error: e.message ?? "Error al crear el atributo." }, 500);
  }

  return json(
    {
      ok: true,
      attribute: {
        id: created.id,
        key: created.key,
        value: created.value,
        order: created.order,
      },
    },
    201,
  );
};

/**
 * PATCH /admin/api/products/[id]/attributes
 * Body JSON: { order: string[] }
 * Reordena los atributos del producto. Los IDs deben corresponder exactamente
 * al conjunto de atributos existentes del producto.
 */
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const authError = requireAuth(locals);
  if (authError) return authError;

  const { id } = params;
  if (!id) return json({ ok: false, error: "ID requerido." }, 400);

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

  // Verificar que los IDs corresponden al producto
  let existingAttrs: { id: string }[];
  try {
    existingAttrs = (await pb.collection("product_attributes").getFullList({
      filter: `product = "${id}"`,
      fields: "id",
    })) as unknown as { id: string }[];
  } catch {
    return json({ ok: false, error: "Error al obtener atributos del producto." }, 500);
  }

  const existingSet = new Set(existingAttrs.map((a) => a.id));
  const incomingSet = new Set(order as string[]);

  const hasSameElements =
    existingSet.size === incomingSet.size &&
    [...existingSet].every((attrId) => incomingSet.has(attrId));

  if (!hasSameElements) {
    return json(
      {
        ok: false,
        error:
          "El array de orden debe contener exactamente los mismos IDs de atributos del producto.",
      },
      400,
    );
  }

  // Actualizar order en serie para evitar conflictos de PocketBase
  for (let i = 0; i < (order as string[]).length; i++) {
    const attrId = (order as string[])[i];
    try {
      await pb.collection("product_attributes").update(attrId, { order: i });
    } catch (err: unknown) {
      const e = err as { message?: string };
      return json(
        {
          ok: false,
          error: `Error al actualizar orden del atributo ${attrId}: ${e.message ?? "error desconocido"}.`,
        },
        500,
      );
    }
  }

  return json({ ok: true });
};
