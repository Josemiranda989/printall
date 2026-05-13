import { describe, expect, test } from "vitest";
import {
  createMockPB,
  createApiContext,
  jsonRequest,
} from "../../../../../test-utils/admin-api-mocks";
import { PATCH } from "./progress";

// Helper: setup mock con un pedido y su progreso actual
function setupOrder(
  pb: ReturnType<typeof createMockPB>,
  unitsDone = 0,
  unitsOrdered = 10,
) {
  pb._getCollection("orders").getOne.mockResolvedValue({
    units_done: unitsDone,
    units_ordered: unitsOrdered,
  });
  pb._getCollection("orders").update.mockResolvedValue({});
}

describe("PATCH /admin/api/orders/[id]/progress — formato { units_done }", () => {
  test("units_done absoluto válido → 200, update con el valor", async () => {
    const pb = createMockPB();
    setupOrder(pb, 0, 10);

    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", { units_done: 5 }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, units_done: 5, units_ordered: 10 });

    const updateCall = pb._getCollection("orders").update.mock.calls[0];
    expect(updateCall[1]).toEqual({ units_done: 5 });
  });

  test("units_done > units_ordered → clampea a units_ordered", async () => {
    // Razón: el endpoint clampea a [0, units_ordered] como defensa server-side
    // contra inputs maliciosos o bugs de UI. El cliente tampoco debería permitirlo,
    // pero el server es la línea de defensa final.
    const pb = createMockPB();
    setupOrder(pb, 0, 10);

    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", { units_done: 999 }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.units_done).toBe(10);
  });

  test("units_done = 0 → 200 (reset del progreso)", async () => {
    const pb = createMockPB();
    setupOrder(pb, 5, 10);

    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", { units_done: 0 }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.units_done).toBe(0);
  });
});

describe("PATCH /admin/api/orders/[id]/progress — formato { delta }", () => {
  test("delta positivo → suma al actual", async () => {
    const pb = createMockPB();
    setupOrder(pb, 3, 10);

    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", { delta: 2 }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.units_done).toBe(5);
  });

  test("delta negativo → resta al actual", async () => {
    const pb = createMockPB();
    setupOrder(pb, 5, 10);

    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", { delta: -2 }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.units_done).toBe(3);
  });

  test("delta que excede ordered → clampea a ordered", async () => {
    const pb = createMockPB();
    setupOrder(pb, 8, 10);

    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", { delta: 50 }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.units_done).toBe(10);
  });

  test("delta negativo que va por debajo de 0 → clampea a 0", async () => {
    const pb = createMockPB();
    setupOrder(pb, 2, 10);

    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", { delta: -10 }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.units_done).toBe(0);
  });

  test("delta cuando current es null/undefined → trata como 0", async () => {
    // Razón: pedidos viejos podrían no tener units_done seteado.
    // El endpoint usa `current.units_done ?? 0` para no explotar.
    const pb = createMockPB();
    pb._getCollection("orders").getOne.mockResolvedValue({
      units_done: undefined,
      units_ordered: 10,
    });
    pb._getCollection("orders").update.mockResolvedValue({});

    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", { delta: 3 }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.units_done).toBe(3);
  });
});

describe("PATCH /admin/api/orders/[id]/progress — errores", () => {
  test("sin auth → 401", async () => {
    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", { units_done: 1 }),
      locals: { adminPB: null },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(401);
  });

  test("id vacío → 400", async () => {
    const pb = createMockPB();
    const ctx = createApiContext({
      params: { id: "" },
      request: jsonRequest("http://test/api", "PATCH", { units_done: 1 }),
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

  test("body sin units_done ni delta → 422", async () => {
    const pb = createMockPB();
    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", {}),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(422);
  });

  test("units_done negativo → 422", async () => {
    const pb = createMockPB();
    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", { units_done: -1 }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(422);
  });

  test("delta no entero → 422", async () => {
    const pb = createMockPB();
    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", { delta: 0.5 }),
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
      request: jsonRequest("http://test/api", "PATCH", { units_done: 1 }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(404);
    expect(pb._getCollection("orders").update).not.toHaveBeenCalled();
  });

  test("pb.update falla → 500", async () => {
    const pb = createMockPB();
    setupOrder(pb, 0, 10);
    pb._getCollection("orders").update.mockRejectedValue(new Error("db error"));

    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", { units_done: 1 }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(500);
  });
});
