import type { APIRoute } from "astro";
import { getProducts } from "../lib/pocketbase";

const STATIC_PATHS = ["/", "/contacto"];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toIsoLastmod(raw: string): string | null {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function urlEntry(loc: string, lastmodRaw?: string): string {
  const iso = lastmodRaw ? toIsoLastmod(lastmodRaw) : null;
  const lastmodTag = iso ? `\n    <lastmod>${iso}</lastmod>` : "";
  return `  <url>\n    <loc>${escapeXml(loc)}</loc>${lastmodTag}\n  </url>`;
}

export const GET: APIRoute = async ({ site }) => {
  if (!site) {
    throw new Error("`site` debe estar configurado en astro.config.mjs");
  }
  const baseUrl = site.toString().replace(/\/$/, "");

  const entries: string[] = STATIC_PATHS.map((path) =>
    urlEntry(`${baseUrl}${path}`),
  );

  try {
    const products = await getProducts();
    for (const product of products) {
      entries.push(
        urlEntry(`${baseUrl}/producto/${product.slug}`, product.updated),
      );
    }
  } catch (err) {
    console.error(
      "[sitemap] no se pudieron obtener productos de PocketBase:",
      err,
    );
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
