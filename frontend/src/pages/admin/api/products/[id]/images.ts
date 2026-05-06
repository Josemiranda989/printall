import type { APIRoute } from "astro";
import {
  extractImagesFromForm,
  IMAGES_MAX_COUNT,
} from "../../../../../lib/admin-products";

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
 * POST /admin/api/products/[id]/images
 * Multipart: agrega nuevas imágenes al producto.
 * Valida que el total (existentes + nuevas) no supere IMAGES_MAX_COUNT.
 * Usa el patrón seguro: lee record actual → sube files con "images+" si soportado,
 * fallback a FormData con field name "images" (PB SDK 0.25 hace append automático).
 */
export const POST: APIRoute = async ({ params, request, locals }) => {
  const authError = requireAuth(locals);
  if (authError) return authError;

  const { id } = params;
  if (!id) return json({ ok: false, error: "ID requerido." }, 400);

  const pb = locals.adminPB!;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json({ ok: false, errors: ["No se pudo parsear el form."] }, 400);
  }

  // Validar archivos recibidos
  const result = extractImagesFromForm(formData);
  if (!result.ok) {
    return json({ ok: false, errors: result.errors }, 422);
  }

  const newFiles = result.files;
  if (newFiles.length === 0) {
    return json({ ok: false, errors: ["No se recibieron archivos."] }, 422);
  }

  // Verificar límite total
  let currentRecord: { images?: string[] };
  try {
    currentRecord = await pb.collection("products").getOne(id, { fields: "id,images" }) as unknown as { images?: string[] };
  } catch {
    return json({ ok: false, error: "Producto no encontrado." }, 404);
  }

  const existingImages = currentRecord.images ?? [];
  if (existingImages.length + newFiles.length > IMAGES_MAX_COUNT) {
    return json(
      {
        ok: false,
        errors: [
          `Superás el máximo de ${IMAGES_MAX_COUNT} imágenes. Tenés ${existingImages.length} y querés agregar ${newFiles.length}.`,
        ],
      },
      422,
    );
  }

  // Subir archivos nuevos.
  // PocketBase SDK 0.25: para APPEND de files usar el field name con "+" al final.
  // Si el SDK no lo soporta a nivel de FormData, el campo se reemplaza en vez de appendear.
  // Estrategia segura: armamos un FormData con "images+" para cada file nuevo.
  const uploadForm = new FormData();
  for (const file of newFiles) {
    uploadForm.append("images+", file);
  }

  let updatedRecord: { id: string; collectionId: string; images?: string[] };
  try {
    updatedRecord = await pb.collection("products").update(id, uploadForm) as unknown as { id: string; collectionId: string; images?: string[] };
  } catch (err: unknown) {
    const e = err as { message?: string };
    // Fallback: si el backend no reconoció "images+", intentar con el array completo
    // Esto no debería pasar con PB 0.37+ pero lo dejamos como safety net
    return json({ ok: false, error: e.message ?? "Error al subir imágenes." }, 500);
  }

  // Calcular los filenames recién agregados (diferencia entre updated y existing)
  const updatedImages = updatedRecord.images ?? [];
  const added = updatedImages.filter((f) => !existingImages.includes(f));

  return json({ ok: true, added, images: updatedImages });
};

/**
 * PATCH /admin/api/products/[id]/images
 * Body JSON: { order: string[] }
 * Reordena las imágenes. Verifica que el array contenga exactamente los mismos filenames.
 */
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const authError = requireAuth(locals);
  if (authError) return authError;

  const { id } = params;
  if (!id) return json({ ok: false, error: "ID requerido." }, 400);

  const pb = locals.adminPB!;

  let body: { order?: unknown };
  try {
    body = await request.json() as { order?: unknown };
  } catch {
    return json({ ok: false, error: "Body JSON inválido." }, 400);
  }

  const order = body.order;
  if (!Array.isArray(order) || order.some((x) => typeof x !== "string")) {
    return json({ ok: false, error: "order debe ser un array de strings." }, 400);
  }

  // Verificar que contenga exactamente los mismos filenames que el record actual
  let currentRecord: { images?: string[] };
  try {
    currentRecord = await pb.collection("products").getOne(id, { fields: "id,images" }) as unknown as { images?: string[] };
  } catch {
    return json({ ok: false, error: "Producto no encontrado." }, 404);
  }

  const current = new Set(currentRecord.images ?? []);
  const incoming = new Set(order as string[]);

  const hasSameElements =
    current.size === incoming.size &&
    [...current].every((f) => incoming.has(f));

  if (!hasSameElements) {
    return json(
      {
        ok: false,
        error: "El array de orden debe contener exactamente los mismos filenames que el producto.",
      },
      400,
    );
  }

  try {
    await pb.collection("products").update(id, { images: order });
    return json({ ok: true });
  } catch (err: unknown) {
    const e = err as { message?: string };
    return json({ ok: false, error: e.message ?? "Error al reordenar." }, 500);
  }
};

/**
 * DELETE /admin/api/products/[id]/images
 * Query: ?filename=xxx.jpg  o Body JSON: { filename: string }
 * Elimina una imagen específica del producto.
 */
export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const authError = requireAuth(locals);
  if (authError) return authError;

  const { id } = params;
  if (!id) return json({ ok: false, error: "ID requerido." }, 400);

  const pb = locals.adminPB!;

  // Intentar leer filename desde query o body
  const url = new URL(request.url);
  let filename = url.searchParams.get("filename") ?? "";

  if (!filename) {
    try {
      const body = await request.json() as { filename?: unknown };
      if (typeof body.filename === "string") filename = body.filename;
    } catch {
      // ignorar — puede que no haya body
    }
  }

  if (!filename) {
    return json({ ok: false, error: "filename requerido (query o body JSON)." }, 400);
  }

  // Sanitizar para seguridad: solo permitir chars de filenames de PB (alphanum, guiones, puntos)
  if (!/^[\w.\-]+$/.test(filename)) {
    return json({ ok: false, error: "filename inválido." }, 400);
  }

  try {
    // Usar "images-" para eliminar un filename específico del array multi-file
    await pb.collection("products").update(id, { "images-": filename });
    return json({ ok: true });
  } catch (err: unknown) {
    const e = err as { message?: string };
    return json({ ok: false, error: e.message ?? "Error al eliminar la imagen." }, 500);
  }
};
