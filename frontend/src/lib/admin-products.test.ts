import { describe, expect, it } from "vitest";
import {
  extractProductFromForm,
  extractImagesFromForm,
  IMAGES_MAX_COUNT,
} from "./admin-products";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe("extractProductFromForm", () => {
  it("extrae todos los campos válidos", () => {
    const form = fd({
      name: "Mate con Pico",
      slug: "mate-con-pico",
      category: "cat_001",
      description: "Mate impreso en 3D",
      price: "12500",
      price_label: "$12.500",
      stock_status: "in_stock",
      featured: "on",
      published: "on",
    });

    const { data, errors } = extractProductFromForm(form);

    expect(errors).toEqual({});
    expect(data).toEqual({
      name: "Mate con Pico",
      slug: "mate-con-pico",
      category: "cat_001",
      description: "Mate impreso en 3D",
      price: 12500,
      price_label: "$12.500",
      stock_status: "in_stock",
      featured: true,
      published: true,
    });
  });

  it("genera slug automáticamente si no se provee", () => {
    const form = fd({
      name: "Vaso Térmico",
      category: "cat_001",
      stock_status: "in_stock",
    });

    const { data, errors } = extractProductFromForm(form);
    expect(errors).toEqual({});
    expect(data.slug).toBe("vaso-termico");
  });

  it("usa el slug provisto aunque haya nombre", () => {
    const form = fd({
      name: "Vaso Térmico",
      slug: "mi-slug-custom",
      category: "cat_001",
      stock_status: "in_stock",
    });

    const { data } = extractProductFromForm(form);
    expect(data.slug).toBe("mi-slug-custom");
  });

  it("trata featured y published ausentes como false (checkbox no marcado)", () => {
    const form = fd({
      name: "Producto",
      category: "cat_001",
      stock_status: "in_stock",
    });

    const { data } = extractProductFromForm(form);
    expect(data.featured).toBe(false);
    expect(data.published).toBe(false);
  });

  it("falla si name está vacío", () => {
    const form = fd({
      name: "",
      category: "cat_001",
      stock_status: "in_stock",
    });

    const { errors } = extractProductFromForm(form);
    expect(errors.name).toBeDefined();
  });

  it("falla si category está vacío", () => {
    const form = fd({
      name: "Producto",
      category: "",
      stock_status: "in_stock",
    });

    const { errors } = extractProductFromForm(form);
    expect(errors.category).toBeDefined();
  });

  it("falla si stock_status no es un valor válido del enum", () => {
    const form = fd({
      name: "Producto",
      category: "cat_001",
      stock_status: "wat",
    });

    const { errors } = extractProductFromForm(form);
    expect(errors.stock_status).toBeDefined();
  });

  it("price vacío se convierte a 0", () => {
    const form = fd({
      name: "Producto",
      category: "cat_001",
      stock_status: "in_stock",
      price: "",
    });

    const { data, errors } = extractProductFromForm(form);
    expect(errors).toEqual({});
    expect(data.price).toBe(0);
  });

  it("price negativo es inválido", () => {
    const form = fd({
      name: "Producto",
      category: "cat_001",
      stock_status: "in_stock",
      price: "-100",
    });

    const { errors } = extractProductFromForm(form);
    expect(errors.price).toBeDefined();
  });

  it("price no numérico es inválido", () => {
    const form = fd({
      name: "Producto",
      category: "cat_001",
      stock_status: "in_stock",
      price: "abc",
    });

    const { errors } = extractProductFromForm(form);
    expect(errors.price).toBeDefined();
  });

  it("trim del name y description", () => {
    const form = fd({
      name: "  Producto  ",
      description: "  desc  ",
      category: "cat_001",
      stock_status: "in_stock",
    });

    const { data } = extractProductFromForm(form);
    expect(data.name).toBe("Producto");
    expect(data.description).toBe("desc");
  });
});

// Helper para crear File-like objects en entorno node (vitest env: node)
// File no existe en Node.js < 20 sin polyfill; usamos Blob con las propiedades
// que extractImagesFromForm necesita: name, size, type
function makeFile(name: string, sizeBytes: number, type: string): File {
  // Node 20+ tiene File global — vitest lo expone cuando corre en node
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type });
}

function makeFormWithFiles(files: File[]): FormData {
  const form = new FormData();
  for (const f of files) form.append("images", f);
  return form;
}

describe("extractImagesFromForm", () => {
  it("sin archivos → ok: true, files: []", () => {
    const form = new FormData();
    const result = extractImagesFromForm(form);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.files).toEqual([]);
  });

  it("un archivo jpeg válido dentro del tamaño → ok: true", () => {
    const file = makeFile("foto.jpg", 1024 * 100, "image/jpeg"); // 100KB
    const form = makeFormWithFiles([file]);
    const result = extractImagesFromForm(form);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.files).toHaveLength(1);
      expect(result.files[0].name).toBe("foto.jpg");
    }
  });

  it("un archivo png válido → ok: true", () => {
    const file = makeFile("imagen.png", 1024 * 500, "image/png"); // 500KB
    const result = extractImagesFromForm(makeFormWithFiles([file]));
    expect(result.ok).toBe(true);
  });

  it("un archivo webp válido → ok: true", () => {
    const file = makeFile("foto.webp", 1024 * 200, "image/webp");
    const result = extractImagesFromForm(makeFormWithFiles([file]));
    expect(result.ok).toBe(true);
  });

  it("múltiples archivos válidos (hasta 8) → ok: true con orden preservado", () => {
    const files = [
      makeFile("a.jpg", 100, "image/jpeg"),
      makeFile("b.png", 200, "image/png"),
      makeFile("c.webp", 300, "image/webp"),
    ];
    const result = extractImagesFromForm(makeFormWithFiles(files));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.files).toHaveLength(3);
      expect(result.files[0].name).toBe("a.jpg");
      expect(result.files[1].name).toBe("b.png");
      expect(result.files[2].name).toBe("c.webp");
    }
  });

  it("exactamente IMAGES_MAX_COUNT archivos → ok: true", () => {
    const files = Array.from({ length: IMAGES_MAX_COUNT }, (_, i) =>
      makeFile(`img${i}.jpg`, 100, "image/jpeg")
    );
    const result = extractImagesFromForm(makeFormWithFiles(files));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.files).toHaveLength(IMAGES_MAX_COUNT);
  });

  it("más de IMAGES_MAX_COUNT archivos → ok: false con error de cantidad", () => {
    const files = Array.from({ length: IMAGES_MAX_COUNT + 1 }, (_, i) =>
      makeFile(`img${i}.jpg`, 100, "image/jpeg")
    );
    const result = extractImagesFromForm(makeFormWithFiles(files));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toMatch(new RegExp(String(IMAGES_MAX_COUNT)));
    }
  });

  it("archivo > 5MB → ok: false con error de tamaño", () => {
    const MB5plus = 5 * 1024 * 1024 + 1;
    const file = makeFile("grande.jpg", MB5plus, "image/jpeg");
    const result = extractImagesFromForm(makeFormWithFiles([file]));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("grande.jpg"))).toBe(true);
      expect(result.errors.some((e) => e.includes("5MB"))).toBe(true);
    }
  });

  it("archivo exactamente 5MB → ok: true (límite inclusive)", () => {
    const MB5 = 5 * 1024 * 1024;
    const file = makeFile("justo.jpg", MB5, "image/jpeg");
    const result = extractImagesFromForm(makeFormWithFiles([file]));
    expect(result.ok).toBe(true);
  });

  it("MIME no permitido (image/gif) → ok: false", () => {
    const file = makeFile("animado.gif", 100, "image/gif");
    const result = extractImagesFromForm(makeFormWithFiles([file]));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("animado.gif"))).toBe(true);
    }
  });

  it("MIME no permitido (application/pdf) → ok: false", () => {
    const file = makeFile("doc.pdf", 100, "application/pdf");
    const result = extractImagesFromForm(makeFormWithFiles([file]));
    expect(result.ok).toBe(false);
  });

  it("File con size === 0 y name vacío (input vacío del browser) → skipped, ok: true, files: []", () => {
    // Cuando <input type="file"> está vacío, el browser envía una File con size=0 y name=""
    const emptyFile = makeFile("", 0, "application/octet-stream");
    const form = makeFormWithFiles([emptyFile]);
    const result = extractImagesFromForm(form);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.files).toHaveLength(0);
  });

  it("mix: archivo válido + archivo > 5MB → ok: false, error solo para el inválido", () => {
    const valid = makeFile("ok.jpg", 100, "image/jpeg");
    const tooBig = makeFile("enorme.jpg", 5 * 1024 * 1024 + 1, "image/jpeg");
    const result = extractImagesFromForm(makeFormWithFiles([valid, tooBig]));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("enorme.jpg"))).toBe(true);
      expect(result.errors.some((e) => e.includes("ok.jpg"))).toBe(false);
    }
  });

  it("múltiples errores se acumulan (MIME inválido + > 5MB)", () => {
    const badMime = makeFile("foto.gif", 100, "image/gif");
    const tooBig = makeFile("pesado.jpg", 5 * 1024 * 1024 + 1, "image/jpeg");
    const result = extractImagesFromForm(makeFormWithFiles([badMime, tooBig]));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    }
  });
});
