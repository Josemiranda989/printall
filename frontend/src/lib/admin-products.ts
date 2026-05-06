import { slugify } from "./slug";
import type { StockStatus } from "./types";

const VALID_STOCK: readonly StockStatus[] = [
  "in_stock",
  "low_stock",
  "out_of_stock",
  "made_to_order",
];

export type ProductFormData = {
  name: string;
  slug: string;
  category: string;
  description: string;
  price: number;
  price_label: string;
  stock_status: StockStatus;
  featured: boolean;
  published: boolean;
};

export type ExtractResult = {
  data: ProductFormData;
  errors: Record<string, string>;
};

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function checkbox(form: FormData, key: string): boolean {
  const v = form.get(key);
  return v === "on" || v === "true" || v === "1";
}

export function extractProductFromForm(form: FormData): ExtractResult {
  const errors: Record<string, string> = {};

  const name = str(form, "name");
  const rawSlug = str(form, "slug");
  const category = str(form, "category");
  const description = str(form, "description");
  const priceRaw = str(form, "price");
  const price_label = str(form, "price_label");
  const stockRaw = str(form, "stock_status");
  const featured = checkbox(form, "featured");
  const published = checkbox(form, "published");

  if (!name) errors.name = "El nombre es obligatorio.";
  if (!category) errors.category = "Elegí una categoría.";

  let stock_status: StockStatus = "in_stock";
  if (!stockRaw) {
    errors.stock_status = "Elegí un estado de stock.";
  } else if (!VALID_STOCK.includes(stockRaw as StockStatus)) {
    errors.stock_status = "Estado de stock inválido.";
  } else {
    stock_status = stockRaw as StockStatus;
  }

  let price = 0;
  if (priceRaw !== "") {
    const parsed = Number(priceRaw);
    if (!Number.isFinite(parsed)) {
      errors.price = "El precio debe ser un número.";
    } else if (parsed < 0) {
      errors.price = "El precio no puede ser negativo.";
    } else {
      price = parsed;
    }
  }

  const slug = rawSlug || slugify(name);

  return {
    data: {
      name,
      slug,
      category,
      description,
      price,
      price_label,
      stock_status,
      featured,
      published,
    },
    errors,
  };
}
