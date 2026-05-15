import type PocketBase from "pocketbase";

export const APPLIES_TO_VALUES = ["order", "sale", "any"] as const;
export type AppliesTo = (typeof APPLIES_TO_VALUES)[number];

export const APPLIES_TO_LABELS: Record<AppliesTo, string> = {
  order: "Pedidos",
  sale: "Ventas de insumo",
  any: "Ambos",
};

export const TEMPLATE_NAME_MAX = 100;
export const TEMPLATE_BODY_MAX = 2000;

export type WhatsAppTemplate = {
  id: string;
  name: string;
  body: string;
  applies_to: AppliesTo;
  created: string;
  updated: string;
};

// ─── renderTemplate (puro) ──────────────────────────────────────────

export type TemplateContext = Record<string, string | undefined>;

/**
 * Reemplaza placeholders {{key}} con los valores del contexto.
 *
 * - Si una key no existe en el contexto → deja el placeholder tal cual,
 *   asi el usuario que escribe el template nota que el dato falta.
 * - Soporta espacios alrededor: {{ key }} es equivalente a {{key}}.
 * - Solo acepta keys con [a-zA-Z_][a-zA-Z0-9_]* (no whitespace, no symbols)
 *   — evita ambiguedades con CSS-in-JS o expresiones tipo Handlebars.
 */
export function renderTemplate(body: string, ctx: TemplateContext): string {
  if (!body) return "";
  return body.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (match, key) => {
    const value = ctx[key];
    return value !== undefined && value !== null && value !== ""
      ? String(value)
      : match;
  });
}

/** Lista de placeholders detectados en un template body. Util para preview. */
export function extractPlaceholders(body: string): string[] {
  const found = new Set<string>();
  const re = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    found.add(m[1]);
  }
  return Array.from(found);
}

// ─── Formatos ───────────────────────────────────────────────────────

export function fmtMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return "$" + Math.round(n).toLocaleString("es-AR");
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

// ─── Contextos por tipo ─────────────────────────────────────────────

export type OrderLike = {
  customer_name?: string;
  project_name?: string;
  order_number?: string;
  unit_price?: number;
  units_ordered?: number;
  paid_amount?: number;
  delivery_date?: string;
  material?: string;
  color?: string;
};

export function getOrderContext(order: OrderLike): TemplateContext {
  const total =
    (Number(order.unit_price) || 0) * (Number(order.units_ordered) || 0);
  const paid = Number(order.paid_amount) || 0;
  const saldo = Math.max(0, total - paid);
  return {
    customer_name: order.customer_name ?? "",
    project_name: order.project_name ?? "",
    order_number: order.order_number ?? "",
    total: fmtMoney(total),
    paid: fmtMoney(paid),
    saldo: fmtMoney(saldo),
    delivery_date: fmtDate(order.delivery_date),
    material: order.material ?? "",
    color: order.color ?? "",
    units_ordered:
      order.units_ordered != null ? String(order.units_ordered) : "",
  };
}

export type SaleLike = {
  customer_name?: string;
  unit_price?: number;
  quantity?: number;
  is_paid?: boolean;
  delivery_date?: string;
  color?: string;
};

export type SaleContextOptions = {
  /** Nombre legible del insumo (resuelto desde la relation `item` → materials.name). */
  item_name?: string;
};

export function getSaleContext(
  sale: SaleLike,
  opts: SaleContextOptions = {},
): TemplateContext {
  const total =
    (Number(sale.unit_price) || 0) * (Number(sale.quantity) || 0);
  const paid = sale.is_paid ? total : 0;
  const saldo = Math.max(0, total - paid);
  return {
    customer_name: sale.customer_name ?? "",
    project_name: "",
    order_number: "",
    total: fmtMoney(total),
    paid: fmtMoney(paid),
    saldo: fmtMoney(saldo),
    delivery_date: fmtDate(sale.delivery_date),
    item_name: opts.item_name ?? "",
    quantity: sale.quantity != null ? String(sale.quantity) : "",
    color: sale.color ?? "",
  };
}

// ─── Validacion de form ─────────────────────────────────────────────

export type TemplateFormData = {
  name: string;
  body: string;
  applies_to: AppliesTo;
};

const VALID_APPLIES_TO = new Set<string>(APPLIES_TO_VALUES);

export function extractTemplateFromForm(form: FormData): {
  data: TemplateFormData;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  const name = String(form.get("name") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const appliesToRaw = String(form.get("applies_to") ?? "").trim();

  if (!name) {
    errors.name = "El nombre es obligatorio.";
  } else if (name.length > TEMPLATE_NAME_MAX) {
    errors.name = `Maximo ${TEMPLATE_NAME_MAX} caracteres.`;
  }

  if (!body) {
    errors.body = "El cuerpo del mensaje es obligatorio.";
  } else if (body.length > TEMPLATE_BODY_MAX) {
    errors.body = `Maximo ${TEMPLATE_BODY_MAX} caracteres.`;
  }

  let applies_to: AppliesTo = "any";
  if (!appliesToRaw) {
    errors.applies_to = "Elegi a que aplica.";
  } else if (!VALID_APPLIES_TO.has(appliesToRaw)) {
    errors.applies_to = "Valor invalido.";
  } else {
    applies_to = appliesToRaw as AppliesTo;
  }

  return { data: { name, body, applies_to }, errors };
}

// ─── IO ─────────────────────────────────────────────────────────────

export async function fetchAllTemplates(
  pb: PocketBase,
): Promise<WhatsAppTemplate[]> {
  const records = await pb.collection("whatsapp_templates").getFullList({
    sort: "name",
  });
  return records as unknown as WhatsAppTemplate[];
}

/**
 * Templates que aplican a un contexto especifico (incluye los 'any').
 */
export async function fetchTemplatesFor(
  pb: PocketBase,
  context: "order" | "sale",
): Promise<WhatsAppTemplate[]> {
  const records = await pb.collection("whatsapp_templates").getFullList({
    filter: `applies_to = "${context}" || applies_to = "any"`,
    sort: "name",
  });
  return records as unknown as WhatsAppTemplate[];
}

export async function fetchTemplateById(
  pb: PocketBase,
  id: string,
): Promise<WhatsAppTemplate | null> {
  try {
    const record = await pb.collection("whatsapp_templates").getOne(id);
    return record as unknown as WhatsAppTemplate;
  } catch {
    return null;
  }
}
