import { SUPPLY_SALE_STATUS_VALUES, type SupplySaleStatus } from "./types";

export const SUPPLY_SALE_NOTES_MAX = 2000;

const VALID_STATUS = new Set<string>(SUPPLY_SALE_STATUS_VALUES);

export type SupplySaleFormData = {
  customer_name: string;
  customer_whatsapp: string;
  item: string;
  quantity: number;
  unit_price: number;
  status: SupplySaleStatus;
  is_paid: boolean;
  sale_date: string;
  delivery_date: string;
  notes: string;
};

export type ExtractSupplySaleResult = {
  data: SupplySaleFormData;
  errors: Record<string, string>;
};

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function checkbox(form: FormData, key: string): boolean {
  const v = form.get(key);
  return v === "on" || v === "true" || v === "1";
}

export function extractSupplySaleFromForm(
  form: FormData,
): ExtractSupplySaleResult {
  const errors: Record<string, string> = {};

  const customer_name = str(form, "customer_name");
  const customer_whatsapp = str(form, "customer_whatsapp");
  const item = str(form, "item");
  const quantityRaw = str(form, "quantity");
  const unitPriceRaw = str(form, "unit_price");
  const statusRaw = str(form, "status");
  const is_paid = checkbox(form, "is_paid");
  const sale_date = str(form, "sale_date");
  const delivery_date = str(form, "delivery_date");
  const notes = str(form, "notes");

  if (!customer_name) {
    errors.customer_name = "El nombre del cliente es obligatorio.";
  }
  if (!item) errors.item = "Elegí un insumo.";
  if (!sale_date) errors.sale_date = "La fecha de venta es obligatoria.";

  if (notes.length > SUPPLY_SALE_NOTES_MAX) {
    errors.notes = `Máximo ${SUPPLY_SALE_NOTES_MAX} caracteres.`;
  }

  // quantity: entero >= 1
  let quantity = 1;
  if (!quantityRaw) {
    errors.quantity = "La cantidad es obligatoria.";
  } else {
    const parsed = Number(quantityRaw);
    if (!Number.isInteger(parsed)) {
      errors.quantity = "La cantidad debe ser un número entero.";
    } else if (parsed < 1) {
      errors.quantity = "La cantidad debe ser al menos 1.";
    } else {
      quantity = parsed;
    }
  }

  // unit_price: número >= 0
  let unit_price = 0;
  if (!unitPriceRaw) {
    errors.unit_price = "El precio unitario es obligatorio.";
  } else {
    const parsed = Number(unitPriceRaw);
    if (!Number.isFinite(parsed)) {
      errors.unit_price = "El precio unitario debe ser un número.";
    } else if (parsed < 0) {
      errors.unit_price = "El precio unitario no puede ser negativo.";
    } else {
      unit_price = parsed;
    }
  }

  // status: si no viene, default "reservado" — lo mismo que garantiza el hook
  // supply_sales.pb.js server-side. Si viene, debe ser un valor válido.
  let status: SupplySaleStatus = "reservado";
  if (statusRaw) {
    if (!VALID_STATUS.has(statusRaw)) {
      errors.status = "Estado inválido.";
    } else {
      status = statusRaw as SupplySaleStatus;
    }
  }

  return {
    data: {
      customer_name,
      customer_whatsapp,
      item,
      quantity,
      unit_price,
      status,
      is_paid,
      sale_date,
      delivery_date,
      notes,
    },
    errors,
  };
}

/**
 * Valida el body de PATCH /admin/api/supply_sales/[id]/status.
 */
export function validateSupplySaleStatusPatch(
  body: unknown,
): { ok: true; status: SupplySaleStatus } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body inválido." };
  }
  const raw = (body as { status?: unknown }).status;
  if (typeof raw !== "string" || !VALID_STATUS.has(raw)) {
    return { ok: false, error: "Estado inválido." };
  }
  return { ok: true, status: raw as SupplySaleStatus };
}

/**
 * Valida el body de PATCH /admin/api/supply_sales/[id]/paid.
 *
 * A diferencia de orders, supply_sales solo guarda is_paid (no hay paid_amount
 * en la tabla), porque la operación típica es toggle: pagó / no pagó.
 */
export function validateSupplySalePaidPatch(
  body: unknown,
): { ok: true; is_paid: boolean } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body inválido." };
  }
  const obj = body as { is_paid?: unknown };
  if (typeof obj.is_paid !== "boolean") {
    return { ok: false, error: "Falta is_paid." };
  }
  return { ok: true, is_paid: obj.is_paid };
}
