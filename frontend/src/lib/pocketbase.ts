import PocketBase from "pocketbase";
import type {
  Category,
  Product,
  ProductAttribute,
  ProductWithCategory,
} from "./types";

const PB_URL =
  import.meta.env.POCKETBASE_URL ||
  import.meta.env.PUBLIC_POCKETBASE_URL ||
  "http://localhost:8090";
const PB_IMAGE_URL = import.meta.env.PUBLIC_POCKETBASE_URL || PB_URL;

/** URL pública de PocketBase para construir file URLs en cliente */
export const PUBLIC_PB_URL = PB_IMAGE_URL;
const SITE_URL =
  import.meta.env.PUBLIC_SITE_URL || "https://printall.jmlabs.app";
const REQUEST_TIMEOUT_MS = 5000;

/**
 * Solo permite caracteres seguros en slugs (a-z, A-Z, 0-9, guiones y guion bajo).
 * Previene SQL injection en filters de PocketBase.
 */
export function sanitizeSlug(slug: string): string {
  return slug.replace(/[^a-zA-Z0-9\-_]/g, "");
}

function getClient(): PocketBase {
  const pb = new PocketBase(PB_URL);
  pb.beforeSend = (url, options) => {
    options.signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    return { url, options };
  };
  return pb;
}

export function getFileUrl(
  collectionId: string,
  recordId: string,
  fileName: string,
  thumb?: string,
): string {
  const origin = `${PB_IMAGE_URL}/api/files/${collectionId}/${recordId}/${fileName}`;
  if (!thumb) return origin;

  const [w, h] = thumb.split("x").map(Number);
  if (!w || !h) return `${origin}?thumb=${thumb}`;

  const opts = `format=auto,width=${w},height=${h},fit=cover,quality=85`;
  return `${SITE_URL}/cdn-cgi/image/${opts}/${origin}`;
}

/** Convierte imágenes crudas de PocketBase a ProductImage[] con thumbnails */
function expandProductImages(
  _pbUrl: string,
  product: Record<string, unknown>,
): Product {
  const rawImages = (product.images ?? []) as string[];
  const collectionId = (product.collectionId as string) ?? "";
  const recordId = (product.id as string) ?? "";

  const images = rawImages.map((fileName) => ({
    id: fileName,
    collectionId,
    fileName,
    url: getFileUrl(collectionId, recordId, fileName),
    thumbnails: {
      "120x120": getFileUrl(collectionId, recordId, fileName, "120x120"),
      "400x400": getFileUrl(collectionId, recordId, fileName, "400x400"),
      "800x800": getFileUrl(collectionId, recordId, fileName, "800x800"),
    },
  }));

  return {
    ...(product as unknown as Product),
    images,
  };
}

/** Procesa un record crudo de PocketBase a ProductWithCategory con imágenes, categoría expandida y attributes */
function mapToProductWithCategory(
  record: Record<string, unknown>,
): ProductWithCategory {
  const product = expandProductImages(PB_URL, record);
  const expand = record.expand as
    | {
        category?: Category;
        product_attributes_via_product?: unknown[];
      }
    | undefined;

  const rawAttrs = expand?.product_attributes_via_product ?? [];
  const attributes = rawAttrs
    .map((r) => r as ProductAttribute)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return {
    ...product,
    attributes,
    expand: {
      category: expand?.category ?? ({} as Category),
    },
  };
}

export async function getCategories(): Promise<Category[]> {
  const pb = getClient();
  const records = await pb.collection("categories").getFullList({
    sort: "order",
    filter: "active = true",
  });
  return records.map((r) => r as unknown as Category);
}

export async function getCategoryBySlug(
  slug: string,
): Promise<Category | null> {
  const pb = getClient();
  try {
    const safeSlug = sanitizeSlug(slug);
    const record = await pb
      .collection("categories")
      .getFirstListItem(`slug = "${safeSlug}"`);
    return record as unknown as Category;
  } catch {
    return null;
  }
}

export async function getProducts(
  categorySlug?: string,
): Promise<ProductWithCategory[]> {
  const pb = getClient();
  const safeSlug = categorySlug ? sanitizeSlug(categorySlug) : "";
  const filter = safeSlug
    ? `category.slug = "${safeSlug}" && published = true`
    : "published = true";

  const records = await pb.collection("products").getFullList({
    filter,
    sort: "-featured,-created",
    expand: "category",
    fields: "*",
  });

  return records.map((r) =>
    mapToProductWithCategory(r as Record<string, unknown>),
  );
}

export async function getProductBySlug(
  slug: string,
): Promise<ProductWithCategory | null> {
  const pb = getClient();
  try {
    const safeSlug = sanitizeSlug(slug);
    const record = await pb
      .collection("products")
      .getFirstListItem(`slug = "${safeSlug}" && published = true`, {
        expand: "category,product_attributes_via_product",
        fields: "*",
      });

    return mapToProductWithCategory(record as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function getRelatedProducts(
  categorySlug: string,
  excludeId: string,
  limit = 4,
): Promise<ProductWithCategory[]> {
  if (!categorySlug || !excludeId) return [];
  const pb = getClient();
  const safeSlug = sanitizeSlug(categorySlug);
  const safeId = excludeId.replace(/[^a-zA-Z0-9]/g, "");
  const filter = `category.slug = "${safeSlug}" && published = true && id != "${safeId}"`;

  try {
    const result = await pb.collection("products").getList(1, limit, {
      filter,
      sort: "-featured,-created",
      expand: "category",
      fields: "*",
    });

    return result.items.map((r) =>
      mapToProductWithCategory(r as unknown as Record<string, unknown>),
    );
  } catch {
    return [];
  }
}

export async function getFeaturedProducts(): Promise<ProductWithCategory[]> {
  const pb = getClient();
  const records = await pb.collection("products").getFullList({
    filter: "featured = true && published = true",
    sort: "-created",
    expand: "category",
    fields: "*",
  });

  return records.map((r) =>
    mapToProductWithCategory(r as Record<string, unknown>),
  );
}

export function getWhatsAppUrl(
  phoneNumber: string,
  message: string,
): string {
  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
}

export function getProductWhatsAppUrl(
  product: ProductWithCategory,
): string {
  const phone = import.meta.env.PUBLIC_WHATSAPP_NUMBER || "5493816563940";
  const categoryName = product.expand?.category?.name ?? "";
  const message = `¡Hola! 👋 Me interesa *${product.name}* (${categoryName})%0A%0A¿Está disponible?`;
  return getWhatsAppUrl(phone, message);
}
