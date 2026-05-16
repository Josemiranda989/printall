import type PocketBase from "pocketbase";

export const QUOTE_STATUS_VALUES = [
  "pending",
  "approved",
  "rejected",
  "converted",
  "expired",
] as const;
export type QuoteStatus = (typeof QUOTE_STATUS_VALUES)[number];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  converted: "Convertida",
  expired: "Vencida",
};

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  rejected: "bg-gray-100 text-gray-600",
  converted: "bg-emerald-100 text-emerald-800",
  expired: "bg-red-100 text-red-700",
};

export const QUOTE_TITLE_MAX = 200;
export const QUOTE_DESCRIPTION_MAX = 2000;
export const QUOTE_NOTES_MAX = 2000;

export type Quote = {
  id: string;
  customer_name: string;
  customer_whatsapp: string;
  title: string;
  description: string;
  unit_price: number;
  quantity: number;
  status: QuoteStatus;
  valid_until: string;
  converted_order_id: string;
  notes: string;
  created: string;
  updated: string;
};

export function quoteTotal(q: Pick<Quote, "unit_price" | "quantity">): number {
  return (Number(q.unit_price) || 0) * (Number(q.quantity) || 0);
}

// ─── Validación ──────────────────────────────────────────────────────

export type QuoteFormData = {
  customer_name: string;
  customer_whatsapp: string;
  title: string;
  description: string;
  unit_price: number;
  quantity: number;
  status: QuoteStatus;
  valid_until: string;
  notes: string;
};

const VALID_STATUS = new Set<string>(QUOTE_STATUS_VALUES);

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function extractQuoteFromForm(form: FormData): {
  data: QuoteFormData;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  const customer_name = str(form, "customer_name");
  const customer_whatsapp = str(form, "customer_whatsapp");
  const title = str(form, "title");
  const description = str(form, "description");
  const notes = str(form, "notes");
  const valid_until = str(form, "valid_until");
  const unitPriceRaw = str(form, "unit_price");
  const quantityRaw = str(form, "quantity");
  const statusRaw = str(form, "status") || "pending";

  if (!customer_name) errors.customer_name = "Nombre obligatorio.";
  if (customer_name.length > 120) errors.customer_name = "Maximo 120 caracteres.";

  if (!title) errors.title = "Titulo obligatorio.";
  if (title.length > QUOTE_TITLE_MAX) errors.title = `Maximo ${QUOTE_TITLE_MAX} caracteres.`;

  if (description.length > QUOTE_DESCRIPTION_MAX) {
    errors.description = `Maximo ${QUOTE_DESCRIPTION_MAX} caracteres.`;
  }

  let unit_price = 0;
  if (!unitPriceRaw) {
    errors.unit_price = "Precio obligatorio.";
  } else {
    const n = Number(unitPriceRaw);
    if (!Number.isFinite(n) || n < 0) errors.unit_price = "Debe ser >= 0.";
    else unit_price = n;
  }

  let quantity = 1;
  if (!quantityRaw) {
    errors.quantity = "Cantidad obligatoria.";
  } else {
    const n = Number(quantityRaw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1)
      errors.quantity = "Entero >= 1.";
    else quantity = n;
  }

  let status: QuoteStatus = "pending";
  if (statusRaw && !VALID_STATUS.has(statusRaw)) {
    errors.status = "Estado invalido.";
  } else {
    status = statusRaw as QuoteStatus;
  }

  if (notes.length > QUOTE_NOTES_MAX) {
    errors.notes = `Maximo ${QUOTE_NOTES_MAX} caracteres.`;
  }

  return {
    data: {
      customer_name,
      customer_whatsapp,
      title,
      description,
      unit_price,
      quantity,
      status,
      valid_until,
      notes,
    },
    errors,
  };
}

// ─── IO ──────────────────────────────────────────────────────────────

export async function fetchAllQuotes(pb: PocketBase): Promise<Quote[]> {
  const records = await pb.collection("quotes").getFullList({
    sort: "-created",
    batch: 200,
  });
  return records as unknown as Quote[];
}

export async function fetchQuoteById(
  pb: PocketBase,
  id: string,
): Promise<Quote | null> {
  try {
    const record = await pb.collection("quotes").getOne(id);
    return record as unknown as Quote;
  } catch {
    return null;
  }
}
