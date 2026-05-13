import { describe, expect, test } from "vitest";
import {
  createMockPB,
  createApiContext,
  jsonRequest,
} from "../../../../../test-utils/admin-api-mocks";
import { PATCH } from "./status";

describe("PATCH /admin/api/orders/[id]/status", () => {
  test("status válido → 200 y update con el nuevo estado", async () => {
    const pb = createMockPB();
    pb._getCollection("orders").getOne.mockResolvedValue({ id: "ord1" });
    pb._getCollection("orders").update.mockResolvedValue({});

    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", { status: "in_progress" }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, status: "in_progress" });

    const updateCall = pb._getCollection("orders").update.mock.calls[0];
    expect(updateCall[0]).toBe("ord1");
    expect(updateCall[1]).toEqual({ status: "in_progress" });
  });

  test.each(["pending", "in_progress", "completed", "delivered", "cancelled"])(
    'acepta status "%s"',
    async (status) => {
      const pb = createMockPB();
      pb._getCollection("orders").getOne.mockResolvedValue({ id: "ord1" });
      pb._getCollection("orders").update.mockResolvedValue({});

      const ctx = createApiContext({
        params: { id: "ord1" },
        request: jsonRequest("http://test/api", "PATCH", { status }),
        locals: { adminPB: pb },
      });

      const res = await PATCH(ctx);
      expect(res.status).toBe(200);
    },
  );

  test("sin auth (adminPB null) → 401", async () => {
    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", { status: "pending" }),
      locals: { adminPB: null },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  test("id vacío → 400", async () => {
    const pb = createMockPB();
    const ctx = createApiContext({
      params: { id: "" },
      request: jsonRequest("http://test/api", "PATCH", { status: "pending" }),
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

  test("status inválido → 422", async () => {
    const pb = createMockPB();
    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", { status: "foo" }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  test("pedido no existe (getOne rechaza) → 404, sin update", async () => {
    const pb = createMockPB();
    pb._getCollection("orders").getOne.mockRejectedValue(new Error("not found"));

    const ctx = createApiContext({
      params: { id: "nonexistent" },
      request: jsonRequest("http://test/api", "PATCH", { status: "pending" }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(404);
    expect(pb._getCollection("orders").update).not.toHaveBeenCalled();
  });

  test("pb.update falla → 500", async () => {
    const pb = createMockPB();
    pb._getCollection("orders").getOne.mockResolvedValue({ id: "ord1" });
    pb._getCollection("orders").update.mockRejectedValue(new Error("db write error"));

    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", { status: "pending" }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});
