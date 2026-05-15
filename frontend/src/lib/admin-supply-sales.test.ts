import { describe, expect, it } from "vitest";
import { extractSupplySaleFromForm } from "./admin-supply-sales";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe("extractSupplySaleFromForm", () => {
  it("extrae todos los campos válidos", () => {
    const form = fd({
      customer_name: "Juan Pérez",
      customer_whatsapp: "3815551234",
      item: "mat_001",
      quantity: "3",
      unit_price: "1500",
      status: "entregado",
      is_paid: "on",
      color: "negro",
      sale_date: "2026-05-14",
      delivery_date: "2026-05-15",
      notes: "Entregado en mano",
    });

    const { data, errors } = extractSupplySaleFromForm(form);

    expect(errors).toEqual({});
    expect(data).toEqual({
      customer_name: "Juan Pérez",
      customer_whatsapp: "3815551234",
      item: "mat_001",
      quantity: 3,
      unit_price: 1500,
      status: "entregado",
      is_paid: true,
      color: "negro",
      sale_date: "2026-05-14",
      delivery_date: "2026-05-15",
      notes: "Entregado en mano",
    });
  });

  it("usa 'reservado' como status por defecto si no se provee", () => {
    const form = fd({
      customer_name: "Ana",
      item: "mat_001",
      quantity: "1",
      unit_price: "500",
      sale_date: "2026-05-14",
    });
    const { data, errors } = extractSupplySaleFromForm(form);
    expect(errors).toEqual({});
    expect(data.status).toBe("reservado");
  });

  it("rechaza customer_name vacío", () => {
    const form = fd({
      item: "mat_001",
      quantity: "1",
      unit_price: "500",
      sale_date: "2026-05-14",
    });
    const { errors } = extractSupplySaleFromForm(form);
    expect(errors.customer_name).toBeDefined();
  });

  it("rechaza item vacío", () => {
    const form = fd({
      customer_name: "Ana",
      quantity: "1",
      unit_price: "500",
      sale_date: "2026-05-14",
    });
    const { errors } = extractSupplySaleFromForm(form);
    expect(errors.item).toBeDefined();
  });

  it("rechaza sale_date vacía", () => {
    const form = fd({
      customer_name: "Ana",
      item: "mat_001",
      quantity: "1",
      unit_price: "500",
    });
    const { errors } = extractSupplySaleFromForm(form);
    expect(errors.sale_date).toBeDefined();
  });

  it("rechaza quantity menor a 1", () => {
    const form = fd({
      customer_name: "Ana",
      item: "mat_001",
      quantity: "0",
      unit_price: "500",
      sale_date: "2026-05-14",
    });
    const { errors } = extractSupplySaleFromForm(form);
    expect(errors.quantity).toBeDefined();
  });

  it("rechaza quantity no entera", () => {
    const form = fd({
      customer_name: "Ana",
      item: "mat_001",
      quantity: "2.5",
      unit_price: "500",
      sale_date: "2026-05-14",
    });
    const { errors } = extractSupplySaleFromForm(form);
    expect(errors.quantity).toBeDefined();
  });

  it("rechaza unit_price negativo", () => {
    const form = fd({
      customer_name: "Ana",
      item: "mat_001",
      quantity: "1",
      unit_price: "-100",
      sale_date: "2026-05-14",
    });
    const { errors } = extractSupplySaleFromForm(form);
    expect(errors.unit_price).toBeDefined();
  });

  it("rechaza status inválido", () => {
    const form = fd({
      customer_name: "Ana",
      item: "mat_001",
      quantity: "1",
      unit_price: "500",
      status: "pagado",
      sale_date: "2026-05-14",
    });
    const { errors } = extractSupplySaleFromForm(form);
    expect(errors.status).toBeDefined();
  });

  it("trata is_paid ausente como false (checkbox no marcado)", () => {
    const form = fd({
      customer_name: "Ana",
      item: "mat_001",
      quantity: "1",
      unit_price: "500",
      sale_date: "2026-05-14",
    });
    const { data } = extractSupplySaleFromForm(form);
    expect(data.is_paid).toBe(false);
  });
});
