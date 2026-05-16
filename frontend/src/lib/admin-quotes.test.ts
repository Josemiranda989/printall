import { describe, expect, it } from "vitest";
import { extractQuoteFromForm, quoteTotal } from "./admin-quotes";

describe("quoteTotal", () => {
  it("calcula unit_price * quantity", () => {
    expect(quoteTotal({ unit_price: 100, quantity: 3 })).toBe(300);
  });

  it("trata null/0 como 0", () => {
    expect(quoteTotal({ unit_price: 0, quantity: 5 })).toBe(0);
    expect(quoteTotal({ unit_price: 100, quantity: 0 })).toBe(0);
  });
});

describe("extractQuoteFromForm", () => {
  function form(fields: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return fd;
  }

  it("acepta datos válidos", () => {
    const r = extractQuoteFromForm(
      form({
        customer_name: "Juan",
        title: "Soporte",
        unit_price: "100",
        quantity: "3",
        status: "pending",
      }),
    );
    expect(r.errors).toEqual({});
    expect(r.data.unit_price).toBe(100);
    expect(r.data.quantity).toBe(3);
  });

  it("falla sin customer_name", () => {
    const r = extractQuoteFromForm(form({ title: "X", unit_price: "1", quantity: "1" }));
    expect(r.errors.customer_name).toBeDefined();
  });

  it("falla sin title", () => {
    const r = extractQuoteFromForm(
      form({ customer_name: "X", unit_price: "1", quantity: "1" }),
    );
    expect(r.errors.title).toBeDefined();
  });

  it("falla con quantity < 1", () => {
    const r = extractQuoteFromForm(
      form({ customer_name: "X", title: "Y", unit_price: "1", quantity: "0" }),
    );
    expect(r.errors.quantity).toBeDefined();
  });

  it("falla con unit_price negativo", () => {
    const r = extractQuoteFromForm(
      form({ customer_name: "X", title: "Y", unit_price: "-5", quantity: "1" }),
    );
    expect(r.errors.unit_price).toBeDefined();
  });

  it("status default es 'pending'", () => {
    const r = extractQuoteFromForm(
      form({ customer_name: "X", title: "Y", unit_price: "1", quantity: "1" }),
    );
    expect(r.data.status).toBe("pending");
  });

  it("status invalido es rechazado", () => {
    const r = extractQuoteFromForm(
      form({
        customer_name: "X",
        title: "Y",
        unit_price: "1",
        quantity: "1",
        status: "lol",
      }),
    );
    expect(r.errors.status).toBeDefined();
  });
});
