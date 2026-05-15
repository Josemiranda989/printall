import { describe, expect, it } from "vitest";
import {
  extractPlaceholders,
  extractTemplateFromForm,
  fmtDate,
  fmtMoney,
  getOrderContext,
  getSaleContext,
  renderTemplate,
} from "./admin-templates";

// ─── renderTemplate ─────────────────────────────────────────────────
describe("renderTemplate", () => {
  it("reemplaza un placeholder simple", () => {
    expect(renderTemplate("Hola {{name}}", { name: "Juan" })).toBe("Hola Juan");
  });

  it("reemplaza multiples placeholders distintos", () => {
    expect(
      renderTemplate("{{a}} + {{b}} = {{c}}", { a: "1", b: "2", c: "3" }),
    ).toBe("1 + 2 = 3");
  });

  it("acepta espacios dentro de los braces", () => {
    expect(renderTemplate("Hola {{ name }}", { name: "Ana" })).toBe("Hola Ana");
  });

  it("deja el placeholder tal cual si la key no existe", () => {
    // Razon: el usuario que escribe el template debe ver el placeholder
    // sin reemplazar para darse cuenta que el dato falta. NO reemplazar
    // por string vacio.
    expect(renderTemplate("Hola {{nope}}", { other: "x" })).toBe("Hola {{nope}}");
  });

  it("deja el placeholder tal cual si el valor es vacio", () => {
    expect(renderTemplate("Hola {{name}}", { name: "" })).toBe("Hola {{name}}");
  });

  it("ignora placeholders mal formados", () => {
    expect(renderTemplate("Hola {{ 123 }}", { "123": "X" })).toBe("Hola {{ 123 }}");
    expect(renderTemplate("Hola {{}}", {})).toBe("Hola {{}}");
    expect(renderTemplate("Hola {name}", { name: "X" })).toBe("Hola {name}");
  });

  it("retorna vacio si el body es vacio", () => {
    expect(renderTemplate("", { name: "X" })).toBe("");
  });

  it("preserva texto literal sin placeholders", () => {
    expect(renderTemplate("Hola mundo!", {})).toBe("Hola mundo!");
  });
});

// ─── extractPlaceholders ────────────────────────────────────────────
describe("extractPlaceholders", () => {
  it("lista las keys unicas usadas en el body", () => {
    const result = extractPlaceholders(
      "Hola {{name}}, tu pedido {{project}} cuesta {{total}}. Te recuerdo {{name}}.",
    );
    expect(result.sort()).toEqual(["name", "project", "total"]);
  });

  it("retorna vacio si no hay placeholders", () => {
    expect(extractPlaceholders("Texto plano")).toEqual([]);
  });
});

// ─── fmtMoney ───────────────────────────────────────────────────────
describe("fmtMoney", () => {
  it("formatea con separador de miles es-AR", () => {
    // Nota: el separador es-AR varia (puede ser ".", " ", o " " segun runtime).
    // Verificamos formato general en vez de un literal exacto.
    expect(fmtMoney(1500)).toMatch(/\$1[.\s ]?500/);
    expect(fmtMoney(1000000)).toMatch(/\$1[.\s ]?000[.\s ]?000/);
  });

  it("redondea decimales", () => {
    expect(fmtMoney(1500.7)).toMatch(/\$1[.\s ]?501/);
  });

  it("retorna em-dash para null/undefined/NaN", () => {
    expect(fmtMoney(null)).toBe("—");
    expect(fmtMoney(undefined)).toBe("—");
    expect(fmtMoney(NaN)).toBe("—");
  });
});

// ─── fmtDate ────────────────────────────────────────────────────────
describe("fmtDate", () => {
  it("extrae solo YYYY-MM-DD del ISO", () => {
    expect(fmtDate("2026-05-15T22:00:00Z")).toBe("2026-05-15");
  });

  it("retorna em-dash para falsy", () => {
    expect(fmtDate(null)).toBe("—");
    expect(fmtDate(undefined)).toBe("—");
    expect(fmtDate("")).toBe("—");
  });
});

// ─── getOrderContext ────────────────────────────────────────────────
describe("getOrderContext", () => {
  it("calcula total = unit_price * units_ordered", () => {
    const ctx = getOrderContext({
      customer_name: "Juan",
      project_name: "Soporte",
      unit_price: 100,
      units_ordered: 3,
      paid_amount: 0,
    });
    expect(ctx.customer_name).toBe("Juan");
    expect(ctx.project_name).toBe("Soporte");
    expect(ctx.total).toMatch(/\$300/);
    expect(ctx.saldo).toMatch(/\$300/);
    expect(ctx.paid).toMatch(/\$0/);
  });

  it("saldo es total - paid, nunca negativo", () => {
    const ctx = getOrderContext({
      unit_price: 100,
      units_ordered: 1,
      paid_amount: 250, // sobre-pagado
    });
    expect(ctx.saldo).toMatch(/\$0/);
  });

  it("rellena con string vacio si faltan campos", () => {
    const ctx = getOrderContext({});
    expect(ctx.customer_name).toBe("");
    expect(ctx.project_name).toBe("");
  });
});

// ─── getSaleContext ─────────────────────────────────────────────────
describe("getSaleContext", () => {
  it("calcula total = unit_price * quantity", () => {
    const ctx = getSaleContext({
      customer_name: "Ana",
      unit_price: 50,
      quantity: 4,
      is_paid: false,
    });
    expect(ctx.total).toMatch(/\$200/);
    expect(ctx.saldo).toMatch(/\$200/);
    expect(ctx.paid).toMatch(/\$0/);
  });

  it("si is_paid → paid = total, saldo = 0", () => {
    const ctx = getSaleContext({
      unit_price: 100,
      quantity: 2,
      is_paid: true,
    });
    expect(ctx.paid).toMatch(/\$200/);
    expect(ctx.saldo).toMatch(/\$0/);
  });

  it("project_name y order_number siempre vacios en contexto sale", () => {
    const ctx = getSaleContext({ customer_name: "X" });
    expect(ctx.project_name).toBe("");
    expect(ctx.order_number).toBe("");
  });

  it("incluye item_name, quantity y color para mensajes de insumos", () => {
    const ctx = getSaleContext(
      { customer_name: "Ana", quantity: 3, color: "negro" },
      { item_name: "PLA negro 1kg" },
    );
    expect(ctx.item_name).toBe("PLA negro 1kg");
    expect(ctx.quantity).toBe("3");
    expect(ctx.color).toBe("negro");
  });

  it("item_name vacio si no se pasan opts", () => {
    const ctx = getSaleContext({ customer_name: "X" });
    expect(ctx.item_name).toBe("");
  });
});

// ─── nuevos placeholders en order ────────────────────────────────────
describe("getOrderContext — material/color/units_ordered", () => {
  it("incluye material, color y units_ordered", () => {
    const ctx = getOrderContext({
      customer_name: "Juan",
      material: "PLA",
      color: "negro",
      units_ordered: 5,
    });
    expect(ctx.material).toBe("PLA");
    expect(ctx.color).toBe("negro");
    expect(ctx.units_ordered).toBe("5");
  });

  it("rellena con string vacio si faltan", () => {
    const ctx = getOrderContext({});
    expect(ctx.material).toBe("");
    expect(ctx.color).toBe("");
    expect(ctx.units_ordered).toBe("");
  });
});

// ─── extractTemplateFromForm ────────────────────────────────────────
describe("extractTemplateFromForm", () => {
  function form(fields: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return fd;
  }

  it("acepta datos validos", () => {
    const result = extractTemplateFromForm(
      form({
        name: "Saludo",
        body: "Hola {{customer_name}}",
        applies_to: "any",
      }),
    );
    expect(result.errors).toEqual({});
    expect(result.data).toEqual({
      name: "Saludo",
      body: "Hola {{customer_name}}",
      applies_to: "any",
    });
  });

  it("falla si falta name", () => {
    const result = extractTemplateFromForm(
      form({ name: "", body: "Hola", applies_to: "any" }),
    );
    expect(result.errors.name).toBeDefined();
  });

  it("falla si falta body", () => {
    const result = extractTemplateFromForm(
      form({ name: "X", body: "", applies_to: "any" }),
    );
    expect(result.errors.body).toBeDefined();
  });

  it("falla si applies_to es invalido", () => {
    const result = extractTemplateFromForm(
      form({ name: "X", body: "Y", applies_to: "client" }),
    );
    expect(result.errors.applies_to).toBeDefined();
  });

  it("trimea name y body", () => {
    const result = extractTemplateFromForm(
      form({ name: "  Saludo  ", body: "  Hola  ", applies_to: "order" }),
    );
    expect(result.data.name).toBe("Saludo");
    expect(result.data.body).toBe("Hola");
  });
});
