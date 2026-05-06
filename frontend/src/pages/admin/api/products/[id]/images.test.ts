import { describe, expect, test } from "vitest";
import {
  createMockPB,
  createApiContext,
  formDataRequest,
  jsonRequest,
} from "../../../../../test-utils/admin-api-mocks";
import { IMAGES_MAX_COUNT } from "../../../../../lib/admin-products";
import { POST, PATCH, DELETE } from "./images";

// ─── Helpers locales ───────────────────────────────────────────────────────────

function makeFile(name = "photo.jpg", sizeBytes = 1024, type = "image/jpeg"): File {
  const buf = new Uint8Array(sizeBytes);
  return new File([buf], name, { type });
}

function productRecord(images: string[] = []): { id: string; collectionId: string; images: string[] } {
  return { id: "prod1", collectionId: "col1", images };
}

// ─── POST ─────────────────────────────────────────────────────────────────────

describe("POST /admin/api/products/[id]/images", () => {
  test("sube 1 archivo válido → 200, ok: true, added y images correctos", async () => {
    const pb = createMockPB();
    pb._getCollection("products").getOne.mockResolvedValue(productRecord(["existing.jpg"]));
    pb._getCollection("products").update.mockResolvedValue(productRecord(["existing.jpg", "new.jpg"]));

    const ctx = createApiContext({
      params: { id: "prod1" },
      request: formDataRequest("http://test/api", "POST", {
        images: makeFile("new.jpg"),
      }),
      locals: { adminPB: pb },
    });

    const res = await POST(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.added).toEqual(["new.jpg"]);
    expect(body.images).toEqual(["existing.jpg", "new.jpg"]);
  });

  test("el FormData enviado a pb.update contiene key 'images+'", async () => {
    const pb = createMockPB();
    pb._getCollection("products").getOne.mockResolvedValue(productRecord([]));
    pb._getCollection("products").update.mockResolvedValue(productRecord(["new.jpg"]));

    const ctx = createApiContext({
      params: { id: "prod1" },
      request: formDataRequest("http://test/api", "POST", {
        images: makeFile("new.jpg"),
      }),
      locals: { adminPB: pb },
    });

    await POST(ctx);

    const updateArg = pb._getCollection("products").update.mock.calls[0][1];
    expect(updateArg).toBeInstanceOf(FormData);
    expect([...(updateArg as FormData).keys()]).toContain("images+");
  });

  test("sin auth (adminPB null) → 401 JSON", async () => {
    const ctx = createApiContext({
      params: { id: "prod1" },
      request: formDataRequest("http://test/api", "POST", {
        images: makeFile(),
      }),
      locals: { adminPB: null },
    });

    const res = await POST(ctx);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  test("params.id vacío → 400", async () => {
    const pb = createMockPB();
    const ctx = createApiContext({
      params: { id: "" },
      request: formDataRequest("http://test/api", "POST", {
        images: makeFile(),
      }),
      locals: { adminPB: pb },
    });

    const res = await POST(ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  test("params.id undefined → 400", async () => {
    const pb = createMockPB();
    const ctx = createApiContext({
      params: {},
      request: formDataRequest("http://test/api", "POST", {
        images: makeFile(),
      }),
      locals: { adminPB: pb },
    });

    const res = await POST(ctx);
    expect(res.status).toBe(400);
  });

  test("request body no es FormData (JSON con Content-Type incorrecto) → 400", async () => {
    const pb = createMockPB();
    // Astro/fetch API: pasar un body que no es parseable como FormData
    // Simulamos que request.formData() lanza
    const req = new Request("http://test/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: "not-a-file" }),
    });

    const ctx = createApiContext({
      params: { id: "prod1" },
      request: req,
      locals: { adminPB: pb },
    });

    const res = await POST(ctx);
    // Puede ser 400 (form parse error) o 422 (sin archivos válidos) — ambos son error del cliente
    expect([400, 422]).toContain(res.status);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  test("archivo > 5MB → 422 con errors array", async () => {
    const pb = createMockPB();
    const bigFile = makeFile("big.jpg", 6 * 1024 * 1024, "image/jpeg"); // 6MB

    const ctx = createApiContext({
      params: { id: "prod1" },
      request: formDataRequest("http://test/api", "POST", {
        images: bigFile,
      }),
      locals: { adminPB: pb },
    });

    const res = await POST(ctx);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(Array.isArray(body.errors)).toBe(true);
  });

  test("sin archivos en el FormData (campo vacío) → 422", async () => {
    const pb = createMockPB();
    // Enviar FormData sin nada en el campo images
    const ctx = createApiContext({
      params: { id: "prod1" },
      request: formDataRequest("http://test/api", "POST", {}),
      locals: { adminPB: pb },
    });

    const res = await POST(ctx);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  test("producto no existe (getOne rechaza) → 404", async () => {
    const pb = createMockPB();
    pb._getCollection("products").getOne.mockRejectedValue(new Error("not found"));

    const ctx = createApiContext({
      params: { id: "nonexistent" },
      request: formDataRequest("http://test/api", "POST", {
        images: makeFile(),
      }),
      locals: { adminPB: pb },
    });

    const res = await POST(ctx);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  test(`existing ${IMAGES_MAX_COUNT - 1} + nuevos 2 → supera límite → 422`, async () => {
    const pb = createMockPB();
    const existing = Array.from({ length: IMAGES_MAX_COUNT - 1 }, (_, i) => `img${i}.jpg`);
    pb._getCollection("products").getOne.mockResolvedValue(productRecord(existing));

    const ctx = createApiContext({
      params: { id: "prod1" },
      request: formDataRequest("http://test/api", "POST", {
        images: [makeFile("a.jpg"), makeFile("b.jpg")],
      }),
      locals: { adminPB: pb },
    });

    const res = await POST(ctx);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(Array.isArray(body.errors)).toBe(true);
  });

  test("pb.update tira error → 500", async () => {
    const pb = createMockPB();
    pb._getCollection("products").getOne.mockResolvedValue(productRecord([]));
    pb._getCollection("products").update.mockRejectedValue(new Error("PB internal error"));

    const ctx = createApiContext({
      params: { id: "prod1" },
      request: formDataRequest("http://test/api", "POST", {
        images: makeFile(),
      }),
      locals: { adminPB: pb },
    });

    const res = await POST(ctx);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  test("existing 0 + nuevos 3 → 200, los 3 quedan en added", async () => {
    const pb = createMockPB();
    pb._getCollection("products").getOne.mockResolvedValue(productRecord([]));
    pb._getCollection("products").update.mockResolvedValue(
      productRecord(["a.jpg", "b.jpg", "c.jpg"]),
    );

    const ctx = createApiContext({
      params: { id: "prod1" },
      request: formDataRequest("http://test/api", "POST", {
        images: [makeFile("a.jpg"), makeFile("b.jpg"), makeFile("c.jpg")],
      }),
      locals: { adminPB: pb },
    });

    const res = await POST(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.added).toHaveLength(3);
    expect(body.added).toEqual(expect.arrayContaining(["a.jpg", "b.jpg", "c.jpg"]));
  });
});

// ─── PATCH ────────────────────────────────────────────────────────────────────

describe("PATCH /admin/api/products/[id]/images", () => {
  test("order válido (mismos IDs) → 200, hace pb.update con images: order", async () => {
    const pb = createMockPB();
    const order = ["b.jpg", "a.jpg"];
    pb._getCollection("products").getOne.mockResolvedValue(productRecord(["a.jpg", "b.jpg"]));
    pb._getCollection("products").update.mockResolvedValue(productRecord(order));

    const ctx = createApiContext({
      params: { id: "prod1" },
      request: jsonRequest("http://test/api", "PATCH", { order }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    const updateCall = pb._getCollection("products").update.mock.calls[0];
    expect(updateCall[0]).toBe("prod1");
    expect(updateCall[1]).toEqual({ images: order });
  });

  test("sin auth → 401", async () => {
    const ctx = createApiContext({
      params: { id: "prod1" },
      request: jsonRequest("http://test/api", "PATCH", { order: ["a.jpg"] }),
      locals: { adminPB: null },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(401);
  });

  test("params.id vacío → 400", async () => {
    const pb = createMockPB();
    const ctx = createApiContext({
      params: { id: "" },
      request: jsonRequest("http://test/api", "PATCH", { order: [] }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(400);
  });

  test("JSON inválido → 400", async () => {
    const pb = createMockPB();
    const req = new Request("http://test/api", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{ invalid json {{",
    });

    const ctx = createApiContext({
      params: { id: "prod1" },
      request: req,
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(400);
  });

  test("order no es array → 400", async () => {
    const pb = createMockPB();
    const ctx = createApiContext({
      params: { id: "prod1" },
      request: jsonRequest("http://test/api", "PATCH", { order: "not-an-array" }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(400);
  });

  test("order tiene filename que no está en current → 400", async () => {
    const pb = createMockPB();
    pb._getCollection("products").getOne.mockResolvedValue(productRecord(["a.jpg", "b.jpg"]));

    const ctx = createApiContext({
      params: { id: "prod1" },
      request: jsonRequest("http://test/api", "PATCH", { order: ["a.jpg", "UNKNOWN.jpg"] }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  test("producto no existe → 404", async () => {
    const pb = createMockPB();
    pb._getCollection("products").getOne.mockRejectedValue(new Error("not found"));

    const ctx = createApiContext({
      params: { id: "nonexistent" },
      request: jsonRequest("http://test/api", "PATCH", { order: ["a.jpg"] }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(404);
  });

  test("pb.update tira error → 500", async () => {
    const pb = createMockPB();
    pb._getCollection("products").getOne.mockResolvedValue(productRecord(["a.jpg"]));
    pb._getCollection("products").update.mockRejectedValue(new Error("db locked"));

    const ctx = createApiContext({
      params: { id: "prod1" },
      request: jsonRequest("http://test/api", "PATCH", { order: ["a.jpg"] }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(500);
  });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe("DELETE /admin/api/products/[id]/images", () => {
  test("filename válido en query string → 200, hace pb.update con 'images-'", async () => {
    const pb = createMockPB();
    pb._getCollection("products").update.mockResolvedValue(productRecord([]));

    const ctx = createApiContext({
      params: { id: "prod1" },
      request: new Request("http://test/api?filename=photo.jpg", { method: "DELETE" }),
      locals: { adminPB: pb },
    });

    const res = await DELETE(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    const updateCall = pb._getCollection("products").update.mock.calls[0];
    expect(updateCall[0]).toBe("prod1");
    expect(updateCall[1]).toEqual({ "images-": "photo.jpg" });
  });

  test("sin auth → 401", async () => {
    const ctx = createApiContext({
      params: { id: "prod1" },
      request: new Request("http://test/api?filename=photo.jpg", { method: "DELETE" }),
      locals: { adminPB: null },
    });

    const res = await DELETE(ctx);
    expect(res.status).toBe(401);
  });

  test("params.id vacío → 400", async () => {
    const pb = createMockPB();
    const ctx = createApiContext({
      params: { id: "" },
      request: new Request("http://test/api?filename=photo.jpg", { method: "DELETE" }),
      locals: { adminPB: pb },
    });

    const res = await DELETE(ctx);
    expect(res.status).toBe(400);
  });

  test("filename ausente (sin query ni body) → 400", async () => {
    const pb = createMockPB();
    const ctx = createApiContext({
      params: { id: "prod1" },
      request: new Request("http://test/api", { method: "DELETE" }),
      locals: { adminPB: pb },
    });

    const res = await DELETE(ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  test("filename con path traversal (../etc/passwd) → 400", async () => {
    const pb = createMockPB();
    const ctx = createApiContext({
      params: { id: "prod1" },
      request: new Request("http://test/api?filename=../etc/passwd", { method: "DELETE" }),
      locals: { adminPB: pb },
    });

    const res = await DELETE(ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  test("filename válido pero pb.update falla → 500", async () => {
    const pb = createMockPB();
    pb._getCollection("products").update.mockRejectedValue(new Error("conflict"));

    const ctx = createApiContext({
      params: { id: "prod1" },
      request: new Request("http://test/api?filename=photo.jpg", { method: "DELETE" }),
      locals: { adminPB: pb },
    });

    const res = await DELETE(ctx);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});
