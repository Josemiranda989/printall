import type PocketBase from "pocketbase";
import { orderBalanceDue, supplySaleTotal, type Order, type SupplySale, type MaterialPrice } from "./types";
import { getOrderContext, getSaleContext, renderTemplate, type WhatsAppTemplate } from "./admin-templates";
import { getWhatsAppUrl } from "./pocketbase";

/**
 * Item unificado de cobranza — incluye datos crudos + helpers ya resueltos
 * (mensaje renderizado, link wa.me) para que el componente del listado
 * sea puramente visual.
 */
export type PendingPayment = {
  type: "order" | "sale";
  id: string;
  customer_name: string;
  customer_whatsapp: string;
  label: string;
  total: number;
  paid: number;
  saldo: number;
  created: string;
  days_old: number;
  href: string;
  reminder_body: string | null;
  reminder_href: string | null;
};

/**
 * Devuelve la lista combinada de pedidos + ventas con saldo pendiente > 0,
 * ordenada por días desde creación (más viejos primero — más urgentes).
 *
 * Cada item viene con `reminder_body` (template renderizado server-side) y
 * `reminder_href` (link wa.me listo para clickear). Si no hay teléfono o no
 * hay template aplicable, esos campos vienen como null.
 *
 * Para mantener el "default template" simple sin hardcodear nombres, buscamos
 * por el primer template tipo `order` o `sale` cuyo nombre contenga "pago"
 * o "recordatorio" (case-insensitive). Si no hay, se ofrece el primero del
 * scope. Si tampoco hay, queda null.
 */
export async function fetchPendingPayments(pb: PocketBase): Promise<PendingPayment[]> {
  const [orders, sales, materials, allTemplates] = await Promise.all([
    pb.collection("orders").getFullList({
      filter: "is_paid = false && status != 'cancelled'",
      sort: "-created",
      batch: 500,
    }) as unknown as Promise<Order[]>,
    pb.collection("supply_sales").getFullList({
      filter: "is_paid = false && status != 'cancelado'",
      sort: "-created",
      batch: 500,
    }) as unknown as Promise<SupplySale[]>,
    pb.collection("materials").getFullList({
      fields: "id,name",
      batch: 500,
    }) as unknown as Promise<Pick<MaterialPrice, "id" | "name">[]>,
    pb.collection("whatsapp_templates").getFullList({
      sort: "name",
    }) as unknown as Promise<WhatsAppTemplate[]>,
  ]);

  // Elegir un template "default" para recordatorio en cada contexto.
  // Preferimos los que tengan "pago" o "recordatorio" en el nombre.
  function pickReminderTemplate(scope: "order" | "sale"): WhatsAppTemplate | null {
    const applicable = allTemplates.filter(
      (t) => t.applies_to === scope || t.applies_to === "any",
    );
    const preferred = applicable.find((t) =>
      /pago|recordator/i.test(t.name),
    );
    return preferred ?? applicable[0] ?? null;
  }

  const orderTemplate = pickReminderTemplate("order");
  const saleTemplate = pickReminderTemplate("sale");
  const materialById = new Map(materials.map((m) => [m.id, m.name]));

  const now = Date.now();
  function daysSince(iso: string): number {
    const t = new Date(iso).getTime();
    if (isNaN(t)) return 0;
    return Math.max(0, Math.floor((now - t) / (1000 * 60 * 60 * 24)));
  }

  function buildReminder(
    template: WhatsAppTemplate | null,
    context: Record<string, string | undefined>,
    whatsapp: string,
  ): { body: string | null; href: string | null } {
    if (!template) return { body: null, href: null };
    const body = renderTemplate(template.body, context);
    const phone = (whatsapp ?? "").replace(/\D/g, "");
    const href = phone ? getWhatsAppUrl(phone, body) : null;
    return { body, href };
  }

  const items: PendingPayment[] = [];

  for (const o of orders) {
    const saldo = orderBalanceDue(o);
    if (saldo <= 0) continue;
    const total = (o.unit_price ?? 0) * (o.units_ordered ?? 0);
    const paid = o.paid_amount ?? 0;
    const ctx = getOrderContext(o);
    const reminder = buildReminder(orderTemplate, ctx, o.customer_whatsapp);
    items.push({
      type: "order",
      id: o.id,
      customer_name: o.customer_name,
      customer_whatsapp: o.customer_whatsapp ?? "",
      label: o.project_name,
      total,
      paid,
      saldo,
      created: o.created,
      days_old: daysSince(o.created),
      href: `/admin/pedidos/${o.id}`,
      reminder_body: reminder.body,
      reminder_href: reminder.href,
    });
  }

  for (const s of sales) {
    const total = supplySaleTotal(s);
    const paid = s.is_paid ? total : 0;
    const saldo = Math.max(0, total - paid);
    if (saldo <= 0) continue;
    const materialName = materialById.get(s.item) ?? "Insumo";
    const ctx = getSaleContext(s, { item_name: materialName });
    const reminder = buildReminder(saleTemplate, ctx, s.customer_whatsapp);
    items.push({
      type: "sale",
      id: s.id,
      customer_name: s.customer_name,
      customer_whatsapp: s.customer_whatsapp ?? "",
      label: materialName,
      total,
      paid,
      saldo,
      created: s.created,
      days_old: daysSince(s.created),
      href: `/admin/insumos/${s.id}`,
      reminder_body: reminder.body,
      reminder_href: reminder.href,
    });
  }

  // Más viejos primero (urgentes). Empate → mayor saldo.
  items.sort((a, b) => {
    if (b.days_old !== a.days_old) return b.days_old - a.days_old;
    return b.saldo - a.saldo;
  });

  return items;
}

/** Totales agregados para mostrar en el header de la pantalla. */
export type PendingTotals = {
  count: number;
  total_saldo: number;
  count_orders: number;
  count_sales: number;
  count_overdue_7d: number;
  count_no_whatsapp: number;
};

export function summarizePending(items: PendingPayment[]): PendingTotals {
  let total_saldo = 0;
  let count_orders = 0;
  let count_sales = 0;
  let count_overdue_7d = 0;
  let count_no_whatsapp = 0;
  for (const it of items) {
    total_saldo += it.saldo;
    if (it.type === "order") count_orders++;
    else count_sales++;
    if (it.days_old >= 7) count_overdue_7d++;
    if (!it.customer_whatsapp) count_no_whatsapp++;
  }
  return {
    count: items.length,
    total_saldo,
    count_orders,
    count_sales,
    count_overdue_7d,
    count_no_whatsapp,
  };
}
