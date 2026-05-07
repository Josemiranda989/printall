import type { StockStatus } from "./types";

export type ProductsListFilters = {
  q?: string;         // search en name (case-insensitive, partial match)
  categoria?: string; // category slug — si presente, filtrar
  stock?: string;     // stock_status — si presente, filtrar
  publicado?: string; // 'true' | 'false' | undefined — filter por published
};

const VALID_STOCK_VALUES: Set<string> = new Set<StockStatus>([
  "in_stock",
  "low_stock",
  "out_of_stock",
  "made_to_order",
]);

/**
 * Sanitiza el término de búsqueda del usuario.
 * Solo permite: letras (Unicode), números, espacios, guiones y puntos.
 * Elimina comillas dobles y barras invertidas para evitar PB filter injection.
 */
function sanitizeQ(raw: string): string {
  // Remover chars peligrosos para PB filter (quote/backslash)
  return raw
    .replace(/["\\']/g, "")   // elimina " ' \
    .replace(/[^\p{L}\p{N} .,-]/gu, "") // permite letras unicode, números, espacio, punto, coma, guión
    .trim();
}

/**
 * Construye un string de filter PocketBase combinando las condiciones con &&.
 * Si no hay filtros activos, retorna string vacío (PB acepta vacío = sin filtro).
 */
export function buildProductsFilter(filters: ProductsListFilters): string {
  const parts: string[] = [];

  // q: búsqueda parcial case-insensitive en name, description y slug
  if (filters.q !== undefined && filters.q !== "") {
    const safe = sanitizeQ(filters.q);
    if (safe !== "") {
      // Paréntesis críticos: sin ellos PocketBase combina el OR con los && de otros filtros
      parts.push(`(name ~ "${safe}" || description ~ "${safe}" || slug ~ "${safe}")`);
    }
  }

  // categoria: dot syntax para relation
  if (filters.categoria !== undefined && filters.categoria !== "") {
    parts.push(`category.slug = "${filters.categoria}"`);
  }

  // stock: solo si es un valor válido del enum
  if (
    filters.stock !== undefined &&
    filters.stock !== "" &&
    VALID_STOCK_VALUES.has(filters.stock)
  ) {
    parts.push(`stock_status = "${filters.stock}"`);
  }

  // publicado: solo 'true' | 'false'
  if (filters.publicado === "true") {
    parts.push(`published = true`);
  } else if (filters.publicado === "false") {
    parts.push(`published = false`);
  }

  return parts.join(" && ");
}

/**
 * Parsea URLSearchParams y retorna el objeto ProductsListFilters,
 * normalizando valores: trim, vacíos → undefined.
 */
export function parseSearchParams(
  searchParams: URLSearchParams
): ProductsListFilters {
  const raw = {
    q: searchParams.get("q"),
    categoria: searchParams.get("categoria"),
    stock: searchParams.get("stock"),
    publicado: searchParams.get("publicado"),
  };

  const q = raw.q !== null ? raw.q.trim() : undefined;
  const categoria =
    raw.categoria !== null && raw.categoria.trim() !== ""
      ? raw.categoria.trim()
      : undefined;
  const stock =
    raw.stock !== null && raw.stock.trim() !== ""
      ? raw.stock.trim()
      : undefined;
  const publicado =
    raw.publicado !== null && raw.publicado.trim() !== ""
      ? raw.publicado.trim()
      : undefined;

  return {
    q: q === "" ? undefined : q,
    categoria,
    stock,
    publicado,
  };
}

/**
 * Determina si hay al menos un filtro activo.
 */
export function hasFilters(filters: ProductsListFilters): boolean {
  return (
    (filters.q !== undefined && filters.q !== "") ||
    filters.categoria !== undefined ||
    filters.stock !== undefined ||
    filters.publicado !== undefined
  );
}

/**
 * Construye una URL de paginación preservando todos los query params actuales.
 * Reemplaza (o agrega) el param `page` con el nuevo número.
 * Si page === 1 se omite el param (URL más limpia, equivalente a page=1).
 */
export function buildPageUrl(
  currentParams: URLSearchParams,
  page: number
): string {
  const next = new URLSearchParams(currentParams);
  if (page <= 1) {
    next.delete("page");
  } else {
    next.set("page", String(page));
  }
  const qs = next.toString();
  return qs ? `?${qs}` : "?";
}
