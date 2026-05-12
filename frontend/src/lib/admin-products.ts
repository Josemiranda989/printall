import { slugify } from "./slug";
import type { StockStatus } from "./types";

// Image constraints — must match maxSelect del campo images en la collection products.
// Bumpeado a 16 en pb_migrations/1778100300_products_images_max_16.js.
export const IMAGES_MAX_COUNT = 16;
export const IMAGES_MAX_SIZE = 5 * 1024 * 1024; // 5MB
export const IMAGES_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

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

export type ImagesExtractResult =
  | { ok: true; files: File[] }
  | { ok: false; errors: string[] };

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function checkbox(form: FormData, key: string): boolean {
  const v = form.get(key);
  return v === "on" || v === "true" || v === "1";
}

export function extractImagesFromForm(form: FormData): ImagesExtractResult {
  const entries = form.getAll("images");
  const errors: string[] = [];

  // Filter out empty File entries (browser sends File{size:0, name:""} for empty <input type="file">)
  const files = entries.filter((entry): entry is File => {
    if (!(entry instanceof File)) return false;
    if (entry.size === 0 && entry.name === "") return false;
    return true;
  });

  if (files.length > IMAGES_MAX_COUNT) {
    errors.push(`Máximo ${IMAGES_MAX_COUNT} imágenes permitidas (enviaste ${files.length}).`);
    return { ok: false, errors };
  }

  for (const file of files) {
    if (file.size > IMAGES_MAX_SIZE) {
      errors.push(`Imagen '${file.name}' supera el tamaño máximo de 5MB.`);
    }
    if (!(IMAGES_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
      errors.push(`Imagen '${file.name}' tiene un formato no permitido (${file.type}). Usá jpeg, png o webp.`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, files };
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
