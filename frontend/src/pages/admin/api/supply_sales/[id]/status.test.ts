import { describe, expect, test } from "vitest";
import {
  createMockPB,
  createApiContext,
  jsonRequest,
} from "../../../../../test-utils/admin-api-mocks";
import { PATCH } from "./status";

describe("PATCH /admin/api/supply_sales/[id]/status", () => {
  test("status válido → 200 y update con el nuevo estado", async () => {
    const pb = createMockPB();
    pb._getCollection("supply_sales").getOne.mockResolvedValue({ id: "ss1" });
    pb._getCollection("supply_sales").update.mockResolvedValue({});

    const ctx = createApiContext({
      params: { id: "ss1" },
      request: jsonRequest("http://test/api", "PATCH", { status: "entregado" }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, status: "entregado" });

    const updateCall = pb._getCollection("supply_sales").update.mock.calls[0];
    expect(updateCall[0]).toBe("ss1");
    expect(updateCall[1]).toEqual({ status: "entregado" });
  });

  test.each(["reservado", "entregado", "cancelado"])(
    'acepta status "%s"',
    async (status) => {
      const pb = createMockPB();
      pb._getCollection("supply_sales").getOne.mockResolvedValue({ id: "ss1" });
      pb._getCollection("supply_sales").update.mockResolvedValue({});

      const ctx = createApiContext({
        params: { id: "ss1" },
        request: jsonRequest("http://test/api", "PATCH", { status }),
        locals: { adminPB: pb },
      });

      const res = await PATCH(ctx);
      expect(res.status).toBe(200);
    },
  );

  test("sin auth (adminPB null) → 401", async () => {
    const ctx = createApiContext({
      params: { id: "ss1" },
      request: jsonRequest("http://test/api", "PATCH", { status: "reservado" }),
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
      request: jsonRequest("http://test/api", "PATCH", { status: "reservado" }),
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
      params: { id: "ss1" },
      request: req,
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(400);
  });

  test("status inválido → 422", async () => {
    const pb = createMockPB();
    const ctx = createApiContext({
      params: { id: "ss1" },
      request: jsonRequest("http://test/api", "PATCH", { status: "foo" }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  test("venta no existe (getOne rechaza) → 404, sin update", async () => {
    const pb = createMockPB();
    pb._getCollection("supply_sales").getOne.mockRejectedValue(new Error("not found"));

    const ctx = createApiContext({
      params: { id: "nonexistent" },
      request: jsonRequest("http://test/api", "PATCH", { status: "reservado" }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(404);
    expect(pb._getCollection("supply_sales").update).not.toHaveBeenCalled();
  });

  test("pb.update falla → 500", async () => {
    const pb = createMockPB();
    pb._getCollection("supply_sales").getOne.mockResolvedValue({ id: "ss1" });
    pb._getCollection("supply_sales").update.mockRejectedValue(new Error("db write error"));

    const ctx = createApiContext({
      params: { id: "ss1" },
      request: jsonRequest("http://test/api", "PATCH", { status: "reservado" }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});
