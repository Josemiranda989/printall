import { describe, expect, it } from "vitest";
import { summarizePending, type PendingPayment } from "./admin-pending";

function mkItem(overrides: Partial<PendingPayment>): PendingPayment {
  return {
    type: "order",
    id: "x",
    customer_name: "X",
    customer_whatsapp: "5491111",
    label: "P",
    total: 100,
    paid: 0,
    saldo: 100,
    created: "2026-05-01T00:00:00Z",
    days_old: 0,
    href: "/admin/pedidos/x",
    reminder_body: null,
    reminder_href: null,
    ...overrides,
  };
}

describe("summarizePending", () => {
  it("cuenta orders y sales por separado", () => {
    const t = summarizePending([
      mkItem({ type: "order" }),
      mkItem({ type: "order" }),
      mkItem({ type: "sale" }),
    ]);
    expect(t.count).toBe(3);
    expect(t.count_orders).toBe(2);
    expect(t.count_sales).toBe(1);
  });

  it("suma saldos", () => {
    const t = summarizePending([
      mkItem({ saldo: 100 }),
      mkItem({ saldo: 250 }),
      mkItem({ saldo: 50 }),
    ]);
    expect(t.total_saldo).toBe(400);
  });

  it("cuenta atrasados (≥7 días)", () => {
    const t = summarizePending([
      mkItem({ days_old: 0 }),
      mkItem({ days_old: 6 }),
      mkItem({ days_old: 7 }),
      mkItem({ days_old: 20 }),
    ]);
    expect(t.count_overdue_7d).toBe(2);
  });

  it("cuenta items sin WhatsApp", () => {
    const t = summarizePending([
      mkItem({ customer_whatsapp: "5491111" }),
      mkItem({ customer_whatsapp: "" }),
      mkItem({ customer_whatsapp: "" }),
    ]);
    expect(t.count_no_whatsapp).toBe(2);
  });

  it("lista vacía → todo en cero", () => {
    const t = summarizePending([]);
    expect(t).toEqual({
      count: 0,
      total_saldo: 0,
      count_orders: 0,
      count_sales: 0,
      count_overdue_7d: 0,
      count_no_whatsapp: 0,
    });
  });
});
