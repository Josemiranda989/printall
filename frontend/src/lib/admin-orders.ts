import {
  COLOR_VALUES,
  MATERIAL_VALUES,
  ORDER_STATUS_VALUES,
  PRIORITY_VALUES,
  type Color,
  type Material,
  type OrderStatus,
  type Priority,
} from "./types";

// Constantes de validación — replicadas en la migration de orders y en los API endpoints.
export const PROJECT_NAME_MAX = 200;
export const CUSTOMER_NAME_MAX = 120;
export const CUSTOMER_WHATSAPP_MAX = 30;
export const NOTES_MAX = 2000;
export const ORDER_NUMBER_MAX = 20;

const VALID_STATUS = new Set<string>(ORDER_STATUS_VALUES);
const VALID_PRIORITY = new Set<string>(PRIORITY_VALUES);
const VALID_MATERIAL = new Set<string>(MATERIAL_VALUES);
const VALID_COLOR = new Set<string>(COLOR_VALUES);

export type OrderFormData = {
  project_name: string;
  customer_name: string;
  customer_whatsapp: string;
  material: Material;
  color: Color;
  priority: Priority;
  status: OrderStatus;
  /** is_paid es DERIVADO server-side: true cuando paid_amount >= total. */
  is_paid: boolean;
  unit_price: number;
  units_ordered: number;
  units_done: number;
  paid_amount: number;
  order_date: string;
  delivery_date: string;
  notes: string;
};

export type ExtractOrderResult = {
  data: OrderFormData;
  errors: Record<string, string>;
};

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Convierte un input datetime-local ("YYYY-MM-DDTHH:mm") o un input date
 * ("YYYY-MM-DD") a string ISO 8601 que PocketBase acepta.
 * Retorna "" si el input está vacío. Retorna null si no es parseable.
 */
function parseDateInput(raw: string): string | null {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function extractOrderFromForm(form: FormData): ExtractOrderResult {
  const errors: Record<string, string> = {};

  const project_name = str(form, "project_name");
  const customer_name = str(form, "customer_name");
  const customer_whatsapp = str(form, "customer_whatsapp");
  const materialRaw = str(form, "material");
  const colorRaw = str(form, "color");
  const priorityRaw = str(form, "priority");
  const statusRaw = str(form, "status");
  const unitPriceRaw = str(form, "unit_price");
  const unitsOrderedRaw = str(form, "units_ordered");
  const unitsDoneRaw = str(form, "units_done");
  const paidAmountRaw = str(form, "paid_amount");
  const orderDateRaw = str(form, "order_date");
  const deliveryDateRaw = str(form, "delivery_date");
  const notes = str(form, "notes");

  // Required text fields
  if (!project_name) {
    errors.project_name = "El nombre del proyecto es obligatorio.";
  } else if (project_name.length > PROJECT_NAME_MAX) {
    errors.project_name = `Máximo ${PROJECT_NAME_MAX} caracteres.`;
  }

  if (!customer_name) {
    errors.customer_name = "El nombre del cliente es obligatorio.";
  } else if (customer_name.length > CUSTOMER_NAME_MAX) {
    errors.customer_name = `Máximo ${CUSTOMER_NAME_MAX} caracteres.`;
  }

  if (customer_whatsapp.length > CUSTOMER_WHATSAPP_MAX) {
    errors.customer_whatsapp = `Máximo ${CUSTOMER_WHATSAPP_MAX} caracteres.`;
  }

  if (notes.length > NOTES_MAX) {
    errors.notes = `Máximo ${NOTES_MAX} caracteres.`;
  }

  // Enums
  let material: Material = "pla";
  if (!materialRaw) {
    errors.material = "Elegí un material.";
  } else if (!VALID_MATERIAL.has(materialRaw)) {
    errors.material = "Material inválido.";
  } else {
    material = materialRaw as Material;
  }

  let color: Color = "negro";
  if (!colorRaw) {
    errors.color = "Elegí un color.";
  } else if (!VALID_COLOR.has(colorRaw)) {
    errors.color = "Color inválido.";
  } else {
    color = colorRaw as Color;
  }

  let priority: Priority = "medium";
  if (priorityRaw && !VALID_PRIORITY.has(priorityRaw)) {
    errors.priority = "Prioridad inválida.";
  } else if (priorityRaw) {
    priority = priorityRaw as Priority;
  }

  let status: OrderStatus = "pending";
  if (statusRaw && !VALID_STATUS.has(statusRaw)) {
    errors.status = "Estado inválido.";
  } else if (statusRaw) {
    status = statusRaw as OrderStatus;
  }

  // Numbers
  let unit_price = 0;
  if (!unitPriceRaw) {
    errors.unit_price = "El precio unitario es obligatorio.";
  } else {
    const parsed = Number(unitPriceRaw);
    if (!Number.isFinite(parsed)) {
      errors.unit_price = "El precio debe ser un número.";
    } else if (parsed < 0) {
      errors.unit_price = "El precio no puede ser negativo.";
    } else {
      unit_price = parsed;
    }
  }

  let units_ordered = 1;
  if (!unitsOrderedRaw) {
    errors.units_ordered = "La cantidad pedida es obligatoria.";
  } else {
    const parsed = Number(unitsOrderedRaw);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      errors.units_ordered = "Debe ser un número entero.";
    } else if (parsed < 1) {
      errors.units_ordered = "Mínimo 1 unidad.";
    } else {
      units_ordered = parsed;
    }
  }

  let units_done = 0;
  if (unitsDoneRaw) {
    const parsed = Number(unitsDoneRaw);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      errors.units_done = "Debe ser un número entero.";
    } else if (parsed < 0) {
      errors.units_done = "No puede ser negativo.";
    } else {
      units_done = parsed;
    }
  }

  if (
    !errors.units_done &&
    !errors.units_ordered &&
    units_done > units_ordered
  ) {
    errors.units_done = "No puede superar las unidades pedidas.";
  }

  // Pagado: monto que el cliente pagó hasta ahora (seña parcial o total).
  // Validación cruzada: no puede superar el total del pedido.
  let paid_amount = 0;
  if (paidAmountRaw) {
    const parsed = Number(paidAmountRaw);
    if (!Number.isFinite(parsed)) {
      errors.paid_amount = "El monto pagado debe ser un número.";
    } else if (parsed < 0) {
      errors.paid_amount = "El monto pagado no puede ser negativo.";
    } else {
      paid_amount = parsed;
    }
  }

  // Total comprometido = unit_price × units_ordered.
  // Si paid_amount lo supera, error. Margen de redondeo de 0.01 por floats.
  if (!errors.paid_amount && !errors.unit_price && !errors.units_ordered) {
    const total = unit_price * units_ordered;
    if (paid_amount > total + 0.01) {
      errors.paid_amount = `No puede superar el total del pedido ($${Math.round(total).toLocaleString("es-AR")}).`;
    }
  }

  // is_paid es DERIVADO: true cuando paid_amount cubre el total.
  const total = unit_price * units_ordered;
  const is_paid = paid_amount >= total && total > 0;

  // Dates
  const order_date_parsed = parseDateInput(orderDateRaw);
  if (order_date_parsed === null) {
    errors.order_date = "Fecha de pedido inválida.";
  }
  // Si llega vacío, el hook de PB le pone now() — válido para el form.
  const order_date = order_date_parsed ?? "";

  const delivery_date_parsed = parseDateInput(deliveryDateRaw);
  if (delivery_date_parsed === null) {
    errors.delivery_date = "Fecha de entrega inválida.";
  }
  const delivery_date = delivery_date_parsed ?? "";

  return {
    data: {
      project_name,
      customer_name,
      customer_whatsapp,
      material,
      color,
      priority,
      status,
      is_paid,
      unit_price,
      units_ordered,
      units_done,
      paid_amount,
      order_date,
      delivery_date,
      notes,
    },
    errors,
  };
}

/**
 * Valida el body de PATCH /admin/api/orders/[id]/status.
 */
export function validateStatusPatch(
  body: unknown,
): { ok: true; status: OrderStatus } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body inválido." };
  }
  const raw = (body as { status?: unknown }).status;
  if (typeof raw !== "string" || !VALID_STATUS.has(raw)) {
    return { ok: false, error: "Estado inválido." };
  }
  return { ok: true, status: raw as OrderStatus };
}

/**
 * Valida el body de PATCH /admin/api/orders/[id]/priority.
 */
export function validatePriorityPatch(
  body: unknown,
): { ok: true; priority: Priority } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body inválido." };
  }
  const raw = (body as { priority?: unknown }).priority;
  if (typeof raw !== "string" || !VALID_PRIORITY.has(raw)) {
    return { ok: false, error: "Prioridad inválida." };
  }
  return { ok: true, priority: raw as Priority };
}

/**
 * Valida el body de PATCH /admin/api/orders/[id]/paid.
 *
 * Acepta dos formatos:
 *  - `{ is_paid: true|false }` — toggle clásico de la tabla; el endpoint setea
 *    paid_amount = total cuando true, o 0 cuando false.
 *  - `{ paid_amount: number }` — monto custom (p.ej. una seña parcial); el
 *    endpoint clamps al rango [0, total] y deriva is_paid = (paid_amount >= total).
 *
 * Si llegan ambos, gana paid_amount.
 */
export function validatePaidPatch(
  body: unknown,
):
  | { ok: true; is_paid?: boolean; paid_amount?: number }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body inválido." };
  }
  const obj = body as { is_paid?: unknown; paid_amount?: unknown };

  if (obj.paid_amount !== undefined) {
    if (typeof obj.paid_amount !== "number" || !Number.isFinite(obj.paid_amount) || obj.paid_amount < 0) {
      return { ok: false, error: "paid_amount debe ser un número >= 0." };
    }
    return { ok: true, paid_amount: obj.paid_amount };
  }

  if (typeof obj.is_paid === "boolean") {
    return { ok: true, is_paid: obj.is_paid };
  }

  return { ok: false, error: "Falta is_paid o paid_amount." };
}

/**
 * Valida el body de PATCH /admin/api/orders/[id]/progress.
 * Acepta tanto un número absoluto (`units_done`) como un delta (`+1`/`-1`).
 */
export function validateProgressPatch(
  body: unknown,
):
  | { ok: true; units_done?: number; delta?: number }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body inválido." };
  }
  const obj = body as { units_done?: unknown; delta?: unknown };

  if (obj.delta !== undefined) {
    if (typeof obj.delta !== "number" || !Number.isInteger(obj.delta)) {
      return { ok: false, error: "delta debe ser un entero." };
    }
    return { ok: true, delta: obj.delta };
  }

  if (obj.units_done !== undefined) {
    if (
      typeof obj.units_done !== "number" ||
      !Number.isInteger(obj.units_done) ||
      obj.units_done < 0
    ) {
      return { ok: false, error: "units_done debe ser un entero >= 0." };
    }
    return { ok: true, units_done: obj.units_done };
  }

  return { ok: false, error: "Falta units_done o delta." };
}
