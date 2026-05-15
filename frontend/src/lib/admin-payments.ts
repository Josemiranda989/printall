import type PocketBase from "pocketbase";

export const PAYMENT_METHOD_VALUES = [
  "efectivo",
  "transferencia",
  "mercado_pago",
  "otro",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHOD_VALUES)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  mercado_pago: "Mercado Pago",
  otro: "Otro",
};

export const PAYMENT_NOTES_MAX = 500;

export type Payment = {
  id: string;
  target_type: "order" | "sale";
  target_id: string;
  amount: number;
  method: PaymentMethod;
  paid_at: string;
  notes: string;
  created: string;
  updated: string;
};

// ─── Validacion ──────────────────────────────────────────────────────

export type PaymentInput = {
  target_type: "order" | "sale";
  target_id: string;
  amount: number;
  method: PaymentMethod;
  paid_at: string;
  notes: string;
};

const VALID_METHODS = new Set<string>(PAYMENT_METHOD_VALUES);

export function validatePaymentInput(
  body: unknown,
): { ok: true; data: PaymentInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body invalido." };
  }
  const b = body as Record<string, unknown>;

  const target_type = String(b.target_type ?? "");
  if (target_type !== "order" && target_type !== "sale") {
    return { ok: false, error: "target_type debe ser 'order' o 'sale'." };
  }

  const target_id = String(b.target_id ?? "").trim();
  if (!target_id) {
    return { ok: false, error: "target_id es obligatorio." };
  }

  const amountRaw = b.amount;
  if (typeof amountRaw !== "number" || !Number.isFinite(amountRaw) || amountRaw <= 0) {
    return { ok: false, error: "El monto debe ser un numero mayor a 0." };
  }

  const method = String(b.method ?? "");
  if (!VALID_METHODS.has(method)) {
    return { ok: false, error: "Metodo invalido." };
  }

  const paid_at = String(b.paid_at ?? "").trim();
  if (!paid_at) {
    return { ok: false, error: "paid_at es obligatorio." };
  }
  const d = new Date(paid_at);
  if (isNaN(d.getTime())) {
    return { ok: false, error: "Fecha invalida." };
  }

  const notes = String(b.notes ?? "").trim();
  if (notes.length > PAYMENT_NOTES_MAX) {
    return { ok: false, error: `Notas: maximo ${PAYMENT_NOTES_MAX} caracteres.` };
  }

  return {
    ok: true,
    data: {
      target_type: target_type as "order" | "sale",
      target_id,
      amount: amountRaw,
      method: method as PaymentMethod,
      paid_at,
      notes,
    },
  };
}

// ─── Calculo agregado (puro) ─────────────────────────────────────────

export function sumPayments(payments: Pick<Payment, "amount">[]): number {
  return payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
}

// ─── IO ──────────────────────────────────────────────────────────────

export async function fetchPaymentsForTarget(
  pb: PocketBase,
  targetType: "order" | "sale",
  targetId: string,
): Promise<Payment[]> {
  const safeId = targetId.replace(/[^a-zA-Z0-9]/g, "");
  if (!safeId) return [];
  const records = await pb.collection("payments").getFullList({
    filter: `target_type = "${targetType}" && target_id = "${safeId}"`,
    sort: "-paid_at,-created",
  });
  return records as unknown as Payment[];
}
