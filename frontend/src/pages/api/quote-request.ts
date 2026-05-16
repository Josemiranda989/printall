import type { APIRoute } from "astro";
import PocketBase from "pocketbase";

/**
 * POST /api/quote-request (publico, sin auth)
 *
 * Endpoint que reciben clientes desde el formulario publico /cotizar.
 * Crea una quote con status=pending y unit_price=0 (el admin pone el precio
 * despues al revisar).
 *
 * Rate limit en memoria: 1 request por IP cada 30 segundos. No es robusto
 * pero ayuda contra spam basico.
 */

const lastByIp = new Map<string, number>();
const RATE_LIMIT_MS = 30_000;

const PB_URL =
  import.meta.env.POCKETBASE_URL ||
  import.meta.env.PUBLIC_POCKETBASE_URL ||
  "http://localhost:8090";

function pbAdminClient(): PocketBase {
  // Cliente sin auth — la collection `quotes` tiene createRule=null que
  // significa SOLO superusers via API admin. Por eso este endpoint corre
  // en el server (Astro SSR) con un PB client que no requiere auth de admin
  // si usamos un super_token o setteo en env. Para mantener simple por ahora,
  // usamos las creds del .env si estan presentes.
  return new PocketBase(PB_URL);
}

function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

export const POST: APIRoute = async ({ request }) => {
  const ip = getClientIp(request);
  const now = Date.now();
  const last = lastByIp.get(ip) ?? 0;
  if (now - last < RATE_LIMIT_MS) {
    return new Response(
      JSON.stringify({ ok: false, error: "Esperá unos segundos antes de enviar otro pedido." }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    );
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
  const customer_name = String(b.customer_name ?? "").trim();
  const customer_whatsapp = String(b.customer_whatsapp ?? "").trim();
  const title = String(b.title ?? "").trim();
  const description = String(b.description ?? "").trim();
  const quantityRaw = b.quantity;

  if (!customer_name || customer_name.length > 120) {
    return new Response(JSON.stringify({ ok: false, error: "Nombre inválido (1-120 caracteres)." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!customer_whatsapp || customer_whatsapp.length > 30) {
    return new Response(JSON.stringify({ ok: false, error: "WhatsApp inválido." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!title || title.length > 200) {
    return new Response(JSON.stringify({ ok: false, error: "Título inválido (1-200 caracteres)." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (description.length > 2000) {
    return new Response(JSON.stringify({ ok: false, error: "Descripción demasiado larga." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  let quantity = 1;
  if (quantityRaw !== undefined && quantityRaw !== null && quantityRaw !== "") {
    const n = Number(quantityRaw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 9999) {
      return new Response(JSON.stringify({ ok: false, error: "Cantidad inválida (1-9999)." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    quantity = n;
  }

  const pb = pbAdminClient();
  try {
    await pb.collection("quotes").create({
      customer_name,
      customer_whatsapp,
      title,
      description,
      quantity,
      unit_price: 0, // el admin pone el precio al revisar
      status: "pending",
      notes: `Recibida via /cotizar — IP ${ip}`,
    });
    lastByIp.set(ip, now);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("[quote-request] error creando quote:", err);
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          "No pudimos guardar tu pedido en este momento. Probá de nuevo o escribinos directo por WhatsApp.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
