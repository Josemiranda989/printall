import { describe, expect, it } from "vitest";
import {
  mapOrderToLedgerEntry,
  mapSupplySaleToLedgerEntry,
  mergeSalesLedger,
} from "./sales-ledger";
import type { Order, SupplySaleWithItem } from "./types";

function makeOrder(over: Partial<Order> = {}): Order {
  return {
    id: "ord_1",
    order_number: "2026-0001",
    project_name: "Llaveros personalizados",
    customer_name: "Juan Pérez",
    customer_whatsapp: "",
    material: "pla",
    color: "negro",
    priority: "medium",
    status: "completed",
    is_paid: true,
    unit_price: 500,
    units_ordered: 10,
    units_done: 10,
    paid_amount: 5000,
    order_date: "2026-05-10",
    delivery_date: "",
    notes: "",
    created: "",
    updated: "",
    ...over,
  };
}

function makeSupplySale(
  over: Partial<SupplySaleWithItem> = {},
): SupplySaleWithItem {
  return {
    id: "sup_1",
    customer_name: "Ana López",
    customer_whatsapp: "",
    item: "mat_1",
    quantity: 2,
    unit_price: 1500,
    status: "entregado",
    is_paid: false,
    sale_date: "2026-05-12",
    delivery_date: "",
    notes: "",
    created: "",
    updated: "",
    expand: {
      item: {
        id: "mat_1",
        name: "Rollo PLA negro",
        kind: "filament",
        cost_price: 18000,
        sell_price: 25000,
        active: true,
        created: "",
        updated: "",
      },
    },
    ...over,
  };
}

describe("mapOrderToLedgerEntry", () => {
  it("normaliza una orden a entrada del ledger", () => {
    const entry = mapOrderToLedgerEntry(makeOrder());
    expect(entry).toEqual({
      id: "ord_1",
      tipo: "impresion",
      concepto: "Llaveros personalizados",
      customer_name: "Juan Pérez",
      total: 5000,
      is_paid: true,
      fecha: "2026-05-10",
    });
  });
});

describe("mapSupplySaleToLedgerEntry", () => {
  it("normaliza una venta de insumo usando materials.name como concepto", () => {
    const entry = mapSupplySaleToLedgerEntry(makeSupplySale());
    expect(entry).toEqual({
      id: "sup_1",
      tipo: "insumo",
      concepto: "Rollo PLA negro",
      customer_name: "Ana López",
      total: 3000,
      is_paid: false,
      fecha: "2026-05-12",
    });
  });

  it("usa un placeholder si el insumo fue eliminado (sin expand)", () => {
    const sale = makeSupplySale();
    // @ts-expect-error — simulamos un expand ausente (insumo borrado)
    sale.expand = undefined;
    const entry = mapSupplySaleToLedgerEntry(sale);
    expect(entry.concepto).toBe("(insumo eliminado)");
  });
});

describe("mergeSalesLedger", () => {
  it("une impresiones e insumos ordenados por fecha descendente", () => {
    const orders = [
      makeOrder({ id: "o1", order_date: "2026-05-10" }),
      makeOrder({ id: "o2", order_date: "2026-05-14" }),
    ];
    const sales = [makeSupplySale({ id: "s1", sale_date: "2026-05-12" })];

    const merged = mergeSalesLedger(orders, sales);

    expect(merged.map((e) => e.id)).toEqual(["o2", "s1", "o1"]);
  });

  it("devuelve array vacío si no hay ventas", () => {
    expect(mergeSalesLedger([], [])).toEqual([]);
  });

  it("calcula totales correctos por tipo", () => {
    const merged = mergeSalesLedger(
      [makeOrder({ unit_price: 500, units_ordered: 4 })],
      [makeSupplySale({ unit_price: 1000, quantity: 3 })],
    );
    const impresion = merged.find((e) => e.tipo === "impresion");
    const insumo = merged.find((e) => e.tipo === "insumo");
    expect(impresion?.total).toBe(2000);
    expect(insumo?.total).toBe(3000);
  });
});
