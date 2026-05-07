import { describe, expect, test } from "vitest";
import {
  createMockPB,
  createApiContext,
  jsonRequest,
} from "../../../../test-utils/admin-api-mocks";
import { PATCH } from "./reorder";

// ─── Helpers locales ───────────────────────────────────────────────────────────

function makeCat(id: string): { id: string } {
  return { id };
}

// ─── PATCH /admin/api/categories/reorder ─────────────────────────────────────

describe("PATCH /admin/api/categories/reorder", () => {
  test("order válido (mismo set de IDs) → 200, hace N updates en serie", async () => {
    const pb = createMockPB();
    const catIds = ["cat1", "cat2", "cat3"];
    pb._getCollection("categories").getFullList.mockResolvedValue(
      catIds.map((id) => makeCat(id)),
    );
    pb._getCollection("categories").update.mockResolvedValue({});

    const ctx = createApiContext({
      request: jsonRequest("http://test/api", "PATCH", { order: catIds }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // Verificar que se hicieron 3 updates con { order: i }
    const calls = pb._getCollection("categories").update.mock.calls;
    expect(calls).toHaveLength(3);
    expect(calls[0]).toEqual(["cat1", { order: 0 }]);
    expect(calls[1]).toEqual(["cat2", { order: 1 }]);
    expect(calls[2]).toEqual(["cat3", { order: 2 }]);
  });

  test("sin auth → 401", async () => {
    const ctx = createApiContext({
      request: jsonRequest("http://test/api", "PATCH", { order: ["cat1"] }),
      locals: { adminPB: null },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  test("body JSON inválido → 400", async () => {
    const pb = createMockPB();
    const req = new Request("http://test/api", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{ broken json {{",
    });

    const ctx = createApiContext({
      request: req,
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  test("order no es array → 400", async () => {
    const pb = createMockPB();
    const ctx = createApiContext({
      request: jsonRequest("http://test/api", "PATCH", { order: "not-an-array" }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  test("order contiene un ID que no existe → 400", async () => {
    const pb = createMockPB();
    pb._getCollection("categories").getFullList.mockResolvedValue([
      makeCat("cat1"),
      makeCat("cat2"),
    ]);

    const ctx = createApiContext({
      request: jsonRequest("http://test/api", "PATCH", { order: ["cat1", "INEXISTENTE"] }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("exactamente los mismos IDs");
  });

  test("order le falta un ID existente → 400", async () => {
    const pb = createMockPB();
    pb._getCollection("categories").getFullList.mockResolvedValue([
      makeCat("cat1"),
      makeCat("cat2"),
      makeCat("cat3"),
    ]);

    // Solo manda 2 de 3
    const ctx = createApiContext({
      request: jsonRequest("http://test/api", "PATCH", { order: ["cat1", "cat2"] }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("exactamente los mismos IDs");
  });

  test("pb.update falla en el medio → 500 con mensaje que incluye el catId", async () => {
    const pb = createMockPB();
    const catIds = ["cat1", "cat2", "cat3"];
    pb._getCollection("categories").getFullList.mockResolvedValue(
      catIds.map((id) => makeCat(id)),
    );

    // Falla en el segundo update
    pb._getCollection("categories").update
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("conflict on cat2"))
      .mockResolvedValue({});

    const ctx = createApiContext({
      request: jsonRequest("http://test/api", "PATCH", { order: catIds }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("cat2");
  });

  test("updates en SERIE — callOrder creciente, no paralelo", async () => {
    const pb = createMockPB();
    const catIds = ["cat1", "cat2", "cat3"];
    pb._getCollection("categories").getFullList.mockResolvedValue(
      catIds.map((id) => makeCat(id)),
    );

    const callOrder: string[] = [];
    pb._getCollection("categories").update.mockImplementation(
      async (catId: string, _data: unknown) => {
        callOrder.push(catId);
        return {};
      },
    );

    const ctx = createApiContext({
      request: jsonRequest("http://test/api", "PATCH", { order: catIds }),
      locals: { adminPB: pb },
    });

    await PATCH(ctx);

    expect(callOrder).toEqual(catIds);

    const invocationOrders =
      pb._getCollection("categories").update.mock.invocationCallOrder;
    for (let i = 1; i < invocationOrders.length; i++) {
      expect(invocationOrders[i]).toBeGreaterThan(invocationOrders[i - 1]);
    }
  });
});
