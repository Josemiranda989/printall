import { describe, expect, it } from "vitest";
import {
  buildProductsFilter,
  buildPageUrl,
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

  it("q con valor → OR en name, description y slug con paréntesis", () => {
    expect(buildProductsFilter({ q: "mate" })).toBe(
      '(name ~ "mate" || description ~ "mate" || slug ~ "mate")'
    );
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

  it("q + stock → OR entre paréntesis && stock", () => {
    const result = buildProductsFilter({ q: "mate", stock: "in_stock" });
    expect(result).toBe(
      '(name ~ "mate" || description ~ "mate" || slug ~ "mate") && stock_status = "in_stock"'
    );
  });

  it("categoria + publicado → AND con &&", () => {
    const result = buildProductsFilter({
      categoria: "filamentos",
      publicado: "true",
    });
    expect(result).toBe('category.slug = "filamentos" && published = true');
  });

  it("todos los filtros juntos → OR entre paréntesis && resto en orden correcto", () => {
    const filters: ProductsListFilters = {
      q: "vaso",
      categoria: "vasos",
      stock: "in_stock",
      publicado: "true",
    };
    const result = buildProductsFilter(filters);
    expect(result).toBe(
      '(name ~ "vaso" || description ~ "vaso" || slug ~ "vaso") && category.slug = "vasos" && stock_status = "in_stock" && published = true'
    );
  });

  // -------------------------------------------------------------------------
  // Sanitización del q — casos de injection / seguridad
  // -------------------------------------------------------------------------

  it('q con comilla doble → removida (evita PB filter injection)', () => {
    // 'mate"con'  →  'matecon' (sin la comilla)
    const result = buildProductsFilter({ q: 'mate"con' });
    expect(result).toBe(
      '(name ~ "matecon" || description ~ "matecon" || slug ~ "matecon")'
    );
    // verificar que la comilla original no quedó dentro de ningún valor
    // extraer los tres valores: deben ser "matecon" sin comillas internas
    const values = [...result.matchAll(/~ "([^"]*)"/g)].map((m) => m[1]);
    expect(values).toHaveLength(3);
    values.forEach((v) => expect(v).not.toContain('"'));
  });

  it('q con comilla simple → removida', () => {
    const result = buildProductsFilter({ q: "mate'loco" });
    expect(result).toBe(
      '(name ~ "mateloco" || description ~ "mateloco" || slug ~ "mateloco")'
    );
  });

  it('q con barra invertida → removida', () => {
    const result = buildProductsFilter({ q: "mate\\loco" });
    expect(result).toBe(
      '(name ~ "mateloco" || description ~ "mateloco" || slug ~ "mateloco")'
    );
  });

  it("q con caracteres especiales de PB filter → removidos", () => {
    // caracteres como < > = & | no están permitidos
    const result = buildProductsFilter({ q: "mate<script>" });
    expect(result).toBe(
      '(name ~ "matescript" || description ~ "matescript" || slug ~ "matescript")'
    );
  });

  it("q solo de chars peligrosos → resulta vacío → filter vacío", () => {
    // si después de sanitizar queda vacío, no agregar condición
    expect(buildProductsFilter({ q: '"\\"' })).toBe("");
  });

  it("q con espacios → preserva espacios (búsqueda multipalabra)", () => {
    const result = buildProductsFilter({ q: "mate verde" });
    expect(result).toBe(
      '(name ~ "mate verde" || description ~ "mate verde" || slug ~ "mate verde")'
    );
  });

  it("q con leading/trailing spaces → trimmed", () => {
    const result = buildProductsFilter({ q: "  mate  " });
    expect(result).toBe(
      '(name ~ "mate" || description ~ "mate" || slug ~ "mate")'
    );
  });

  it("categoria desconocida → se incluye igual (PB resuelve sin error)", () => {
    // dejamos que PB valide; nuestro layer no bloquea categorías desconocidas
    const result = buildProductsFilter({ categoria: "categoria-que-no-existe" });
    expect(result).toBe('category.slug = "categoria-que-no-existe"');
  });

  // -------------------------------------------------------------------------
  // Búsqueda expandida — nuevos tests Sprint 9
  // -------------------------------------------------------------------------

  it("solo q → genera OR completo con paréntesis (name, description, slug)", () => {
    const result = buildProductsFilter({ q: "mate" });
    expect(result).toBe(
      '(name ~ "mate" || description ~ "mate" || slug ~ "mate")'
    );
  });

  it("q + categoría → OR entre paréntesis seguido de && con category.slug", () => {
    const result = buildProductsFilter({ q: "mate", categoria: "mates" });
    expect(result).toBe(
      '(name ~ "mate" || description ~ "mate" || slug ~ "mate") && category.slug = "mates"'
    );
  });

  it("q + todos los filtros → OR entre paréntesis al inicio del filter", () => {
    const result = buildProductsFilter({
      q: "llavero",
      categoria: "accesorios",
      stock: "low_stock",
      publicado: "false",
    });
    expect(result).toBe(
      '(name ~ "llavero" || description ~ "llavero" || slug ~ "llavero") && category.slug = "accesorios" && stock_status = "low_stock" && published = false'
    );
  });
});

// ---------------------------------------------------------------------------
// buildPageUrl
// ---------------------------------------------------------------------------

describe("buildPageUrl", () => {
  function sp(params: Record<string, string>): URLSearchParams {
    return new URLSearchParams(params);
  }

  it("sin params + page 1 → '?' (page se omite para URLs limpias)", () => {
    // page=1 equivale a no tener page, así que se omite el param
    expect(buildPageUrl(new URLSearchParams(), 1)).toBe("?");
  });

  it("sin params + page 3 → '?page=3'", () => {
    expect(buildPageUrl(new URLSearchParams(), 3)).toBe("?page=3");
  });

  it("con filtros activos + page 2 → preserva filtros y agrega page", () => {
    const params = sp({ q: "mate", categoria: "mates" });
    const result = buildPageUrl(params, 2);
    // Debe contener todos los params originales y el page nuevo
    const parsed = new URLSearchParams(result.slice(1)); // quita el ?
    expect(parsed.get("q")).toBe("mate");
    expect(parsed.get("categoria")).toBe("mates");
    expect(parsed.get("page")).toBe("2");
  });

  it("con filtros + page 1 → preserva filtros y OMITE page", () => {
    const params = sp({ q: "mate", stock: "in_stock" });
    const result = buildPageUrl(params, 1);
    const parsed = new URLSearchParams(result.slice(1));
    expect(parsed.get("q")).toBe("mate");
    expect(parsed.get("stock")).toBe("in_stock");
    expect(parsed.has("page")).toBe(false);
  });

  it("con page existente en params → lo reemplaza con el nuevo", () => {
    const params = sp({ q: "llavero", page: "3" });
    const result = buildPageUrl(params, 5);
    const parsed = new URLSearchParams(result.slice(1));
    expect(parsed.get("page")).toBe("5");
    expect(parsed.get("q")).toBe("llavero");
  });

  it("con page existente → page 1 → lo elimina", () => {
    const params = sp({ q: "algo", page: "7" });
    const result = buildPageUrl(params, 1);
    const parsed = new URLSearchParams(result.slice(1));
    expect(parsed.has("page")).toBe(false);
    expect(parsed.get("q")).toBe("algo");
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
