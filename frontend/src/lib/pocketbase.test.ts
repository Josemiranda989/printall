import { describe, it, expect } from "vitest";
import {
  sanitizeSlug,
  getFileUrl,
  getWhatsAppUrl,
  getProductWhatsAppUrl,
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

  it("construye URL sin thumbnail", () => {
    const url = getFileUrl(col, rec, file);
    expect(url).toBe(
      `http://localhost:8090/api/files/${col}/${rec}/${file}`
    );
  });

  it("construye URL con thumbnail", () => {
    const url = getFileUrl(col, rec, file, "400x400");
    expect(url).toBe(
      `http://localhost:8090/api/files/${col}/${rec}/${file}?thumb=400x400`
    );
  });

  it("la URL sin thumb no contiene 'thumb_'", () => {
    expect(getFileUrl(col, rec, file)).not.toContain("thumb_");
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
  attributes: null,
  whatsapp_message: "",
  images: [],
  active: true,
  created: "2025-01-01",
  updated: "2025-01-01",
  expand: { category: { id: "cat1", name: "Mates", slug: "mates", icon: "☕", description: "", order: 1, active: true } },
  ...overrides,
});

describe("getProductWhatsAppUrl", () => {
  it("usa whatsapp_message personalizado si está definido", () => {
    const product = makeProduct({ whatsapp_message: "Quiero este!" });
    const url = getProductWhatsAppUrl(product);
    expect(url).toContain(encodeURIComponent("Quiero este!"));
  });

  it("usa mensaje por defecto con nombre del producto si no hay mensaje", () => {
    const product = makeProduct({ whatsapp_message: "" });
    const url = getProductWhatsAppUrl(product);
    expect(url).toContain(encodeURIComponent("Mate con Pico"));
  });

  it("la URL apunta a wa.me", () => {
    const url = getProductWhatsAppUrl(makeProduct());
    expect(url).toMatch(/^https:\/\/wa\.me\//);
  });
});
