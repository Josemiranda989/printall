import type { Product, Category, StockStatus } from "./types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type JsonLdOffer = {
  "@type": "Offer";
  priceCurrency: "ARS";
  price: string;
  availability: string;
  url: string;
  seller: { "@type": "Organization"; name: string };
};

export type ProductJsonLd = {
  "@context": "https://schema.org";
  "@type": "Product";
  name: string;
  description: string;
  sku: string;
  brand: { "@type": "Brand"; name: string };
  image?: string[];
  category?: string;
  offers?: JsonLdOffer;
};

// ── Availability map ──────────────────────────────────────────────────────────

const AVAILABILITY: Record<StockStatus, string> = {
  in_stock: "https://schema.org/InStock",
  low_stock: "https://schema.org/LimitedAvailability",
  out_of_stock: "https://schema.org/OutOfStock",
  made_to_order: "https://schema.org/PreOrder",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Quita trailing slash de una URL base para hacer join limpio */
function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

/** Map de named entities HTML comunes en español. Los crawlers de Google ven
 * mejor el texto plano que entities crudas tipo "&oacute;". */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  iexcl: "¡", iquest: "¿", deg: "°", plusmn: "±",
  laquo: "«", raquo: "»", hellip: "…", ndash: "–", mdash: "—",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  ntilde: "ñ", Ntilde: "Ñ", uuml: "ü", Uuml: "Ü",
  ordf: "ª", ordm: "º", trade: "™", reg: "®", copy: "©",
};

/** Decodifica entities HTML (named + numeric) a texto plano. */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, code) => {
      try {
        return String.fromCodePoint(parseInt(code, 10));
      } catch {
        return _;
      }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => {
      try {
        return String.fromCodePoint(parseInt(code, 16));
      } catch {
        return _;
      }
    })
    .replace(/&([a-zA-Z]+);/g, (match, name) => NAMED_ENTITIES[name] ?? match);
}

/** Strip HTML tags, decodifica entities, colapsa whitespace y trunca a maxLen. */
function stripHtml(html: string | undefined | null, maxLen = 5000): string {
  if (!html) return "";
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

/** Convierte una URL (relativa o absoluta) a absoluta usando baseUrl */
function toAbsoluteUrl(url: string, base: string): string {
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

// ── Main function ─────────────────────────────────────────────────────────────

export function buildProductJsonLd(
  product: Product & { expand?: { category?: Category } },
  baseUrl: string
): ProductJsonLd {
  const base = stripTrailingSlash(baseUrl);

  // image: array de URLs absolutas; si no hay imágenes → undefined (no array vacío)
  const imageUrls =
    product.images?.length > 0
      ? product.images.map((img) => toAbsoluteUrl(img.url, base))
      : undefined;

  // category: solo si expand.category existe
  const categoryName = product.expand?.category?.name;

  // offers: solo si price > 0
  const offers: JsonLdOffer | undefined =
    product.price > 0
      ? {
          "@type": "Offer",
          priceCurrency: "ARS",
          price: String(product.price),
          availability: AVAILABILITY[product.stock_status] ?? "https://schema.org/InStock",
          url: `${base}/producto/${product.slug}`,
          seller: { "@type": "Organization", name: "Print All" },
        }
      : undefined;

  const result: ProductJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: stripHtml(product.description),
    sku: product.id,
    brand: { "@type": "Brand", name: "Print All" },
  };

  if (imageUrls !== undefined) result.image = imageUrls;
  if (categoryName !== undefined) result.category = categoryName;
  if (offers !== undefined) result.offers = offers;

  return result;
}
