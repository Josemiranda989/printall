import { describe, expect, test } from "vitest";
import {
  createMockPB,
  createApiContext,
  jsonRequest,
} from "../../../../../test-utils/admin-api-mocks";
import { PATCH } from "./paid";

describe("PATCH /admin/api/supply_sales/[id]/paid", () => {
  test("is_paid: true → 200, update con is_paid true", async () => {
    const pb = createMockPB();
    pb._getCollection("supply_sales").getOne.mockResolvedValue({ id: "ss1" });
    pb._getCollection("supply_sales").update.mockResolvedValue({});

    const ctx = createApiContext({
      params: { id: "ss1" },
      request: jsonRequest("http://test/api", "PATCH", { is_paid: true }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, is_paid: true });

    const updateCall = pb._getCollection("supply_sales").update.mock.calls[0];
    expect(updateCall[0]).toBe("ss1");
    expect(updateCall[1]).toEqual({ is_paid: true });
  });

  test("is_paid: false → 200, update con is_paid false", async () => {
    const pb = createMockPB();
    pb._getCollection("supply_sales").getOne.mockResolvedValue({ id: "ss1" });
    pb._getCollection("supply_sales").update.mockResolvedValue({});

    const ctx = createApiContext({
      params: { id: "ss1" },
      request: jsonRequest("http://test/api", "PATCH", { is_paid: false }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, is_paid: false });

    const updateCall = pb._getCollection("supply_sales").update.mock.calls[0];
    expect(updateCall[1]).toEqual({ is_paid: false });
  });

  test("sin auth → 401", async () => {
    const ctx = createApiContext({
      params: { id: "ss1" },
      request: jsonRequest("http://test/api", "PATCH", { is_paid: true }),
      locals: { adminPB: null },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(401);
  });

  test("id vacío → 400", async () => {
    const pb = createMockPB();
    const ctx = createApiContext({
      params: { id: "" },
      request: jsonRequest("http://test/api", "PATCH", { is_paid: true }),
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

  test("body sin is_paid → 422", async () => {
    const pb = createMockPB();
    const ctx = createApiContext({
      params: { id: "ss1" },
      request: jsonRequest("http://test/api", "PATCH", {}),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(422);
  });

  test("is_paid no booleano → 422", async () => {
    const pb = createMockPB();
    const ctx = createApiContext({
      params: { id: "ss1" },
      request: jsonRequest("http://test/api", "PATCH", { is_paid: "yes" }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(422);
  });

  test("venta no existe → 404, sin update", async () => {
    const pb = createMockPB();
    pb._getCollection("supply_sales").getOne.mockRejectedValue(new Error("not found"));

    const ctx = createApiContext({
      params: { id: "nonexistent" },
      request: jsonRequest("http://test/api", "PATCH", { is_paid: true }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(404);
    expect(pb._getCollection("supply_sales").update).not.toHaveBeenCalled();
  });

  test("pb.update falla → 500", async () => {
    const pb = createMockPB();
    pb._getCollection("supply_sales").getOne.mockResolvedValue({ id: "ss1" });
    pb._getCollection("supply_sales").update.mockRejectedValue(new Error("db error"));

    const ctx = createApiContext({
      params: { id: "ss1" },
      request: jsonRequest("http://test/api", "PATCH", { is_paid: true }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(500);
  });
});
