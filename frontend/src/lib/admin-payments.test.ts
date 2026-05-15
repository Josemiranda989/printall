import { describe, expect, it } from "vitest";
import { sumPayments, validatePaymentInput } from "./admin-payments";

describe("sumPayments", () => {
  it("suma los amounts", () => {
    expect(
      sumPayments([{ amount: 100 }, { amount: 250 }, { amount: 50 }]),
    ).toBe(400);
  });

  it("ignora amounts inválidos", () => {
    expect(
      sumPayments([{ amount: 100 }, { amount: NaN as number }, { amount: 50 }]),
    ).toBe(150);
  });

  it("lista vacía → 0", () => {
    expect(sumPayments([])).toBe(0);
  });
});

describe("validatePaymentInput", () => {
  const valid = {
    target_type: "order",
    target_id: "abc123",
    amount: 1500,
    method: "transferencia",
    paid_at: "2026-05-15",
    notes: "Cobrado por mercado pago",
  };

  it("acepta input válido", () => {
    const result = validatePaymentInput(valid);
    expect(result.ok).toBe(true);
  });

  it("falla si target_type es inválido", () => {
    const result = validatePaymentInput({ ...valid, target_type: "invoice" });
    expect(result).toMatchObject({ ok: false });
  });

  it("falla si amount es 0 o negativo", () => {
    expect(validatePaymentInput({ ...valid, amount: 0 })).toMatchObject({ ok: false });
    expect(validatePaymentInput({ ...valid, amount: -100 })).toMatchObject({ ok: false });
  });

  it("falla si method es inválido", () => {
    expect(validatePaymentInput({ ...valid, method: "btc" })).toMatchObject({ ok: false });
  });

  it("falla si paid_at no es parseable", () => {
    expect(validatePaymentInput({ ...valid, paid_at: "no-es-fecha" })).toMatchObject({ ok: false });
  });

  it("falla si notes excede el máximo", () => {
    expect(
      validatePaymentInput({ ...valid, notes: "x".repeat(501) }),
    ).toMatchObject({ ok: false });
  });

  it("falla si body no es object", () => {
    expect(validatePaymentInput(null)).toMatchObject({ ok: false });
    expect(validatePaymentInput("foo")).toMatchObject({ ok: false });
  });
});
