/// <reference path="../pb_data/types.d.ts" />

/**
 * Backfill: crea registros en `payments` desde los datos historicos:
 *  - Cada order con paid_amount > 0 → 1 payment (method=transferencia, paid_at=order_date).
 *  - Cada supply_sale con is_paid=true → 1 payment con amount = total (method=transferencia, paid_at=sale_date).
 *
 * Idempotente: si ya existe un payment para el target, lo skipea (no duplica).
 *
 * El hook payments.pb.js NO esta activo durante esta migration (corre desde
 * `app.save`, no via API HTTP). Por eso seteamos paid_amount manualmente
 * aca tambien para mantener la consistencia inicial.
 */

migrate((app) => {
  const payments = app.findCollectionByNameOrId("payments");

  function hasExistingPayment(targetType, targetId) {
    try {
      app.findFirstRecordByFilter(
        "payments",
        "target_type = {:t} && target_id = {:i}",
        { t: targetType, i: targetId },
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  // ── Orders ──
  const BATCH = 500;
  let offset = 0;
  while (true) {
    const batch = app.findRecordsByFilter(
      "orders",
      "paid_amount > 0",
      "created",
      BATCH,
      offset,
    );
    if (!batch || batch.length === 0) break;

    for (const order of batch) {
      if (hasExistingPayment("order", order.id)) continue;
      const amount = Number(order.get("paid_amount")) || 0;
      if (amount <= 0) continue;

      const orderDate = order.get("order_date") || order.get("created");
      const payment = new Record(payments);
      payment.set("target_type", "order");
      payment.set("target_id", order.id);
      payment.set("amount", amount);
      payment.set("method", "transferencia");
      payment.set("paid_at", orderDate);
      payment.set("notes", "Backfill desde paid_amount original");
      app.save(payment);
    }

    if (batch.length < BATCH) break;
    offset += BATCH;
  }

  // ── Supply sales ──
  offset = 0;
  while (true) {
    const batch = app.findRecordsByFilter(
      "supply_sales",
      "is_paid = true",
      "created",
      BATCH,
      offset,
    );
    if (!batch || batch.length === 0) break;

    for (const sale of batch) {
      if (hasExistingPayment("sale", sale.id)) continue;
      const unitPrice = Number(sale.get("unit_price")) || 0;
      const quantity = Number(sale.get("quantity")) || 0;
      const total = unitPrice * quantity;
      if (total <= 0) continue;

      const saleDate = sale.get("sale_date") || sale.get("created");
      const payment = new Record(payments);
      payment.set("target_type", "sale");
      payment.set("target_id", sale.id);
      payment.set("amount", total);
      payment.set("method", "transferencia");
      payment.set("paid_at", saleDate);
      payment.set("notes", "Backfill desde is_paid=true original");
      app.save(payment);
    }

    if (batch.length < BATCH) break;
    offset += BATCH;
  }
}, (app) => {
  // Down: borrar todos los payments con notes que indique backfill
  const BATCH = 500;
  while (true) {
    let batch;
    try {
      batch = app.findRecordsByFilter(
        "payments",
        "notes ~ 'Backfill desde'",
        "created",
        BATCH,
        0,
      );
    } catch (_) {
      break;
    }
    if (!batch || batch.length === 0) break;
    for (const p of batch) {
      app.delete(p);
    }
    if (batch.length < BATCH) break;
  }
});
