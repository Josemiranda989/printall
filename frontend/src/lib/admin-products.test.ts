import { describe, expect, it } from "vitest";
import { extractProductFromForm } from "./admin-products";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe("extractProductFromForm", () => {
  it("extrae todos los campos válidos", () => {
    const form = fd({
      name: "Mate con Pico",
      slug: "mate-con-pico",
      category: "cat_001",
      description: "Mate impreso en 3D",
      price: "12500",
      price_label: "$12.500",
      stock_status: "in_stock",
      featured: "on",
      published: "on",
    });

    const { data, errors } = extractProductFromForm(form);

    expect(errors).toEqual({});
    expect(data).toEqual({
      name: "Mate con Pico",
      slug: "mate-con-pico",
      category: "cat_001",
      description: "Mate impreso en 3D",
      price: 12500,
      price_label: "$12.500",
      stock_status: "in_stock",
      featured: true,
      published: true,
    });
  });

  it("genera slug automáticamente si no se provee", () => {
    const form = fd({
      name: "Vaso Térmico",
      category: "cat_001",
      stock_status: "in_stock",
    });

    const { data, errors } = extractProductFromForm(form);
    expect(errors).toEqual({});
    expect(data.slug).toBe("vaso-termico");
  });

  it("usa el slug provisto aunque haya nombre", () => {
    const form = fd({
      name: "Vaso Térmico",
      slug: "mi-slug-custom",
      category: "cat_001",
      stock_status: "in_stock",
    });

    const { data } = extractProductFromForm(form);
    expect(data.slug).toBe("mi-slug-custom");
  });

  it("trata featured y published ausentes como false (checkbox no marcado)", () => {
    const form = fd({
      name: "Producto",
      category: "cat_001",
      stock_status: "in_stock",
    });

    const { data } = extractProductFromForm(form);
    expect(data.featured).toBe(false);
    expect(data.published).toBe(false);
  });

  it("falla si name está vacío", () => {
    const form = fd({
      name: "",
      category: "cat_001",
      stock_status: "in_stock",
    });

    const { errors } = extractProductFromForm(form);
    expect(errors.name).toBeDefined();
  });

  it("falla si category está vacío", () => {
    const form = fd({
      name: "Producto",
      category: "",
      stock_status: "in_stock",
    });

    const { errors } = extractProductFromForm(form);
    expect(errors.category).toBeDefined();
  });

  it("falla si stock_status no es un valor válido del enum", () => {
    const form = fd({
      name: "Producto",
      category: "cat_001",
      stock_status: "wat",
    });

    const { errors } = extractProductFromForm(form);
    expect(errors.stock_status).toBeDefined();
  });

  it("price vacío se convierte a 0", () => {
    const form = fd({
      name: "Producto",
      category: "cat_001",
      stock_status: "in_stock",
      price: "",
    });

    const { data, errors } = extractProductFromForm(form);
    expect(errors).toEqual({});
    expect(data.price).toBe(0);
  });

  it("price negativo es inválido", () => {
    const form = fd({
      name: "Producto",
      category: "cat_001",
      stock_status: "in_stock",
      price: "-100",
    });

    const { errors } = extractProductFromForm(form);
    expect(errors.price).toBeDefined();
  });

  it("price no numérico es inválido", () => {
    const form = fd({
      name: "Producto",
      category: "cat_001",
      stock_status: "in_stock",
      price: "abc",
    });

    const { errors } = extractProductFromForm(form);
    expect(errors.price).toBeDefined();
  });

  it("trim del name y description", () => {
    const form = fd({
      name: "  Producto  ",
      description: "  desc  ",
      category: "cat_001",
      stock_status: "in_stock",
    });

    const { data } = extractProductFromForm(form);
    expect(data.name).toBe("Producto");
    expect(data.description).toBe("desc");
  });
});
