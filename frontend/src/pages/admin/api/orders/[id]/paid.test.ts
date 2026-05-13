import { describe, expect, test } from "vitest";
import {
  createMockPB,
  createApiContext,
  jsonRequest,
} from "../../../../../test-utils/admin-api-mocks";
import { PATCH } from "./paid";

// Helper: setup mock con un pedido típico (total = unit_price * units_ordered)
function setupOrder(
  pb: ReturnType<typeof createMockPB>,
  unitPrice = 100,
  unitsOrdered = 3,
) {
  pb._getCollection("orders").getOne.mockResolvedValue({
    id: "ord1",
    unit_price: unitPrice,
    units_ordered: unitsOrdered,
  });
  pb._getCollection("orders").update.mockResolvedValue({});
}

describe("PATCH /admin/api/orders/[id]/paid — formato { is_paid }", () => {
  test("is_paid: true → 200, paid_amount = total (unit_price * units_ordered)", async () => {
    const pb = createMockPB();
    setupOrder(pb, 100, 3); // total = 300

    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", { is_paid: true }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, is_paid: true, paid_amount: 300 });

    const updateCall = pb._getCollection("orders").update.mock.calls[0];
    expect(updateCall[0]).toBe("ord1");
    expect(updateCall[1]).toEqual({ is_paid: true, paid_amount: 300 });
  });

  test("is_paid: false → 200, paid_amount = 0", async () => {
    const pb = createMockPB();
    setupOrder(pb, 100, 3);

    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", { is_paid: false }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, is_paid: false, paid_amount: 0 });
  });
});

describe("PATCH /admin/api/orders/[id]/paid — formato { paid_amount }", () => {
  test("paid_amount parcial < total → 200, is_paid: false (seña/pago parcial)", async () => {
    const pb = createMockPB();
    setupOrder(pb, 100, 3); // total = 300

    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", { paid_amount: 100 }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, is_paid: false, paid_amount: 100 });
  });

  test("paid_amount === total → 200, is_paid: true (derivado)", async () => {
    const pb = createMockPB();
    setupOrder(pb, 100, 3); // total = 300

    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", { paid_amount: 300 }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, is_paid: true, paid_amount: 300 });
  });

  test("paid_amount > total → 200, clampea a total y is_paid: true", async () => {
    // Razón: si el cliente envía un monto excesivo (error de UI o concurrencia
    // con un cambio de precio), no queremos guardar un monto > total. Clamp en server.
    const pb = createMockPB();
    setupOrder(pb, 100, 3); // total = 300

    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", { paid_amount: 500 }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, is_paid: true, paid_amount: 300 });

    const updateCall = pb._getCollection("orders").update.mock.calls[0];
    expect(updateCall[1].paid_amount).toBe(300);
  });

  test("paid_amount = 0 → 200, is_paid: false (limpiar seña previa)", async () => {
    const pb = createMockPB();
    setupOrder(pb, 100, 3);

    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", { paid_amount: 0 }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, is_paid: false, paid_amount: 0 });
  });

  test("total === 0 (precio o cantidad cero) y paid_amount = 0 → is_paid: false", async () => {
    // Razón: la condición `total > 0 && newPaidAmount >= total` impide marcar
    // como pagado un pedido sin total real. Evita falsos positivos en pedidos
    // mal cargados (faltan datos de precio).
    const pb = createMockPB();
    setupOrder(pb, 0, 3); // total = 0

    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", { paid_amount: 0 }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.is_paid).toBe(false);
  });
});

describe("PATCH /admin/api/orders/[id]/paid — errores", () => {
  test("sin auth → 401", async () => {
    const ctx = createApiContext({
      params: { id: "ord1" },
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
      params: { id: "ord1" },
      request: req,
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(400);
  });

  test("body sin is_paid ni paid_amount → 422", async () => {
    const pb = createMockPB();
    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", {}),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(422);
  });

  test("paid_amount negativo → 422", async () => {
    const pb = createMockPB();
    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", { paid_amount: -100 }),
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
      request: jsonRequest("http://test/api", "PATCH", { is_paid: true }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(404);
    expect(pb._getCollection("orders").update).not.toHaveBeenCalled();
  });

  test("pb.update falla → 500", async () => {
    const pb = createMockPB();
    setupOrder(pb, 100, 3);
    pb._getCollection("orders").update.mockRejectedValue(new Error("db error"));

    const ctx = createApiContext({
      params: { id: "ord1" },
      request: jsonRequest("http://test/api", "PATCH", { is_paid: true }),
      locals: { adminPB: pb },
    });

    const res = await PATCH(ctx);
    expect(res.status).toBe(500);
  });
});
