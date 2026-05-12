import {
  COLOR_VALUES,
  MATERIAL_VALUES,
  ORDER_STATUS_VALUES,
  PRIORITY_VALUES,
} from "./types";

export type OrdersListFilters = {
  q?: string;
  status?: string;
  priority?: string;
  material?: string;
  color?: string;
  paid?: string; // "yes" | "no" | undefined
  delivery_from?: string; // YYYY-MM-DD
  delivery_to?: string; // YYYY-MM-DD
  /**
   * Si false (default), oculta los pedidos finalizados (entregados Y pagados).
   * El usuario los ve solo si activa el toggle "Mostrar finalizados".
   */
  show_finalized?: boolean;
};

const VALID_STATUS = new Set<string>(ORDER_STATUS_VALUES);
const VALID_PRIORITY = new Set<string>(PRIORITY_VALUES);
const VALID_MATERIAL = new Set<string>(MATERIAL_VALUES);
const VALID_COLOR = new Set<string>(COLOR_VALUES);

/**
 * Sanitiza el término de búsqueda para evitar injection en filters de PB.
 * Mismo pattern que admin-products-filter.ts.
 */
function sanitizeQ(raw: string): string {
  return raw
    .replace(/["\\']/g, "")
    .replace(/[^\p{L}\p{N} .,\-]/gu, "")
    .trim();
}

/**
 * Verifica que el string sea un date YYYY-MM-DD válido.
 */
function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d.getTime());
}

/**
 * Construye un string de filter PocketBase combinando condiciones con &&.
 * Si no hay filtros activos, retorna "" (PB acepta vacío = sin filtro).
 */
export function buildOrdersFilter(filters: OrdersListFilters): string {
  const parts: string[] = [];

  if (filters.q && filters.q !== "") {
    const safe = sanitizeQ(filters.q);
    if (safe !== "") {
      // Paréntesis críticos: sin ellos PB combina el OR con && de otros filtros.
      parts.push(
        `(project_name ~ "${safe}" || customer_name ~ "${safe}" || order_number ~ "${safe}")`,
      );
    }
  }

  if (filters.status && VALID_STATUS.has(filters.status)) {
    parts.push(`status = "${filters.status}"`);
  }

  if (filters.priority && VALID_PRIORITY.has(filters.priority)) {
    parts.push(`priority = "${filters.priority}"`);
  }

  if (filters.material && VALID_MATERIAL.has(filters.material)) {
    parts.push(`material = "${filters.material}"`);
  }

  if (filters.color && VALID_COLOR.has(filters.color)) {
    parts.push(`color = "${filters.color}"`);
  }

  if (filters.paid === "yes") {
    parts.push(`is_paid = true`);
  } else if (filters.paid === "no") {
    parts.push(`is_paid = false`);
  }

  if (filters.delivery_from && isValidDate(filters.delivery_from)) {
    parts.push(`delivery_date >= "${filters.delivery_from} 00:00:00"`);
  }
  if (filters.delivery_to && isValidDate(filters.delivery_to)) {
    parts.push(`delivery_date <= "${filters.delivery_to} 23:59:59"`);
  }

  // Por default ocultamos los finalizados (entregados Y pagados). El usuario
  // los hace aparecer marcando el toggle "Mostrar finalizados".
  // Paréntesis críticos para que el OR no se mezcle con los && previos.
  if (!filters.show_finalized) {
    parts.push(`(status != "delivered" || is_paid != true)`);
  }

  return parts.join(" && ");
}

export function parseSearchParams(searchParams: URLSearchParams): OrdersListFilters {
  const get = (k: string): string | undefined => {
    const v = searchParams.get(k);
    if (v === null) return undefined;
    const trimmed = v.trim();
    return trimmed === "" ? undefined : trimmed;
  };

  return {
    q: get("q"),
    status: get("status"),
    priority: get("priority"),
    material: get("material"),
    color: get("color"),
    paid: get("paid"),
    delivery_from: get("delivery_from"),
    delivery_to: get("delivery_to"),
    show_finalized: searchParams.get("show_finalized") === "1",
  };
}

export function hasFilters(filters: OrdersListFilters): boolean {
  // show_finalized=false es el comportamiento por defecto, NO cuenta como filtro activo.
  // Solo cuenta cuando el usuario lo activa explícitamente (= true).
  const { show_finalized, ...rest } = filters;
  if (show_finalized) return true;
  return Object.values(rest).some((v) => v !== undefined && v !== "");
}

export function buildPageUrl(
  currentParams: URLSearchParams,
  page: number,
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
