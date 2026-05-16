import type { APIRoute } from "astro";
import { mapPBErrorToString } from "../../../../../lib/admin-errors";

/**
 * POST /admin/api/orders/[id]/attachments
 * Body: multipart/form-data con campo "file" (Blob).
 * Sube UN archivo al record. Si querés borrar archivos existentes hay que
 * usar el DELETE de mismo path con ?filename=... query param.
 */
export const POST: APIRoute = async ({ locals, params, request }) => {
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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Body inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return new Response(JSON.stringify({ ok: false, error: "Falta archivo" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // PocketBase acepta FormData con campo `attachments+` para AGREGAR (no reemplazar)
  // archivos a un file field multi. Sin el "+", se sobreescriben.
  const pbForm = new FormData();
  pbForm.append("attachments+", file);

  try {
    const updated = await locals.adminPB
      .collection("orders")
      .update(id, pbForm);
    return new Response(
      JSON.stringify({
        ok: true,
        attachments: (updated as Record<string, unknown>).attachments ?? [],
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: mapPBErrorToString(err, "No se pudo subir el archivo"),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};

/**
 * DELETE /admin/api/orders/[id]/attachments?filename=foo.jpg
 * Borra un attachment específico del record por nombre de archivo.
 */
export const DELETE: APIRoute = async ({ locals, params, url }) => {
  if (!locals.adminPB) {
    return new Response(JSON.stringify({ ok: false, error: "No autenticado." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const id = params.id;
  const filename = url.searchParams.get("filename");
  if (!id || !filename) {
    return new Response(
      JSON.stringify({ ok: false, error: "Falta id o filename" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // PocketBase: pasar `attachments-` con el filename quita ese archivo del array.
  const pbForm = new FormData();
  pbForm.append("attachments-", filename);

  try {
    const updated = await locals.adminPB
      .collection("orders")
      .update(id, pbForm);
    return new Response(
      JSON.stringify({
        ok: true,
        attachments: (updated as Record<string, unknown>).attachments ?? [],
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: mapPBErrorToString(err, "No se pudo borrar el archivo"),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
