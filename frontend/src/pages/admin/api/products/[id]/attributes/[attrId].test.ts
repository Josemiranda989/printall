import { describe, expect, test } from "vitest";
import {
  createMockPB,
  createApiContext,
  jsonRequest,
} from "../../../../../../test-utils/admin-api-mocks";
import { PATCH, DELETE } from "./[attrId]";

// ─── Helpers locales ───────────────────────────────────────────────────────────

function makeAttrRecord(overrides: Partial<{
  id: string;
  key: string;
  value: string;
  order: number;
  product: string;
}> = {}) {
  return {
    id: "attr1",
    key: "color",
    value: "negro",
    order: 0,
    product: "prod1",
    ...overrides,
  };
}

// ─── PATCH /admin/api/products/[id]/attributes/[attrId] ──────────────────────

describe("PATCH /admin/api/products/[id]/attributes/[attrId]", () => {
  test("key/value válidos + attr pertenece al producto → 200, devuelve attribute actualizado", async () => {
    const pb = createMockPB();
    const attrRecord = makeAttrRecord({ product: "prod1" });
    pb._getCollection("product_attributes").getOne.mockResolvedValue(attrRecord);
    pb._getCollection("product_attributes").update.mockResolvedValue({
      ...attrRecord,
      key: "material",
      value: "PLA+",
    });

    const ctx = createApiContext({
      params: { id: "prod1", attrId: "attr1" },
      request: jsonRequest("http://test/api", "PATCH", { key: "material", value: "PLA+" }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.attribute.key).toBe("material");
    expect(body.attribute.value).toBe("PLA+");
  });

  test("sin auth → 401", async () => {
    const ctx = createApiContext({
      params: { id: "prod1", attrId: "attr1" },
      request: jsonRequest("http://test/api", "PATCH", { key: "color", value: "negro" }),
      locals: { adminPB: null },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(401);
  });

  test("params.id vacío → 400", async () => {
    const pb = createMockPB();
    const ctx = createApiContext({
      params: { id: "", attrId: "attr1" },
      request: jsonRequest("http://test/api", "PATCH", { key: "color", value: "negro" }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(400);
  });

  test("params.attrId vacío → 400", async () => {
    const pb = createMockPB();
    const ctx = createApiContext({
      params: { id: "prod1", attrId: "" },
      request: jsonRequest("http://test/api", "PATCH", { key: "color", value: "negro" }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(400);
  });

  test("validation fail (key vacío) → 422 con errors array", async () => {
    const pb = createMockPB();
    const ctx = createApiContext({
      params: { id: "prod1", attrId: "attr1" },
      request: jsonRequest("http://test/api", "PATCH", { key: "", value: "negro" }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(Array.isArray(body.errors)).toBe(true);
  });

  test("attr no existe (getOne rechaza) → 404", async () => {
    const pb = createMockPB();
    pb._getCollection("product_attributes").getOne.mockRejectedValue(new Error("not found"));

    const ctx = createApiContext({
      params: { id: "prod1", attrId: "nonexistent" },
      request: jsonRequest("http://test/api", "PATCH", { key: "color", value: "negro" }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  test("attr pertenece a OTRO producto → 404 (misma respuesta, sin info leak)", async () => {
    const pb = createMockPB();
    // El attr existe pero su product es "OTHER_PRODUCT", no "prod1"
    pb._getCollection("product_attributes").getOne.mockResolvedValue(
      makeAttrRecord({ product: "OTHER_PRODUCT" }),
    );

    const ctx = createApiContext({
      params: { id: "prod1", attrId: "attr1" },
      request: jsonRequest("http://test/api", "PATCH", { key: "color", value: "negro" }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    // Misma respuesta que no existe — sin info leak
    expect(body.error).toMatch(/no encontrado/i);
  });

  test("pb.update falla → 500", async () => {
    const pb = createMockPB();
    pb._getCollection("product_attributes").getOne.mockResolvedValue(
      makeAttrRecord({ product: "prod1" }),
    );
    pb._getCollection("product_attributes").update.mockRejectedValue(new Error("write error"));

    const ctx = createApiContext({
      params: { id: "prod1", attrId: "attr1" },
      request: jsonRequest("http://test/api", "PATCH", { key: "color", value: "negro" }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});

// ─── DELETE /admin/api/products/[id]/attributes/[attrId] ─────────────────────

describe("DELETE /admin/api/products/[id]/attributes/[attrId]", () => {
  test("attr existe + pertenece al producto → 200", async () => {
    const pb = createMockPB();
    pb._getCollection("product_attributes").getOne.mockResolvedValue(
      makeAttrRecord({ product: "prod1" }),
    );
    pb._getCollection("product_attributes").delete.mockResolvedValue(undefined);

    const ctx = createApiContext({
      params: { id: "prod1", attrId: "attr1" },
      request: new Request("http://test/api", { method: "DELETE" }),
      locals: { adminPB: pb },
    });

    const res = await DELETE(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // Verificar que se llamó delete con el attrId correcto
    expect(pb._getCollection("product_attributes").delete.mock.calls[0][0]).toBe("attr1");
  });

  test("sin auth → 401", async () => {
    const ctx = createApiContext({
      params: { id: "prod1", attrId: "attr1" },
      request: new Request("http://test/api", { method: "DELETE" }),
      locals: { adminPB: null },
    });

    const res = await DELETE(ctx);
    expect(res.status).toBe(401);
  });

  test("params.id o attrId vacío → 400", async () => {
    const pb = createMockPB();

    // id vacío
    const ctx1 = createApiContext({
      params: { id: "", attrId: "attr1" },
      request: new Request("http://test/api", { method: "DELETE" }),
      locals: { adminPB: pb },
    });
    expect((await DELETE(ctx1)).status).toBe(400);

    // attrId vacío
    const ctx2 = createApiContext({
      params: { id: "prod1", attrId: "" },
      request: new Request("http://test/api", { method: "DELETE" }),
      locals: { adminPB: pb },
    });
    expect((await DELETE(ctx2)).status).toBe(400);
  });

  test("attr no existe → 404", async () => {
    const pb = createMockPB();
    pb._getCollection("product_attributes").getOne.mockRejectedValue(new Error("not found"));

    const ctx = createApiContext({
      params: { id: "prod1", attrId: "nonexistent" },
      request: new Request("http://test/api", { method: "DELETE" }),
      locals: { adminPB: pb },
    });

    const res = await DELETE(ctx);
    expect(res.status).toBe(404);
  });

  test("attr pertenece a otro producto → 404 (sin info leak)", async () => {
    const pb = createMockPB();
    pb._getCollection("product_attributes").getOne.mockResolvedValue(
      makeAttrRecord({ product: "OTRO_PROD" }),
    );

    const ctx = createApiContext({
      params: { id: "prod1", attrId: "attr1" },
      request: new Request("http://test/api", { method: "DELETE" }),
      locals: { adminPB: pb },
    });

    const res = await DELETE(ctx);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  test("pb.delete falla → 500", async () => {
    const pb = createMockPB();
    pb._getCollection("product_attributes").getOne.mockResolvedValue(
      makeAttrRecord({ product: "prod1" }),
    );
    pb._getCollection("product_attributes").delete.mockRejectedValue(new Error("locked"));

    const ctx = createApiContext({
      params: { id: "prod1", attrId: "attr1" },
      request: new Request("http://test/api", { method: "DELETE" }),
      locals: { adminPB: pb },
    });

    const res = await DELETE(ctx);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});
