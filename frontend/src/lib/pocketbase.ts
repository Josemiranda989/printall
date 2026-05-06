import PocketBase from "pocketbase";
import type { Category, Product, ProductWithCategory } from "./types";

const PB_URL =
  import.meta.env.POCKETBASE_URL ||
  import.meta.env.PUBLIC_POCKETBASE_URL ||
  "http://localhost:8090";
const PB_IMAGE_URL = import.meta.env.PUBLIC_POCKETBASE_URL || PB_URL;
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
  const base = `${PB_IMAGE_URL}/api/files/${collectionId}/${recordId}/${fileName}`;
  if (thumb) {
    return `${base}?thumb=${thumb}`;
  }
  return base;
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

/** Procesa un record crudo de PocketBase a ProductWithCategory con imágenes y categoría expandida */
function mapToProductWithCategory(
  record: Record<string, unknown>,
): ProductWithCategory {
  const product = expandProductImages(PB_URL, record);
  return {
    ...product,
    expand: {
      category: record.expand
        ? (record.expand as { category: Category }).category
        : ({} as Category),
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
    ? `category.slug = "${safeSlug}" && active = true`
    : "active = true";

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
      .getFirstListItem(`slug = "${safeSlug}" && active = true`, {
        expand: "category",
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
  const filter = `category.slug = "${safeSlug}" && active = true && id != "${safeId}"`;

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
    filter: "featured = true && active = true",
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
  const message =
    product.whatsapp_message ||
    `¡Hola! 👋 Me interesa *${product.name}* (${product.expand?.category?.name ?? ""})%0A%0A¿Está disponible?`;
  return getWhatsAppUrl(phone, message);
}
