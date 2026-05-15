import type PocketBase from "pocketbase";
import type { Order, SupplySaleWithItem, SalesLedgerEntry } from "./types";
import { orderTotalAmount, supplySaleTotal } from "./types";

export type SalesLedgerRange = {
  /** Fecha desde, inclusive (YYYY-MM-DD). Opcional. */
  from?: string;
  /** Fecha hasta, inclusive (YYYY-MM-DD). Opcional. */
  to?: string;
};

/** Mapea una orden de impresión a una entrada normalizada del ledger. */
export function mapOrderToLedgerEntry(o: Order): SalesLedgerEntry {
  return {
    id: o.id,
    tipo: "impresion",
    concepto: o.project_name,
    customer_name: o.customer_name,
    total: orderTotalAmount(o),
    is_paid: o.is_paid,
    fecha: o.order_date,
  };
}

/** Mapea una venta de insumo (con `item` expandido) a una entrada del ledger. */
export function mapSupplySaleToLedgerEntry(
  s: SupplySaleWithItem,
): SalesLedgerEntry {
  return {
    id: s.id,
    tipo: "insumo",
    concepto: s.expand?.item?.name ?? "(insumo eliminado)",
    customer_name: s.customer_name,
    total: supplySaleTotal(s),
    is_paid: s.is_paid,
    fecha: s.sale_date,
  };
}

/**
 * Une impresiones e insumos en un único ledger, ordenado por fecha
 * descendente (lo más reciente primero). Función pura — no toca PocketBase.
 */
export function mergeSalesLedger(
  orders: Order[],
  supplySales: SupplySaleWithItem[],
): SalesLedgerEntry[] {
  const entries = [
    ...orders.map(mapOrderToLedgerEntry),
    ...supplySales.map(mapSupplySaleToLedgerEntry),
  ];
  return entries.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/**
 * Construye el fragmento de filtro de PocketBase para un rango de fechas
 * sobre un campo. Devuelve "" si el rango está vacío.
 */
function dateRangeFilter(field: string, range: SalesLedgerRange): string {
  const parts: string[] = [];
  if (range.from) parts.push(`${field} >= "${range.from}"`);
  if (range.to) parts.push(`${field} <= "${range.to}"`);
  return parts.join(" && ");
}

/**
 * Reporting unificado: consulta `orders` (impresiones) y `supply_sales`
 * (insumos), excluye los cancelados, y devuelve el ledger combinado.
 *
 * Requiere un cliente PocketBase autenticado (admin) — ambas colecciones
 * tienen `listRule: null`. Por eso `pb` se recibe como parámetro en vez de
 * crear el cliente acá (mismo patrón que `getProductByIdAdmin`).
 *
 * Nota: la unión se hace en la capa de aplicación porque el parser de view
 * queries de PocketBase no soporta `UNION`.
 */
export async function getSalesLedger(
  pb: PocketBase,
  range: SalesLedgerRange = {},
): Promise<SalesLedgerEntry[]> {
  const ordersFilter = ['status != "cancelled"', dateRangeFilter("order_date", range)]
    .filter(Boolean)
    .join(" && ");
  const supplyFilter = ['status != "cancelado"', dateRangeFilter("sale_date", range)]
    .filter(Boolean)
    .join(" && ");

  const [orders, supplySales] = await Promise.all([
    pb.collection("orders").getFullList({ filter: ordersFilter }),
    pb.collection("supply_sales").getFullList({
      filter: supplyFilter,
      expand: "item",
    }),
  ]);

  return mergeSalesLedger(
    orders as unknown as Order[],
    supplySales as unknown as SupplySaleWithItem[],
  );
}
