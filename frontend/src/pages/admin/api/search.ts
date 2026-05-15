import type { APIRoute } from "astro";

/** Limita a 5 resultados por categoria — keep el modal navegable. */
const MAX_PER_CATEGORY = 5;

/**
 * Escapa para usar dentro de filtro PocketBase con comillas dobles.
 * Quita comillas dobles y backslashes — chars no presentes en datos reales.
 */
function escapeFilter(q: string): string {
  return q.replace(/[\\"]/g, "");
}

export const GET: APIRoute = async ({ locals, url }) => {
  if (!locals.adminPB) {
    return new Response(JSON.stringify({ ok: false, error: "No autenticado." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return new Response(JSON.stringify({ ok: true, results: [] }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const safe = escapeFilter(q);
  const pb = locals.adminPB;

  // Lanzamos las 4 queries en paralelo. Cada una con error handling
  // independiente — un error en uno no rompe el resto.
  const [orders, sales, clients, products] = await Promise.all([
    pb
      .collection("orders")
      .getList(1, MAX_PER_CATEGORY, {
        filter: `project_name ~ "${safe}" || customer_name ~ "${safe}" || order_number ~ "${safe}"`,
        sort: "-created",
        fields: "id,order_number,project_name,customer_name,status",
      })
      .catch(() => ({ items: [] as Record<string, unknown>[] })),
    pb
      .collection("supply_sales")
      .getList(1, MAX_PER_CATEGORY, {
        filter: `customer_name ~ "${safe}"`,
        sort: "-created",
        fields: "id,customer_name,quantity,status",
      })
      .catch(() => ({ items: [] as Record<string, unknown>[] })),
    pb
      .collection("clients")
      .getList(1, MAX_PER_CATEGORY, {
        filter: `name ~ "${safe}" || whatsapp ~ "${safe}" || name_norm ~ "${safe}"`,
        sort: "name",
        fields: "id,name,whatsapp",
      })
      .catch(() => ({ items: [] as Record<string, unknown>[] })),
    pb
      .collection("products")
      .getList(1, MAX_PER_CATEGORY, {
        filter: `name ~ "${safe}" || slug ~ "${safe}"`,
        sort: "name",
        fields: "id,name,slug",
      })
      .catch(() => ({ items: [] as Record<string, unknown>[] })),
  ]);

  const results = [
    ...orders.items.map((o) => ({
      type: "order" as const,
      id: String(o.id),
      title: String(o.project_name ?? ""),
      subtitle: `${o.order_number ?? ""} · ${o.customer_name ?? ""}`,
      href: `/admin/pedidos/${o.id}`,
    })),
    ...sales.items.map((s) => ({
      type: "sale" as const,
      id: String(s.id),
      title: String(s.customer_name ?? ""),
      subtitle: `Insumo · cantidad ${s.quantity ?? "?"}`,
      href: `/admin/insumos/${s.id}`,
    })),
    ...clients.items.map((c) => ({
      type: "client" as const,
      id: String(c.id),
      title: String(c.name ?? ""),
      subtitle: String(c.whatsapp ?? "") || "Sin WhatsApp",
      href: `/admin/clientes/${c.id}`,
    })),
    ...products.items.map((p) => ({
      type: "product" as const,
      id: String(p.id),
      title: String(p.name ?? ""),
      subtitle: String(p.slug ?? ""),
      href: `/admin/productos/${p.id}`,
    })),
  ];

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { "Content-Type": "application/json" },
  });
};
