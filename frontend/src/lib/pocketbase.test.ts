import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetList = vi.fn();
const mockGetFullList = vi.fn();
const mockGetFirstListItem = vi.fn();

vi.mock("pocketbase", () => ({
  default: class MockPocketBase {
    beforeSend: unknown = undefined;
    collection() {
      return {
        getList: mockGetList,
        getFullList: mockGetFullList,
        getFirstListItem: mockGetFirstListItem,
      };
    }
  },
}));

import {
  sanitizeSlug,
  getFileUrl,
  getWhatsAppUrl,
  getProductWhatsAppUrl,
  getRelatedProducts,
  getProducts,
  getCategories,
} from "./pocketbase";
import type { ProductWithCategory } from "./types";

// ── sanitizeSlug ─────────────────────────────────────────────────────────────

describe("sanitizeSlug", () => {
  it("permite caracteres alfanuméricos, guiones y underscores", () => {
    expect(sanitizeSlug("filamentos-pla_200g")).toBe("filamentos-pla_200g");
  });

  it("elimina caracteres especiales SQL", () => {
    expect(sanitizeSlug("'; DROP TABLE products--")).toBe("DROPTABLEproducts--");
  });

  it("elimina espacios", () => {
    expect(sanitizeSlug("mate con pico")).toBe("mateconpico");
  });

  it("elimina comillas y paréntesis", () => {
    expect(sanitizeSlug("llavero(custom)'\"")).toBe("llaverocustom");
  });

  it("retorna string vacío si el input es vacío", () => {
    expect(sanitizeSlug("")).toBe("");
  });
});

// ── getFileUrl ───────────────────────────────────────────────────────────────

describe("getFileUrl", () => {
  const col = "products_abc123";
  const rec = "rec_xyz789";
  const file = "foto.jpg";
  const origin = `http://localhost:8090/api/files/${col}/${rec}/${file}`;

  it("construye URL sin thumbnail (origen directo, sin pasar por CDN)", () => {
    const url = getFileUrl(col, rec, file);
    expect(url).toBe(origin);
  });

  it("construye URL con thumbnail vía Cloudflare Image Resizing", () => {
    const url = getFileUrl(col, rec, file, "400x400");
    expect(url).toBe(
      `https://printall.jmlabs.app/cdn-cgi/image/format=auto,width=400,height=400,fit=cover,quality=85/${origin}`,
    );
  });

  it("usa el width y height parseados del thumb 'WxH'", () => {
    const url = getFileUrl(col, rec, file, "120x120");
    expect(url).toContain("width=120,height=120");
  });

  it("pide format=auto para que el browser elija WebP/AVIF/PNG", () => {
    expect(getFileUrl(col, rec, file, "800x800")).toContain("format=auto");
  });

  it("hace fallback a ?thumb= cuando el thumb no tiene formato 'WxH'", () => {
    const url = getFileUrl(col, rec, file, "garbage");
    expect(url).toBe(`${origin}?thumb=garbage`);
  });

  it("la URL sin thumb no contiene 'cdn-cgi'", () => {
    expect(getFileUrl(col, rec, file)).not.toContain("cdn-cgi");
  });
});

// ── getWhatsAppUrl ───────────────────────────────────────────────────────────

describe("getWhatsAppUrl", () => {
  it("produce URL con formato wa.me correcto", () => {
    const url = getWhatsAppUrl("5493816563940", "Hola!");
    expect(url).toMatch(/^https:\/\/wa\.me\/5493816563940\?text=/);
  });

  it("codifica el mensaje con encodeURIComponent", () => {
    const msg = "Me interesa el producto 🖨️";
    const url = getWhatsAppUrl("5493816563940", msg);
    expect(url).toContain(encodeURIComponent(msg));
  });

  it("el número va directo sin codificar", () => {
    const url = getWhatsAppUrl("5493816563940", "test");
    expect(url).toContain("5493816563940");
  });
});

// ── getProductWhatsAppUrl ────────────────────────────────────────────────────

const makeProduct = (overrides: Partial<ProductWithCategory> = {}): ProductWithCategory => ({
  id: "prod1",
  name: "Mate con Pico",
  slug: "mate-con-pico",
  category: "cat1",
  description: "",
  price: 3500,
  price_label: "",
  stock_status: "in_stock",
  featured: false,
  attributes: [],
  images: [],
  published: true,
  created: "2025-01-01",
  updated: "2025-01-01",
  expand: { category: { id: "cat1", name: "Mates", slug: "mates", icon: "☕", description: "", order: 1, active: true } },
  ...overrides,
});

describe("getProductWhatsAppUrl", () => {
  it("incluye el nombre del producto en el mensaje", () => {
    const url = getProductWhatsAppUrl(makeProduct({ name: "Mate con Pico" }));
    expect(url).toContain(encodeURIComponent("Mate con Pico"));
  });

  it("incluye la categoría del producto en el mensaje", () => {
    const url = getProductWhatsAppUrl(makeProduct());
    expect(url).toContain(encodeURIComponent("Mates"));
  });

  it("la URL apunta a wa.me", () => {
    const url = getProductWhatsAppUrl(makeProduct());
    expect(url).toMatch(/^https:\/\/wa\.me\//);
  });
});

// ── getRelatedProducts ───────────────────────────────────────────────────────

describe("getRelatedProducts", () => {
  beforeEach(() => {
    mockGetList.mockReset();
  });

  it("retorna [] sin pegar a PB cuando categorySlug es vacío", async () => {
    const result = await getRelatedProducts("", "abc123", 4);
    expect(result).toEqual([]);
    expect(mockGetList).not.toHaveBeenCalled();
  });

  it("retorna [] sin pegar a PB cuando excludeId es vacío", async () => {
    const result = await getRelatedProducts("filamentos", "", 4);
    expect(result).toEqual([]);
    expect(mockGetList).not.toHaveBeenCalled();
  });

  it("construye filter, sort, expand y fields correctos", async () => {
    mockGetList.mockResolvedValue({ items: [] });
    await getRelatedProducts("filamentos", "RECORD123", 5);
    expect(mockGetList).toHaveBeenCalledWith(1, 5, {
      filter:
        'category.slug = "filamentos" && published = true && id != "RECORD123"',
      sort: "-featured,-created",
      expand: "category",
      fields: "*",
    });
  });

  it("usa limit 4 por defecto cuando no se pasa", async () => {
    mockGetList.mockResolvedValue({ items: [] });
    await getRelatedProducts("filamentos", "abc");
    expect(mockGetList).toHaveBeenCalledWith(1, 4, expect.any(Object));
  });

  it("sanitiza el slug (sólo a-zA-Z0-9_-) antes de meterlo al filter", async () => {
    mockGetList.mockResolvedValue({ items: [] });
    await getRelatedProducts("'; DROP TABLE--", "abc", 4);
    const callArgs = mockGetList.mock.calls[0];
    expect(callArgs?.[2]?.filter).toBe(
      'category.slug = "DROPTABLE--" && published = true && id != "abc"',
    );
  });

  it("sanitiza el excludeId (sólo a-zA-Z0-9 — sin guiones)", async () => {
    mockGetList.mockResolvedValue({ items: [] });
    await getRelatedProducts("filamentos", "abc-123_xyz; DROP", 4);
    const callArgs = mockGetList.mock.calls[0];
    expect(callArgs?.[2]?.filter).toBe(
      'category.slug = "filamentos" && published = true && id != "abc123xyzDROP"',
    );
  });

  it("mapea items a ProductWithCategory con images expandidas", async () => {
    mockGetList.mockResolvedValue({
      items: [
        {
          id: "p1",
          name: "Otro filamento",
          slug: "otro-filamento",
          category: "cat1",
          description: "",
          price: 5000,
          price_label: "",
          stock_status: "in_stock",
          featured: false,
          images: ["foto.jpg"],
          published: true,
          created: "2026-01-01",
          updated: "2026-01-01",
          collectionId: "products_xxx",
          expand: {
            category: {
              id: "cat1",
              name: "Filamentos",
              slug: "filamentos",
              icon: "🧵",
              description: "",
              order: 1,
              active: true,
            },
          },
        },
      ],
    });

    const result = await getRelatedProducts("filamentos", "p2", 4);
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("otro-filamento");
    expect(result[0].images).toHaveLength(1);
    expect(result[0].images[0].fileName).toBe("foto.jpg");
    expect(result[0].images[0].thumbnails["400x400"]).toContain(
      "/cdn-cgi/image/",
    );
    expect(result[0].images[0].thumbnails["400x400"]).toContain(
      "width=400,height=400",
    );
    expect(result[0].expand.category.slug).toBe("filamentos");
  });

  it("retorna [] cuando PB tira un error", async () => {
    mockGetList.mockRejectedValue(new Error("PB unreachable"));
    const result = await getRelatedProducts("filamentos", "abc", 4);
    expect(result).toEqual([]);
  });
});

// ── getCategories ────────────────────────────────────────────────────────────

describe("getCategories", () => {
  beforeEach(() => {
    mockGetFullList.mockReset();
  });

  it("filtra por active=true y ordena por field 'order'", async () => {
    mockGetFullList.mockResolvedValue([]);
    await getCategories();
    expect(mockGetFullList).toHaveBeenCalledWith({
      sort: "order",
      filter: "active = true",
    });
  });

  it("mapea raw records a Category[]", async () => {
    mockGetFullList.mockResolvedValue([
      {
        id: "c1",
        name: "Filamentos",
        slug: "filamentos",
        icon: "🧵",
        description: "PLA y otros",
        order: 10,
        active: true,
      },
      {
        id: "c2",
        name: "Mates",
        slug: "mates",
        icon: "🧉",
        description: "",
        order: 20,
        active: true,
      },
    ]);
    const result = await getCategories();
    expect(result).toHaveLength(2);
    expect(result[0].slug).toBe("filamentos");
    expect(result[1].name).toBe("Mates");
  });

  it("propaga errores de PB (sin try/catch)", async () => {
    mockGetFullList.mockRejectedValue(new Error("PB down"));
    await expect(getCategories()).rejects.toThrow("PB down");
  });
});

// ── getProducts ──────────────────────────────────────────────────────────────

describe("getProducts", () => {
  beforeEach(() => {
    mockGetFullList.mockReset();
  });

  it("sin categorySlug usa filter 'published = true' y sort por featured + created", async () => {
    mockGetFullList.mockResolvedValue([]);
    await getProducts();
    expect(mockGetFullList).toHaveBeenCalledWith({
      filter: "published = true",
      sort: "-featured,-created",
      expand: "category",
      fields: "*",
    });
  });

  it("con categorySlug agrega category.slug al filter", async () => {
    mockGetFullList.mockResolvedValue([]);
    await getProducts("filamentos");
    expect(mockGetFullList).toHaveBeenCalledWith({
      filter: 'category.slug = "filamentos" && published = true',
      sort: "-featured,-created",
      expand: "category",
      fields: "*",
    });
  });

  it("sanitiza el categorySlug antes de meterlo al filter", async () => {
    mockGetFullList.mockResolvedValue([]);
    await getProducts("'; DROP TABLE--");
    const callArgs = mockGetFullList.mock.calls[0]?.[0];
    expect(callArgs?.filter).toBe(
      'category.slug = "DROPTABLE--" && published = true',
    );
  });

  it("mapea items a ProductWithCategory con images expandidas", async () => {
    mockGetFullList.mockResolvedValue([
      {
        id: "p1",
        name: "Filamento PLA",
        slug: "filamento-pla",
        category: "cat1",
        description: "",
        price: 5000,
        price_label: "",
        stock_status: "in_stock",
        featured: true,
        images: ["a.jpg", "b.jpg"],
        published: true,
        created: "2026-01-01",
        updated: "2026-01-01",
        collectionId: "products_xxx",
        expand: {
          category: {
            id: "cat1",
            name: "Filamentos",
            slug: "filamentos",
            icon: "🧵",
            description: "",
            order: 1,
            active: true,
          },
        },
      },
    ]);
    const result = await getProducts();
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("filamento-pla");
    expect(result[0].images).toHaveLength(2);
    expect(result[0].images[0].thumbnails["400x400"]).toContain(
      "/cdn-cgi/image/",
    );
    expect(result[0].images[0].thumbnails["400x400"]).toContain(
      "width=400,height=400",
    );
    expect(result[0].expand.category.slug).toBe("filamentos");
  });

  it("propaga errores de PB (sin try/catch)", async () => {
    mockGetFullList.mockRejectedValue(new Error("PB down"));
    await expect(getProducts()).rejects.toThrow("PB down");
  });
});
