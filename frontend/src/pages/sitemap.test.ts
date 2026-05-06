import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProductWithCategory } from "../lib/types";

vi.mock("../lib/pocketbase", () => ({
  getProducts: vi.fn(),
}));

import { GET } from "./sitemap.xml";
import { getProducts } from "../lib/pocketbase";

const mockGetProducts = vi.mocked(getProducts);
const SITE = new URL("https://printall.jmlabs.app/");

function makeProduct(
  overrides: Partial<ProductWithCategory> = {},
): ProductWithCategory {
  return {
    id: "p1",
    name: "Producto",
    slug: "producto",
    category: "cat1",
    description: "",
    price: 0,
    price_label: "",
    stock_status: "in_stock",
    featured: false,
    attributes: null,
    images: [],
    active: true,
    created: "2026-01-01 00:00:00.000Z",
    updated: "2026-05-06 02:09:43.736Z",
    expand: {
      category: {
        id: "cat1",
        name: "Cat",
        slug: "cat",
        icon: "",
        description: "",
        order: 1,
        active: true,
      },
    },
    ...overrides,
  };
}

// Cast a APIContext lo que necesitamos: site + el resto opcional.
const ctx = (site: URL | undefined) =>
  ({ site }) as unknown as Parameters<typeof GET>[0];

describe("GET /sitemap.xml", () => {
  beforeEach(() => {
    mockGetProducts.mockReset();
  });

  it("lanza si Astro.site no está configurado", async () => {
    mockGetProducts.mockResolvedValue([]);
    await expect(GET(ctx(undefined))).rejects.toThrow(/site/i);
  });

  it("devuelve 200 con Content-Type application/xml y Cache-Control de 1h", async () => {
    mockGetProducts.mockResolvedValue([]);
    const res = await GET(ctx(SITE));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/xml; charset=utf-8",
    );
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
  });

  it("siempre incluye las URLs estáticas (home y /contacto)", async () => {
    mockGetProducts.mockResolvedValue([]);
    const xml = await (await GET(ctx(SITE))).text();
    expect(xml).toContain("<loc>https://printall.jmlabs.app/</loc>");
    expect(xml).toContain("<loc>https://printall.jmlabs.app/contacto</loc>");
  });

  it("agrega un <url> por producto activo, apuntando a /producto/{slug}", async () => {
    mockGetProducts.mockResolvedValue([
      makeProduct({ slug: "uno", updated: "2026-05-06 02:09:43.736Z" }),
      makeProduct({ slug: "dos", updated: "2026-05-06 02:10:00.000Z" }),
    ]);
    const xml = await (await GET(ctx(SITE))).text();
    expect(xml).toContain(
      "<loc>https://printall.jmlabs.app/producto/uno</loc>",
    );
    expect(xml).toContain(
      "<loc>https://printall.jmlabs.app/producto/dos</loc>",
    );
  });

  it("convierte el `updated` de PB (espacio) a ISO 8601 estricto (con T)", async () => {
    mockGetProducts.mockResolvedValue([
      makeProduct({ slug: "uno", updated: "2026-05-06 02:09:43.736Z" }),
    ]);
    const xml = await (await GET(ctx(SITE))).text();
    expect(xml).toContain("<lastmod>2026-05-06T02:09:43.736Z</lastmod>");
    expect(xml).not.toContain("<lastmod>2026-05-06 02:09:43.736Z</lastmod>");
  });

  it("XML es well-formed (un solo <urlset> root con namespace correcto)", async () => {
    mockGetProducts.mockResolvedValue([
      makeProduct({ slug: "uno" }),
    ]);
    const xml = await (await GET(ctx(SITE))).text();
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(xml).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    );
    expect((xml.match(/<urlset/g) ?? []).length).toBe(1);
    expect((xml.match(/<\/urlset>/g) ?? []).length).toBe(1);
  });

  it("si getProducts tira error, devuelve 200 con solo URLs estáticas", async () => {
    mockGetProducts.mockRejectedValue(new Error("PB unreachable"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(ctx(SITE));
    const xml = await res.text();
    expect(res.status).toBe(200);
    expect(xml).toContain("<loc>https://printall.jmlabs.app/</loc>");
    expect(xml).toContain("<loc>https://printall.jmlabs.app/contacto</loc>");
    expect(xml).not.toContain("/producto/");
    consoleSpy.mockRestore();
  });

  it("respeta site sin trailing slash y site con trailing slash (no duplica //)", async () => {
    mockGetProducts.mockResolvedValue([makeProduct({ slug: "x" })]);
    const xmlA = await (await GET(ctx(SITE))).text();
    const xmlB = await (
      await GET(ctx(new URL("https://printall.jmlabs.app")))
    ).text();
    expect(xmlA).not.toContain("//producto");
    expect(xmlB).not.toContain("//producto");
    expect(xmlA).toContain("https://printall.jmlabs.app/producto/x");
    expect(xmlB).toContain("https://printall.jmlabs.app/producto/x");
  });
});
