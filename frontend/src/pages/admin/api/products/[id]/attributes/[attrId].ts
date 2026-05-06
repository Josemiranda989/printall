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

type AttrRecord = {
  id: string;
  key: string;
  value: string;
  order: number;
  product: string;
};

/**
 * Verifica que el atributo exista y pertenezca al producto.
 * Retorna el record o null (misma respuesta 404 para no-existe vs no-tuyo).
 */
async function getOwnedAttr(
  pb: App.Locals["adminPB"],
  attrId: string,
  productId: string,
): Promise<AttrRecord | null> {
  try {
    const record = (await pb!
      .collection("product_attributes")
      .getOne(attrId)) as unknown as AttrRecord;
    // Verificar ownership — misma respuesta para no-existe vs no-tuyo (no leak info)
    if (record.product !== productId) return null;
    return record;
  } catch {
    return null;
  }
}

/**
 * PATCH /admin/api/products/[id]/attributes/[attrId]
 * Body JSON: { key, value }
 * Actualiza key y value de un atributo existente.
 */
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const authError = requireAuth(locals);
  if (authError) return authError;

  const { id, attrId } = params;
  if (!id) return json({ ok: false, error: "ID de producto requerido." }, 400);
  if (!attrId) return json({ ok: false, error: "ID de atributo requerido." }, 400);

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

  // Verificar que el atributo existe y pertenece al producto
  const attr = await getOwnedAttr(pb, attrId, id);
  if (!attr) {
    return json({ ok: false, error: "Atributo no encontrado." }, 404);
  }

  // Actualizar
  let updated: AttrRecord;
  try {
    updated = (await pb
      .collection("product_attributes")
      .update(attrId, { key, value })) as unknown as AttrRecord;
  } catch (err: unknown) {
    const e = err as { message?: string };
    return json({ ok: false, error: e.message ?? "Error al actualizar el atributo." }, 500);
  }

  return json({
    ok: true,
    attribute: {
      id: updated.id,
      key: updated.key,
      value: updated.value,
      order: updated.order,
    },
  });
};

/**
 * DELETE /admin/api/products/[id]/attributes/[attrId]
 * Elimina un atributo. Verifica ownership antes de borrar.
 */
export const DELETE: APIRoute = async ({ params, locals }) => {
  const authError = requireAuth(locals);
  if (authError) return authError;

  const { id, attrId } = params;
  if (!id) return json({ ok: false, error: "ID de producto requerido." }, 400);
  if (!attrId) return json({ ok: false, error: "ID de atributo requerido." }, 400);

  const pb = locals.adminPB!;

  // Verificar que el atributo existe y pertenece al producto
  const attr = await getOwnedAttr(pb, attrId, id);
  if (!attr) {
    return json({ ok: false, error: "Atributo no encontrado." }, 404);
  }

  try {
    await pb.collection("product_attributes").delete(attrId);
  } catch (err: unknown) {
    const e = err as { message?: string };
    return json({ ok: false, error: e.message ?? "Error al eliminar el atributo." }, 500);
  }

  return json({ ok: true });
};
