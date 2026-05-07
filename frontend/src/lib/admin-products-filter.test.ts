import { describe, expect, it } from "vitest";
import {
  buildProductsFilter,
  parseSearchParams,
  hasFilters,
  type ProductsListFilters,
} from "./admin-products-filter";

// ---------------------------------------------------------------------------
// buildProductsFilter
// ---------------------------------------------------------------------------

describe("buildProductsFilter", () => {
  it("sin filtros → string vacío", () => {
    expect(buildProductsFilter({})).toBe("");
  });

  it("q vacío → string vacío", () => {
    expect(buildProductsFilter({ q: "" })).toBe("");
  });

  it("q con valor → name ~ parcial case-insensitive", () => {
    expect(buildProductsFilter({ q: "mate" })).toBe('name ~ "mate"');
  });

  it("categoria → category.slug con dot syntax", () => {
    expect(buildProductsFilter({ categoria: "filamentos" })).toBe(
      'category.slug = "filamentos"'
    );
  });

  it("stock válido in_stock → stock_status = ...", () => {
    expect(buildProductsFilter({ stock: "in_stock" })).toBe(
      'stock_status = "in_stock"'
    );
  });

  it("stock válido low_stock", () => {
    expect(buildProductsFilter({ stock: "low_stock" })).toBe(
      'stock_status = "low_stock"'
    );
  });

  it("stock inválido → silently ignored (no aparece en filter)", () => {
    expect(buildProductsFilter({ stock: "superdisponible" })).toBe("");
  });

  it("stock vacío → ignorado", () => {
    expect(buildProductsFilter({ stock: "" })).toBe("");
  });

  it("publicado true → published = true", () => {
    expect(buildProductsFilter({ publicado: "true" })).toBe("published = true");
  });

  it("publicado false → published = false", () => {
    expect(buildProductsFilter({ publicado: "false" })).toBe(
      "published = false"
    );
  });

  it("publicado valor distinto a true/false → silently ignored", () => {
    expect(buildProductsFilter({ publicado: "maybe" })).toBe("");
    expect(buildProductsFilter({ publicado: "1" })).toBe("");
    expect(buildProductsFilter({ publicado: "yes" })).toBe("");
  });

  it("q + stock → AND con &&", () => {
    const result = buildProductsFilter({ q: "mate", stock: "in_stock" });
    expect(result).toBe('name ~ "mate" && stock_status = "in_stock"');
  });

  it("categoria + publicado → AND con &&", () => {
    const result = buildProductsFilter({
      categoria: "filamentos",
      publicado: "true",
    });
    expect(result).toBe('category.slug = "filamentos" && published = true');
  });

  it("todos los filtros juntos → AND con && en orden correcto", () => {
    const filters: ProductsListFilters = {
      q: "vaso",
      categoria: "vasos",
      stock: "in_stock",
      publicado: "true",
    };
    const result = buildProductsFilter(filters);
    expect(result).toBe(
      'name ~ "vaso" && category.slug = "vasos" && stock_status = "in_stock" && published = true'
    );
  });

  // -------------------------------------------------------------------------
  // Sanitización del q — casos de injection / seguridad
  // -------------------------------------------------------------------------

  it('q con comilla doble → removida (evita PB filter injection)', () => {
    // 'mate"con'  →  'matecón' (sin la comilla)
    const result = buildProductsFilter({ q: 'mate"con' });
    expect(result).toBe('name ~ "matecon"');
    // el string resultado no debe contener comillas dobles DENTRO del valor
    const inner = result.slice('name ~ "'.length, -1);
    expect(inner).not.toContain('"');
  });

  it('q con comilla simple → removida', () => {
    const result = buildProductsFilter({ q: "mate'loco" });
    expect(result).toBe('name ~ "mateloco"');
  });

  it('q con barra invertida → removida', () => {
    const result = buildProductsFilter({ q: "mate\\loco" });
    expect(result).toBe('name ~ "mateloco"');
  });

  it("q con caracteres especiales de PB filter → removidos", () => {
    // caracteres como < > = & | no están permitidos
    const result = buildProductsFilter({ q: "mate<script>" });
    expect(result).toBe('name ~ "matescript"');
  });

  it("q solo de chars peligrosos → resulta vacío → filter vacío", () => {
    // si después de sanitizar queda vacío, no agregar condición
    expect(buildProductsFilter({ q: '"\\"' })).toBe("");
  });

  it("q con espacios → preserva espacios (búsqueda multipalabra)", () => {
    const result = buildProductsFilter({ q: "mate verde" });
    expect(result).toBe('name ~ "mate verde"');
  });

  it("q con leading/trailing spaces → trimmed", () => {
    const result = buildProductsFilter({ q: "  mate  " });
    expect(result).toBe('name ~ "mate"');
  });

  it("categoria desconocida → se incluye igual (PB resuelve sin error)", () => {
    // dejamos que PB valide; nuestro layer no bloquea categorías desconocidas
    const result = buildProductsFilter({ categoria: "categoria-que-no-existe" });
    expect(result).toBe('category.slug = "categoria-que-no-existe"');
  });
});

// ---------------------------------------------------------------------------
// parseSearchParams
// ---------------------------------------------------------------------------

describe("parseSearchParams", () => {
  function sp(params: Record<string, string>): URLSearchParams {
    return new URLSearchParams(params);
  }

  it("sin params → todos undefined", () => {
    const result = parseSearchParams(new URLSearchParams());
    expect(result.q).toBeUndefined();
    expect(result.categoria).toBeUndefined();
    expect(result.stock).toBeUndefined();
    expect(result.publicado).toBeUndefined();
  });

  it("q present → parseado correctamente", () => {
    expect(parseSearchParams(sp({ q: "mate" })).q).toBe("mate");
  });

  it("q vacío → undefined", () => {
    expect(parseSearchParams(sp({ q: "" })).q).toBeUndefined();
  });

  it("q con whitespace → trimmed; si queda vacío → undefined", () => {
    expect(parseSearchParams(sp({ q: "  " })).q).toBeUndefined();
    expect(parseSearchParams(sp({ q: "  mate  " })).q).toBe("mate");
  });

  it("categoria present → parseada", () => {
    expect(parseSearchParams(sp({ categoria: "filamentos" })).categoria).toBe(
      "filamentos"
    );
  });

  it("categoria vacía → undefined", () => {
    expect(parseSearchParams(sp({ categoria: "" })).categoria).toBeUndefined();
  });

  it("stock present → parseado", () => {
    expect(parseSearchParams(sp({ stock: "in_stock" })).stock).toBe("in_stock");
  });

  it("stock vacío → undefined", () => {
    expect(parseSearchParams(sp({ stock: "" })).stock).toBeUndefined();
  });

  it("publicado true → parseado", () => {
    expect(parseSearchParams(sp({ publicado: "true" })).publicado).toBe("true");
  });

  it("publicado false → parseado", () => {
    expect(parseSearchParams(sp({ publicado: "false" })).publicado).toBe(
      "false"
    );
  });

  it("publicado vacío → undefined", () => {
    expect(
      parseSearchParams(sp({ publicado: "" })).publicado
    ).toBeUndefined();
  });

  it("todos los params juntos → parseados correctamente", () => {
    const params = sp({
      q: "vaso",
      categoria: "vasos",
      stock: "low_stock",
      publicado: "false",
    });
    const result = parseSearchParams(params);
    expect(result.q).toBe("vaso");
    expect(result.categoria).toBe("vasos");
    expect(result.stock).toBe("low_stock");
    expect(result.publicado).toBe("false");
  });
});

// ---------------------------------------------------------------------------
// hasFilters
// ---------------------------------------------------------------------------

describe("hasFilters", () => {
  it("objeto vacío → false", () => {
    expect(hasFilters({})).toBe(false);
  });

  it("q vacío → false", () => {
    expect(hasFilters({ q: "" })).toBe(false);
  });

  it("q con valor → true", () => {
    expect(hasFilters({ q: "algo" })).toBe(true);
  });

  it("categoria sola → true", () => {
    expect(hasFilters({ categoria: "vasos" })).toBe(true);
  });

  it("stock solo → true", () => {
    expect(hasFilters({ stock: "in_stock" })).toBe(true);
  });

  it("publicado solo → true", () => {
    expect(hasFilters({ publicado: "true" })).toBe(true);
  });
});
