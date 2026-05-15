export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string;
  order: number;
  active: boolean;
}

export interface ProductImage {
  id: string;
  collectionId: string;
  fileName: string;
  thumbnails: {
    "120x120": string;
    "400x400": string;
    "800x800": string;
  };
  url: string;
}

export type StockStatus =
  | "in_stock"
  | "low_stock"
  | "out_of_stock"
  | "made_to_order";

export interface ProductAttribute {
  id: string;
  product: string;
  key: string;
  value: string;
  order: number;
  created: string;
  updated: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  price: number;
  price_label: string;
  stock_status: StockStatus;
  featured: boolean;
  attributes: ProductAttribute[];
  images: ProductImage[];
  published: boolean;
  created: string;
  updated: string;
}

export interface ProductWithCategory extends Product {
  expand: {
    category: Category;
  };
}

export const STOCK_LABELS: Record<StockStatus, string> = {
  in_stock: "Disponible",
  low_stock: "Poco stock",
  out_of_stock: "Agotado",
  made_to_order: "A pedido",
};

export const STOCK_COLORS: Record<StockStatus, string> = {
  in_stock: "bg-emerald-600",
  low_stock: "bg-amber-500",
  out_of_stock: "bg-gray-400",
  made_to_order: "bg-blue-600",
};

// ─── ORDERS ────────────────────────────────────────────────────────────────

export type OrderStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "delivered"
  | "cancelled";

export type Priority = "high" | "medium" | "low";

export type Material =
  | "pla"
  | "abs"
  | "petg"
  | "tpu"
  | "nylon"
  | "asa"
  | "pc"
  | "hips";

export type Color =
  | "blanco"
  | "negro"
  | "gris"
  | "azul"
  | "rojo"
  | "verde"
  | "amarillo"
  | "naranja"
  | "morado"
  | "transparente"
  | "celeste";

export interface Order {
  id: string;
  order_number: string;
  project_name: string;
  customer_name: string;
  customer_whatsapp: string;
  material: Material;
  color: Color;
  priority: Priority;
  status: OrderStatus;
  /** Derivado server-side: true cuando paid_amount cubre el total. */
  is_paid: boolean;
  unit_price: number;
  units_ordered: number;
  units_done: number;
  /** Monto que el cliente pagó hasta ahora (seña parcial o total). */
  paid_amount: number;
  order_date: string;
  delivery_date: string;
  notes: string;
  created: string;
  updated: string;
}

/** Saldo pendiente: total comprometido menos lo ya pagado, mínimo 0. */
export function orderBalanceDue(
  o: Pick<Order, "unit_price" | "units_ordered" | "paid_amount">,
): number {
  const total = (o.unit_price ?? 0) * (o.units_ordered ?? 0);
  const paid = o.paid_amount ?? 0;
  return Math.max(0, total - paid);
}

export function orderTotalAmount(o: Pick<Order, "unit_price" | "units_ordered">): number {
  return (o.unit_price ?? 0) * (o.units_ordered ?? 0);
}

export function orderProgressPercent(
  o: Pick<Order, "units_done" | "units_ordered">,
): number {
  const ordered = o.units_ordered ?? 0;
  if (ordered <= 0) return 0;
  const done = o.units_done ?? 0;
  return Math.min(100, Math.max(0, Math.round((done / ordered) * 100)));
}

export const ORDER_STATUS_VALUES: readonly OrderStatus[] = [
  "pending",
  "in_progress",
  "completed",
  "delivered",
  "cancelled",
] as const;

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pendiente",
  in_progress: "En proceso",
  completed: "Completado",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "bg-red-100 text-red-800 border-red-300",
  in_progress: "bg-amber-100 text-amber-800 border-amber-300",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-300",
  delivered: "bg-blue-100 text-blue-800 border-blue-300",
  cancelled: "bg-gray-100 text-gray-600 border-gray-300",
};

export const PRIORITY_VALUES: readonly Priority[] = ["high", "medium", "low"] as const;

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  high: "bg-red-600 text-white",
  medium: "bg-amber-500 text-white",
  low: "bg-emerald-600 text-white",
};

export const MATERIAL_VALUES: readonly Material[] = [
  "pla",
  "abs",
  "petg",
  "tpu",
  "nylon",
  "asa",
  "pc",
  "hips",
] as const;

export const MATERIAL_LABELS: Record<Material, string> = {
  pla: "PLA",
  abs: "ABS",
  petg: "PETG",
  tpu: "TPU",
  nylon: "Nylon",
  asa: "ASA",
  pc: "PC (Policarbonato)",
  hips: "HIPS",
};

export const COLOR_VALUES: readonly Color[] = [
  "blanco",
  "negro",
  "gris",
  "azul",
  "rojo",
  "verde",
  "amarillo",
  "naranja",
  "morado",
  "transparente",
  "celeste",
] as const;

export const COLOR_LABELS: Record<Color, string> = {
  blanco: "Blanco",
  negro: "Negro",
  gris: "Gris",
  azul: "Azul",
  rojo: "Rojo",
  verde: "Verde",
  amarillo: "Amarillo",
  naranja: "Naranja",
  morado: "Morado",
  transparente: "Transparente",
  celeste: "Celeste",
};

// Hex aproximado para el chip visual de color en la UI (no es exacto, solo guía).
export const COLOR_HEX: Record<Color, string> = {
  blanco: "#ffffff",
  negro: "#1a1a1a",
  gris: "#9ca3af",
  azul: "#2563eb",
  rojo: "#dc2626",
  verde: "#16a34a",
  amarillo: "#facc15",
  naranja: "#f97316",
  morado: "#9333ea",
  transparente: "linear-gradient(45deg,#fff 0%,#f3f4f6 50%,#fff 100%)",
  celeste: "#7dd3fc",
};

// ─── MATERIALS (calculadora de costos) ────────────────────────────────────

export type MaterialKind = "filament" | "component" | "adhesive" | "accessory";

export interface MaterialPrice {
  id: string;
  name: string;
  kind: MaterialKind;
  /** Lo que pagás vos al proveedor. Filament: $/kg. Component: $/u. */
  cost_price: number;
  /** Lo que cobrás al cliente. Filament: $/kg. Component: $/u. */
  sell_price: number;
  active: boolean;
  created: string;
  updated: string;
}

/** Margen calculado: (sell - cost) / cost. Devuelve null si cost = 0. */
export function materialMargin(m: Pick<MaterialPrice, "cost_price" | "sell_price">): number | null {
  if (!m.cost_price || m.cost_price <= 0) return null;
  return (m.sell_price - m.cost_price) / m.cost_price;
}

export const MATERIAL_KIND_VALUES: readonly MaterialKind[] = [
  "filament",
  "component",
  "adhesive",
  "accessory",
] as const;

export const MATERIAL_KIND_LABELS: Record<MaterialKind, string> = {
  filament: "Filamento",
  component: "Componente",
  adhesive: "Adhesivo",
  accessory: "Accesorio",
};

export const MATERIAL_KIND_UNIT: Record<MaterialKind, string> = {
  filament: "$/kg",
  component: "$/u",
  adhesive: "$/u",
  accessory: "$/u",
};

/**
 * Costo de impresión para una cantidad de filamento.
 * Fórmula: (gramos / 1000) × cost_price × processMultiplier.
 *
 * El multiplicador del proceso (típico ×5) cubre errores, luz, tiempo y
 * desgaste de máquina. Es del proceso, NO del material.
 */
export function filamentCost(
  material: Pick<MaterialPrice, "cost_price">,
  grams: number,
  processMultiplier: number,
): number {
  if (grams <= 0) return 0;
  return (grams / 1000) * material.cost_price * processMultiplier;
}

/**
 * Precio sugerido para N componentes (argollas, vasos, etc).
 * Fórmula: cantidad × sell_price.
 *
 * Los componentes físicos NO se imprimen — se le cobran al cliente al
 * precio de venta directo, sin pasar por el multiplicador del proceso.
 */
export function componentCost(material: Pick<MaterialPrice, "sell_price">, qty: number): number {
  if (qty <= 0) return 0;
  return qty * material.sell_price;
}

/** Default del multiplicador del proceso (errores + luz + tiempo + desgaste). */
export const DEFAULT_PROCESS_MULTIPLIER = 5;

// ─── SUPPLY SALES (ventas de insumos) ─────────────────────────────────────

export type SupplySaleStatus = "reservado" | "entregado" | "cancelado";

export interface SupplySale {
  id: string;
  customer_name: string;
  customer_whatsapp: string;
  /** Relación a `materials`. */
  item: string;
  quantity: number;
  /** Foto del precio al momento de la venta — no se deriva de sell_price. */
  unit_price: number;
  status: SupplySaleStatus;
  is_paid: boolean;
  sale_date: string;
  delivery_date: string;
  notes: string;
  created: string;
  updated: string;
}

export interface SupplySaleWithItem extends SupplySale {
  expand: {
    item: MaterialPrice;
  };
}

/** Total de la venta: cantidad × precio unitario. */
export function supplySaleTotal(
  s: Pick<SupplySale, "unit_price" | "quantity">,
): number {
  return (s.unit_price ?? 0) * (s.quantity ?? 0);
}

export const SUPPLY_SALE_STATUS_VALUES: readonly SupplySaleStatus[] = [
  "reservado",
  "entregado",
  "cancelado",
] as const;

export const SUPPLY_SALE_STATUS_LABELS: Record<SupplySaleStatus, string> = {
  reservado: "Reservado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export const SUPPLY_SALE_STATUS_COLORS: Record<SupplySaleStatus, string> = {
  reservado: "bg-amber-100 text-amber-800 border-amber-300",
  entregado: "bg-emerald-100 text-emerald-800 border-emerald-300",
  cancelado: "bg-gray-100 text-gray-600 border-gray-300",
};

// ─── SALES LEDGER (reporting unificado) ───────────────────────────────────

export type SalesLedgerTipo = "impresion" | "insumo";

export interface SalesLedgerEntry {
  /** Id del record de origen (orders o supply_sales). */
  id: string;
  tipo: SalesLedgerTipo;
  /** project_name para impresiones, materials.name para insumos. */
  concepto: string;
  customer_name: string;
  total: number;
  is_paid: boolean;
  /** order_date para impresiones, sale_date para insumos. */
  fecha: string;
}
