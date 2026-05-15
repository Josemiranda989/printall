import type { APIRoute } from "astro";
import { mapPBErrorToString } from "../../../../lib/admin-errors";

export const DELETE: APIRoute = async ({ locals, params }) => {
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

  try {
    await locals.adminPB.collection("payments").delete(id);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: mapPBErrorToString(err, "No se pudo eliminar el pago"),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
