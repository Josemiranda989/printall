import { describe, expect, it } from "vitest";
import { extractCategoryFromForm } from "./admin-categories";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe("extractCategoryFromForm", () => {
  it("extrae name y slug válidos sin errores", () => {
    const form = fd({ name: "Filamentos", slug: "filamentos" });
    const { data, errors } = extractCategoryFromForm(form);
    expect(errors).toEqual({});
    expect(data.name).toBe("Filamentos");
    expect(data.slug).toBe("filamentos");
  });

  it("slug vacío con name presente autogenera slug con slugify", () => {
    const form = fd({ name: "Mates y Bombillas" });
    const { data, errors } = extractCategoryFromForm(form);
    expect(errors).toEqual({});
    expect(data.slug).toBe("mates-y-bombillas");
  });

  it("trims whitespace en todos los strings", () => {
    const form = fd({
      name: "  Filamentos  ",
      slug: "  filamentos  ",
      icon: "  🧵  ",
      description: "  Desc  ",
    });
    const { data } = extractCategoryFromForm(form);
    expect(data.name).toBe("Filamentos");
    expect(data.slug).toBe("filamentos");
    expect(data.icon).toBe("🧵");
    expect(data.description).toBe("Desc");
  });

  it("falla si name está vacío", () => {
    const form = fd({ name: "", slug: "filamentos" });
    const { errors } = extractCategoryFromForm(form);
    expect(errors.name).toBeDefined();
  });

  it("falla si name supera 80 caracteres", () => {
    const form = fd({ name: "a".repeat(81), slug: "slug" });
    const { errors } = extractCategoryFromForm(form);
    expect(errors.name).toBeDefined();
  });

  it("name de exactamente 80 caracteres es válido", () => {
    const form = fd({ name: "a".repeat(80), slug: "slug" });
    const { errors } = extractCategoryFromForm(form);
    expect(errors.name).toBeUndefined();
  });

  it("falla si slug supera 80 caracteres", () => {
    const form = fd({ name: "Nombre", slug: "a".repeat(81) });
    const { errors } = extractCategoryFromForm(form);
    expect(errors.slug).toBeDefined();
  });

  it("slug de exactamente 80 caracteres es válido (si matchea pattern)", () => {
    // 80 chars de a-z0-9
    const form = fd({ name: "Nombre", slug: "a".repeat(80) });
    const { errors } = extractCategoryFromForm(form);
    expect(errors.slug).toBeUndefined();
  });

  it("falla si slug tiene mayúsculas", () => {
    const form = fd({ name: "Nombre", slug: "Mi-Slug" });
    const { errors } = extractCategoryFromForm(form);
    expect(errors.slug).toBeDefined();
  });

  it("falla si slug tiene espacios", () => {
    const form = fd({ name: "Nombre", slug: "mi slug" });
    const { errors } = extractCategoryFromForm(form);
    expect(errors.slug).toBeDefined();
  });

  it("falla si slug tiene símbolos no permitidos", () => {
    const form = fd({ name: "Nombre", slug: "mi_slug!" });
    const { errors } = extractCategoryFromForm(form);
    expect(errors.slug).toBeDefined();
  });

  it("falla si icon supera 8 caracteres", () => {
    const form = fd({ name: "Nombre", slug: "nombre", icon: "123456789" });
    const { errors } = extractCategoryFromForm(form);
    expect(errors.icon).toBeDefined();
  });

  it("icon de exactamente 8 caracteres es válido", () => {
    const form = fd({ name: "Nombre", slug: "nombre", icon: "12345678" });
    const { errors } = extractCategoryFromForm(form);
    expect(errors.icon).toBeUndefined();
  });

  it("icon vacío es válido (campo opcional)", () => {
    const form = fd({ name: "Nombre", slug: "nombre" });
    const { errors, data } = extractCategoryFromForm(form);
    expect(errors.icon).toBeUndefined();
    expect(data.icon).toBe("");
  });

  it("falla si description supera 240 caracteres", () => {
    const form = fd({
      name: "Nombre",
      slug: "nombre",
      description: "a".repeat(241),
    });
    const { errors } = extractCategoryFromForm(form);
    expect(errors.description).toBeDefined();
  });

  it("description de exactamente 240 caracteres es válida", () => {
    const form = fd({
      name: "Nombre",
      slug: "nombre",
      description: "a".repeat(240),
    });
    const { errors } = extractCategoryFromForm(form);
    expect(errors.description).toBeUndefined();
  });

  it("order no numérico defaults a 0 sin error (campo opcional, robusto)", () => {
    // Decisión: order no numérico → default 0, no error.
    // Razón: es un campo de ordenamiento secundario, no crítico para el negocio.
    // Un usuario que deje el campo vacío o ingrese texto accidentalmente no debería
    // ver un error de validación en un campo que rara vez se usa.
    const form = fd({ name: "Nombre", slug: "nombre", order: "abc" });
    const { data, errors } = extractCategoryFromForm(form);
    expect(errors.order).toBeUndefined();
    expect(data.order).toBe(0);
  });

  it("order numérico se parsea correctamente", () => {
    const form = fd({ name: "Nombre", slug: "nombre", order: "10" });
    const { data } = extractCategoryFromForm(form);
    expect(data.order).toBe(10);
  });

  it("order negativo es válido (no hay constraint en el schema)", () => {
    const form = fd({ name: "Nombre", slug: "nombre", order: "-5" });
    const { data, errors } = extractCategoryFromForm(form);
    expect(errors.order).toBeUndefined();
    expect(data.order).toBe(-5);
  });

  it('active checkbox "on" → true', () => {
    const form = fd({ name: "Nombre", slug: "nombre", active: "on" });
    const { data } = extractCategoryFromForm(form);
    expect(data.active).toBe(true);
  });

  it("active ausente (checkbox no marcado) → false", () => {
    // FormData sin key "active" simula un checkbox no marcado en el browser
    const form = fd({ name: "Nombre", slug: "nombre" });
    const { data } = extractCategoryFromForm(form);
    expect(data.active).toBe(false);
  });

  it("extrae todos los campos válidos correctamente", () => {
    const form = fd({
      name: "Mates",
      slug: "mates",
      icon: "🧉",
      description: "Mates impresos en 3D",
      order: "20",
      active: "on",
    });
    const { data, errors } = extractCategoryFromForm(form);
    expect(errors).toEqual({});
    expect(data).toEqual({
      name: "Mates",
      slug: "mates",
      icon: "🧉",
      description: "Mates impresos en 3D",
      order: 20,
      active: true,
    });
  });
});
