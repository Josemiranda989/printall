/// <reference path="../pb_data/types.d.ts" />

/**
 * Agrega `paid_amount` (number, default 0) a la collection `orders`.
 *
 * Este campo registra cuánto pagó el cliente hasta el momento (seña parcial,
 * pago total, etc). El existing `is_paid` (bool) pasa a ser DERIVADO: lo
 * calcula el form server-side cuando se guarda el pedido, comparando
 * paid_amount contra unit_price * units_ordered.
 *
 * Migración de data:
 *   - Si is_paid era true → paid_amount = unit_price × units_ordered (se asume
 *     que el total estaba cobrado).
 *   - Si is_paid era false → paid_amount = 0 (default, no hace falta tocar).
 */

migrate((app) => {
  const collection = app.findCollectionByNameOrId("orders");
  collection.fields.add(
    new Field({
      type: "number",
      name: "paid_amount",
      required: false,
      onlyInt: false,
      min: 0,
    }),
  );
  app.save(collection);

  // Migración de data: para los pedidos que ya estaban marcados como pagados,
  // estimar el monto total cobrado en base a unit_price × units_ordered.
  const records = app.findAllRecords("orders");
  for (const r of records) {
    if (r.get("is_paid")) {
      const price = Number(r.get("unit_price")) || 0;
      const units = Number(r.get("units_ordered")) || 0;
      r.set("paid_amount", price * units);
      app.save(r);
    }
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("orders");
  collection.fields.removeByName("paid_amount");
  app.save(collection);
});
