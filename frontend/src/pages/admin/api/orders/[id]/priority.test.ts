import { describe, expect, test } from "vitest";
import {
  createMockPB,
  createApiContext,
  jsonRequest,
} from "../../../../../test-utils/admin-api-mocks";
import { PATCH } from "./priority";

describe("PATCH /admin/api/orders/[id]/priority", () => {
  test("priority válida → 200 y update con la nueva prioridad", async () => {
    const pb = createMockPB();
    pb._getCollection("orders").getOne.mockResolvedValue({ id: "ord1" });
    pb._getCollection("orders").update.mockResolvedValue({});

    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", { priority: "high" }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, priority: "high" });

    const updateCall = pb._getCollection("orders").update.mock.calls[0];
    expect(updateCall[0]).toBe("ord1");
    expect(updateCall[1]).toEqual({ priority: "high" });
  });

  test.each(["high", "medium", "low"])('acepta priority "%s"', async (priority) => {
    const pb = createMockPB();
    pb._getCollection("orders").getOne.mockResolvedValue({ id: "ord1" });
    pb._getCollection("orders").update.mockResolvedValue({});

    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", { priority }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(200);
  });

  test("sin auth → 401", async () => {
    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", { priority: "high" }),
      locals: { adminPB: null },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(401);
  });

  test("id vacío → 400", async () => {
    const pb = createMockPB();
    const ctx = createApiContext({
      params: { id: "" },
      request: jsonRequest("http://test/api", "PATCH", { priority: "high" }),
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
      body: "{ broken",
    });

    const ctx = createApiContext({
      params: { id: "ord1" },
      request: req,
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(400);
  });

  test("priority inválida → 422", async () => {
    const pb = createMockPB();
    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", { priority: "urgent" }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(422);
  });

  test("pedido no existe → 404, sin update", async () => {
    const pb = createMockPB();
    pb._getCollection("orders").getOne.mockRejectedValue(new Error("not found"));

    const ctx = createApiContext({
      params: { id: "nonexistent" },
      request: jsonRequest("http://test/api", "PATCH", { priority: "high" }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(404);
    expect(pb._getCollection("orders").update).not.toHaveBeenCalled();
  });

  test("pb.update falla → 500", async () => {
    const pb = createMockPB();
    pb._getCollection("orders").getOne.mockResolvedValue({ id: "ord1" });
    pb._getCollection("orders").update.mockRejectedValue(new Error("db error"));

    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", { priority: "high" }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(500);
  });
});
