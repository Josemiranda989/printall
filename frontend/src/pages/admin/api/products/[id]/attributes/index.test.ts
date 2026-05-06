import { describe, expect, test } from "vitest";
import {
  createMockPB,
  createApiContext,
  jsonRequest,
} from "../../../../../../test-utils/admin-api-mocks";
import { ATTR_KEY_MAX } from "../../../../../../lib/admin-attributes";
import { POST, PATCH } from "./index";

// ─── Helpers locales ───────────────────────────────────────────────────────────

function makeAttr(id: string, order: number): { id: string; order: number } {
  return { id, order };
}

function makeCreated(
  overrides: Partial<{ id: string; key: string; value: string; order: number }> = {},
) {
  return { id: "attr1", key: "color", value: "negro", order: 0, ...overrides };
}

// ─── POST ─────────────────────────────────────────────────────────────────────

describe("POST /admin/api/products/[id]/attributes", () => {
  test("{key, value} válidos, sin attrs existentes → 201, order === 0", async () => {
    const pb = createMockPB();
    pb._getCollection("products").getOne.mockResolvedValue({ id: "prod1" });
    pb._getCollection("product_attributes").getFullList.mockResolvedValue([]);
    pb._getCollection("product_attributes").create.mockResolvedValue(
      makeCreated({ order: 0 }),
    );

    const ctx = createApiContext({
      params: { id: "prod1" },
      request: jsonRequest("http://test/api", "POST", { key: "color", value: "negro" }),
      locals: { adminPB: pb },
    });

    const res = await POST(ctx);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.attribute.order).toBe(0);
    expect(body.attribute.key).toBe("color");
    expect(body.attribute.value).toBe("negro");
  });

  test("{key, value} válidos, existentes con orders [0, 5, 2] → 201, order === 6 (max + 1)", async () => {
    const pb = createMockPB();
    pb._getCollection("products").getOne.mockResolvedValue({ id: "prod1" });
    pb._getCollection("product_attributes").getFullList.mockResolvedValue([
      makeAttr("a1", 0),
      makeAttr("a2", 5),
      makeAttr("a3", 2),
    ]);
    pb._getCollection("product_attributes").create.mockResolvedValue(
      makeCreated({ order: 6 }),
    );

    const ctx = createApiContext({
      params: { id: "prod1" },
      request: jsonRequest("http://test/api", "POST", { key: "material", value: "PLA" }),
      locals: { adminPB: pb },
    });

    const res = await POST(ctx);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.attribute.order).toBe(6);

    // Verificar que se creó con el order correcto
    const createCall = pb._getCollection("product_attributes").create.mock.calls[0][0];
    expect(createCall.order).toBe(6);
  });

  test("sin auth → 401", async () => {
    const ctx = createApiContext({
      params: { id: "prod1" },
      request: jsonRequest("http://test/api", "POST", { key: "color", value: "negro" }),
      locals: { adminPB: null },
    });

    const res = await POST(ctx);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  test("id vacío → 400", async () => {
    const pb = createMockPB();
    const ctx = createApiContext({
      params: { id: "" },
      request: jsonRequest("http://test/api", "POST", { key: "color", value: "negro" }),
      locals: { adminPB: pb },
    });

    const res = await POST(ctx);
    expect(res.status).toBe(400);
  });

  test("JSON inválido → 400", async () => {
    const pb = createMockPB();
    const req = new Request("http://test/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ broken json",
    });

    const ctx = createApiContext({
      params: { id: "prod1" },
      request: req,
      locals: { adminPB: pb },
    });

    const res = await POST(ctx);
    expect(res.status).toBe(400);
  });

  test("key vacío → 422 con errors array", async () => {
    const pb = createMockPB();
    const ctx = createApiContext({
      params: { id: "prod1" },
      request: jsonRequest("http://test/api", "POST", { key: "", value: "negro" }),
      locals: { adminPB: pb },
    });

    const res = await POST(ctx);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(Array.isArray(body.errors)).toBe(true);
  });

  test("key > 80 chars → 422", async () => {
    const pb = createMockPB();
    const ctx = createApiContext({
      params: { id: "prod1" },
      request: jsonRequest("http://test/api", "POST", {
        key: "a".repeat(ATTR_KEY_MAX + 1),
        value: "negro",
      }),
      locals: { adminPB: pb },
    });

    const res = await POST(ctx);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(Array.isArray(body.errors)).toBe(true);
  });

  test("producto no existe (getOne rechaza) → 404", async () => {
    const pb = createMockPB();
    pb._getCollection("products").getOne.mockRejectedValue(new Error("not found"));

    const ctx = createApiContext({
      params: { id: "nonexistent" },
      request: jsonRequest("http://test/api", "POST", { key: "color", value: "negro" }),
      locals: { adminPB: pb },
    });

    const res = await POST(ctx);
    expect(res.status).toBe(404);
  });

  test("pb.create falla → 500", async () => {
    const pb = createMockPB();
    pb._getCollection("products").getOne.mockResolvedValue({ id: "prod1" });
    pb._getCollection("product_attributes").getFullList.mockResolvedValue([]);
    pb._getCollection("product_attributes").create.mockRejectedValue(
      new Error("db write error"),
    );

    const ctx = createApiContext({
      params: { id: "prod1" },
      request: jsonRequest("http://test/api", "POST", { key: "color", value: "negro" }),
      locals: { adminPB: pb },
    });

    const res = await POST(ctx);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});

// ─── PATCH ────────────────────────────────────────────────────────────────────

describe("PATCH /admin/api/products/[id]/attributes", () => {
  test("order válido (mismo set de IDs) → 200, hace N updates en serie", async () => {
    const pb = createMockPB();
    const attrIds = ["attr1", "attr2", "attr3"];
    pb._getCollection("product_attributes").getFullList.mockResolvedValue(
      attrIds.map((id) => makeAttr(id, 0)),
    );
    pb._getCollection("product_attributes").update.mockResolvedValue({});

    const ctx = createApiContext({
      params: { id: "prod1" },
      request: jsonRequest("http://test/api", "PATCH", { order: attrIds }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // Verificar que se hicieron 3 updates
    expect(pb._getCollection("product_attributes").update.mock.calls).toHaveLength(3);
  });

  test("updates en SERIE — invocationCallOrder creciente y no paralelo", async () => {
    const pb = createMockPB();
    const attrIds = ["attr1", "attr2", "attr3"];
    pb._getCollection("product_attributes").getFullList.mockResolvedValue(
      attrIds.map((id) => makeAttr(id, 0)),
    );

    // Simulamos latencia para confirmar que son secuenciales
    const callOrder: string[] = [];
    pb._getCollection("product_attributes").update.mockImplementation(
      async (attrId: string, _data: unknown) => {
        callOrder.push(attrId);
        return {};
      },
    );

    const ctx = createApiContext({
      params: { id: "prod1" },
      request: jsonRequest("http://test/api", "PATCH", { order: attrIds }),
      locals: { adminPB: pb },
    });

    await PATCH(ctx);

    // El orden de ejecución debe coincidir con el orden del array enviado
    expect(callOrder).toEqual(attrIds);

    // Las invocaciones deben ser en orden estrictamente creciente
    const invocationOrders = pb._getCollection("product_attributes").update.mock.invocationCallOrder;
    for (let i = 1; i < invocationOrders.length; i++) {
      expect(invocationOrders[i]).toBeGreaterThan(invocationOrders[i - 1]);
    }
  });

  test("sin auth → 401", async () => {
    const ctx = createApiContext({
      params: { id: "prod1" },
      request: jsonRequest("http://test/api", "PATCH", { order: ["a1"] }),
      locals: { adminPB: null },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(401);
  });

  test("JSON inválido → 400", async () => {
    const pb = createMockPB();
    const req = new Request("http://test/api", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not json at all {{{",
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
      request: jsonRequest("http://test/api", "PATCH", { order: { wrong: true } }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(400);
  });

  test("set mismatch (IDs distintos) → 400", async () => {
    const pb = createMockPB();
    pb._getCollection("product_attributes").getFullList.mockResolvedValue([
      makeAttr("attr1", 0),
      makeAttr("attr2", 1),
    ]);

    const ctx = createApiContext({
      params: { id: "prod1" },
      request: jsonRequest("http://test/api", "PATCH", { order: ["attr1", "UNKNOWN_ID"] }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  test("pb.update falla en el medio → 500 con mensaje sobre cuál falló", async () => {
    const pb = createMockPB();
    const attrIds = ["attr1", "attr2", "attr3"];
    pb._getCollection("product_attributes").getFullList.mockResolvedValue(
      attrIds.map((id) => makeAttr(id, 0)),
    );

    // Falla en el segundo
    pb._getCollection("product_attributes").update
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("conflict on attr2"))
      .mockResolvedValue({});

    const ctx = createApiContext({
      params: { id: "prod1" },
      request: jsonRequest("http://test/api", "PATCH", { order: attrIds }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    // El error debe mencionar el attrId que falló
    expect(body.error).toContain("attr2");
  });
});
