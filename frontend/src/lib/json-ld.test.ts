import { describe, it, expect } from "vitest";
import { buildProductJsonLd } from "./json-ld";
import type { Product, Category } from "./types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod_abc123",
    name: "Soporte de escritorio",
    slug: "soporte-de-escritorio",
    category: "cat_001",
    description: "<p>Soporte premium para escritorio.</p>",
    price: 15000,
    price_label: "",
    stock_status: "in_stock",
    featured: false,
    attributes: [],
    images: [
      {
        id: "img_1",
        collectionId: "col_1",
        fileName: "img.jpg",
        thumbnails: {
          "120x120": "https://cdn.example.com/img_120.jpg",
          "400x400": "https://cdn.example.com/img_400.jpg",
          "800x800": "https://cdn.example.com/img_800.jpg",
        },
        url: "https://cdn.example.com/img_full.jpg",
      },
    ],
    published: true,
    created: "2024-01-01T00:00:00Z",
    updated: "2024-01-02T00:00:00Z",
    ...overrides,
  };
}

const BASE_URL = "https://printall.jmlabs.app";
const BASE_URL_TRAILING = "https://printall.jmlabs.app/";

// ── Suite principal ───────────────────────────────────────────────────────────

describe("buildProductJsonLd", () => {
  // ── Estructura base ───────────────────────────────────────────────────────

  it("devuelve @context y @type correctos", () => {
    const result = buildProductJsonLd(makeProduct(), BASE_URL);
    expect(result["@context"]).toBe("https://schema.org");
    expect(result["@type"]).toBe("Product");
  });

  it("mapea name correctamente", () => {
    const result = buildProductJsonLd(makeProduct(), BASE_URL);
    expect(result.name).toBe("Soporte de escritorio");
  });

  it("stripea HTML de description y colapsa whitespace múltiple", () => {
    const p = makeProduct({ description: "<p><strong>Hola</strong> mundo <br/> test.</p>" });
    const result = buildProductJsonLd(p, BASE_URL);
    expect(result.description).toBe("Hola mundo test.");
  });

  it("trunca description a 5000 chars", () => {
    const longText = "a".repeat(6000);
    const p = makeProduct({ description: longText });
    const result = buildProductJsonLd(p, BASE_URL);
    expect(result.description.length).toBe(5000);
  });

  it("description vacía queda como string vacío", () => {
    const p = makeProduct({ description: "" });
    const result = buildProductJsonLd(p, BASE_URL);
    expect(result.description).toBe("");
  });

  it("description undefined queda como string vacío", () => {
    const p = makeProduct({ description: undefined as unknown as string });
    const result = buildProductJsonLd(p, BASE_URL);
    expect(result.description).toBe("");
  });

  it("usa sku = product.id", () => {
    const result = buildProductJsonLd(makeProduct(), BASE_URL);
    expect(result.sku).toBe("prod_abc123");
  });

  it("brand es Print All", () => {
    const result = buildProductJsonLd(makeProduct(), BASE_URL);
    expect(result.brand).toEqual({ "@type": "Brand", name: "Print All" });
  });

  // ── Imágenes ──────────────────────────────────────────────────────────────

  it("producto con imágenes → image es array de URLs absolutas", () => {
    const result = buildProductJsonLd(makeProduct(), BASE_URL);
    expect(result.image).toEqual(["https://cdn.example.com/img_full.jpg"]);
  });

  it("imagen URL ya absoluta → no genera doble protocolo", () => {
    const result = buildProductJsonLd(makeProduct(), BASE_URL);
    expect(result.image?.[0]).toMatch(/^https:\/\//);
    expect(result.image?.[0]).not.toMatch(/^https:\/\/https:\/\//);
  });

  it("producto sin imágenes → image field ausente (no array vacío)", () => {
    const p = makeProduct({ images: [] });
    const result = buildProductJsonLd(p, BASE_URL);
    expect(result.image).toBeUndefined();
  });

  it("baseUrl con trailing slash → no doble slash en image URL relativa", () => {
    const p = makeProduct({
      images: [
        {
          id: "i1",
          collectionId: "c1",
          fileName: "x.jpg",
          thumbnails: { "120x120": "", "400x400": "", "800x800": "" },
          url: "/files/x.jpg",
        },
      ],
    });
    const result = buildProductJsonLd(p, BASE_URL_TRAILING);
    // No debe aparecer doble slash entre baseUrl y el path
    expect(result.image?.[0]).not.toContain("//files");
    expect(result.image?.[0]).toBe("https://printall.jmlabs.app/files/x.jpg");
  });

  // ── Offers ────────────────────────────────────────────────────────────────

  it("producto con price > 0 → offers presente con price como string", () => {
    const result = buildProductJsonLd(makeProduct({ price: 15000 }), BASE_URL);
    expect(result.offers).toBeDefined();
    expect(result.offers?.price).toBe("15000");
    expect(result.offers?.priceCurrency).toBe("ARS");
  });

  it("producto con price === 0 → offers ausente", () => {
    const result = buildProductJsonLd(makeProduct({ price: 0 }), BASE_URL);
    expect(result.offers).toBeUndefined();
  });

  it("offers.url contiene baseUrl + /producto/ + slug", () => {
    const result = buildProductJsonLd(makeProduct(), BASE_URL);
    expect(result.offers?.url).toBe(
      "https://printall.jmlabs.app/producto/soporte-de-escritorio"
    );
  });

  it("offers.seller es Print All Organization", () => {
    const result = buildProductJsonLd(makeProduct(), BASE_URL);
    expect(result.offers?.seller).toEqual({
      "@type": "Organization",
      name: "Print All",
    });
  });

  it("offers.@type es Offer", () => {
    const result = buildProductJsonLd(makeProduct(), BASE_URL);
    expect(result.offers?.["@type"]).toBe("Offer");
  });

  // ── Availability mapping ──────────────────────────────────────────────────

  it("in_stock → InStock", () => {
    const result = buildProductJsonLd(makeProduct({ stock_status: "in_stock" }), BASE_URL);
    expect(result.offers?.availability).toBe("https://schema.org/InStock");
  });

  it("low_stock → LimitedAvailability", () => {
    const result = buildProductJsonLd(makeProduct({ stock_status: "low_stock" }), BASE_URL);
    expect(result.offers?.availability).toBe("https://schema.org/LimitedAvailability");
  });

  it("out_of_stock → OutOfStock", () => {
    const result = buildProductJsonLd(makeProduct({ stock_status: "out_of_stock" }), BASE_URL);
    expect(result.offers?.availability).toBe("https://schema.org/OutOfStock");
  });

  it("made_to_order → PreOrder", () => {
    const result = buildProductJsonLd(makeProduct({ stock_status: "made_to_order" }), BASE_URL);
    expect(result.offers?.availability).toBe("https://schema.org/PreOrder");
  });

  // ── Category ─────────────────────────────────────────────────────────────

  it("expand.category presente → field category con el name", () => {
    const expand = { category: { id: "c1", name: "Soportes", slug: "soportes", icon: "🖥️", description: "", order: 1, active: true } as Category };
    const result = buildProductJsonLd({ ...makeProduct(), expand }, BASE_URL);
    expect(result.category).toBe("Soportes");
  });

  it("expand.category ausente → field category omitido", () => {
    const result = buildProductJsonLd(makeProduct(), BASE_URL);
    expect(result.category).toBeUndefined();
  });

  it("expand undefined → field category omitido", () => {
    const p = { ...makeProduct(), expand: undefined };
    const result = buildProductJsonLd(p, BASE_URL);
    expect(result.category).toBeUndefined();
  });

  // ── baseUrl edge cases ────────────────────────────────────────────────────

  it("baseUrl sin trailing slash → offers.url correcto", () => {
    const result = buildProductJsonLd(makeProduct(), BASE_URL);
    expect(result.offers?.url).toBe(
      "https://printall.jmlabs.app/producto/soporte-de-escritorio"
    );
  });

  it("baseUrl con trailing slash → offers.url sin doble slash", () => {
    const result = buildProductJsonLd(makeProduct(), BASE_URL_TRAILING);
    expect(result.offers?.url).toBe(
      "https://printall.jmlabs.app/producto/soporte-de-escritorio"
    );
  });

  // ── Múltiples imágenes ────────────────────────────────────────────────────

  it("múltiples imágenes → image array con todas las URLs", () => {
    const p = makeProduct({
      images: [
        {
          id: "i1",
          collectionId: "c1",
          fileName: "a.jpg",
          thumbnails: { "120x120": "", "400x400": "", "800x800": "" },
          url: "https://cdn.example.com/a_full.jpg",
        },
        {
          id: "i2",
          collectionId: "c1",
          fileName: "b.jpg",
          thumbnails: { "120x120": "", "400x400": "", "800x800": "" },
          url: "https://cdn.example.com/b_full.jpg",
        },
      ],
    });
    const result = buildProductJsonLd(p, BASE_URL);
    expect(result.image).toHaveLength(2);
    expect(result.image).toContain("https://cdn.example.com/a_full.jpg");
    expect(result.image).toContain("https://cdn.example.com/b_full.jpg");
  });
});

describe("buildProductJsonLd — HTML entities decoding", () => {
  it("decodifica named entities comunes en español", () => {
    const p = makeProduct({
      description: "Impresi&oacute;n 3D de alta precisi&oacute;n. Tama&ntilde;o &iacute;deal.",
    });
    const result = buildProductJsonLd(p, BASE_URL);
    expect(result.description).toBe("Impresión 3D de alta precisión. Tamaño ídeal.");
  });

  it("decodifica entities estructurales (&amp; &lt; &gt; &quot;)", () => {
    const p = makeProduct({
      description: "<p>A &amp; B, x &lt; y, &quot;cita&quot;</p>",
    });
    const result = buildProductJsonLd(p, BASE_URL);
    expect(result.description).toBe('A & B, x < y, "cita"');
  });

  it("decodifica numeric entities decimales (&#xxx;)", () => {
    const p = makeProduct({
      description: "Grados: 30&#176;C. Plus: &#177;0.03 mm.",
    });
    const result = buildProductJsonLd(p, BASE_URL);
    expect(result.description).toBe("Grados: 30°C. Plus: ±0.03 mm.");
  });

  it("decodifica numeric entities hexadecimales (&#xXX;)", () => {
    const p = makeProduct({
      description: "Quote: &#x201C;hola&#x201D;",
    });
    const result = buildProductJsonLd(p, BASE_URL);
    // &#x201C; y &#x201D; son las smart quotes “ y ”
    expect(result.description).toBe("Quote: “hola”");
  });

  it("entities desconocidas se mantienen literales", () => {
    const p = makeProduct({
      description: "Custom &foobar; quedan",
    });
    const result = buildProductJsonLd(p, BASE_URL);
    expect(result.description).toBe("Custom &foobar; quedan");
  });

  it("colapsa whitespace múltiple a uno solo", () => {
    const p = makeProduct({
      description: "<p>Línea 1</p>\n\n<p>Línea 2</p>",
    });
    const result = buildProductJsonLd(p, BASE_URL);
    expect(result.description).toBe("Línea 1 Línea 2");
  });

  it("combina strip HTML + decode entities + collapse whitespace", () => {
    const p = makeProduct({
      description: "<p>Adhesivo de cianoacrilato.\r\n\r\nTemperatura: 190&deg;C - 220&deg;C.\r\n\r\nTolerancia: &plusmn;0.03 mm.</p>",
    });
    const result = buildProductJsonLd(p, BASE_URL);
    expect(result.description).toBe("Adhesivo de cianoacrilato. Temperatura: 190°C - 220°C. Tolerancia: ±0.03 mm.");
  });

  it("description con solo entities y sin texto real → string decodificado", () => {
    const p = makeProduct({
      description: "&iexcl;Hola! &iquest;C&oacute;mo est&aacute;s?",
    });
    const result = buildProductJsonLd(p, BASE_URL);
    expect(result.description).toBe("¡Hola! ¿Cómo estás?");
  });
});
