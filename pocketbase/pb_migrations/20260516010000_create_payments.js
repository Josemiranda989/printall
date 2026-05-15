/// <reference path="../pb_data/types.d.ts" />

/**
 * Crea la coleccion `payments`: historial detallado de pagos individuales
 * asociados a un pedido o a una venta de insumo.
 *
 * Modelo:
 * - `target_type` (select): "order" | "sale"
 * - `target_id` (text, indexed): id del order o supply_sale
 * - `amount` (number, > 0): monto pagado en esta transaccion
 * - `method` (select): efectivo | transferencia | mercado_pago | otro
 * - `paid_at` (date): cuando se recibio el pago
 * - `notes` (text, opcional): referencia de transaccion, banco, etc.
 *
 * Source of truth:
 * - Para orders: SUM(payments.amount) reemplaza el rol historico de paid_amount.
 * - paid_amount queda como cache derivado, mantenido por el hook payments.pb.js.
 * - Para sales: is_paid se setea cuando SUM(payments.amount) >= total.
 *
 * El campo paid_amount en orders y is_paid en supply_sales se mantienen para
 * compatibilidad con el codigo existente — el hook los sincroniza.
 */

migrate((app) => {
  const collection = new Collection({
    type: "base",
    name: "payments",
    fields: [
      {
        type: "select",
        name: "target_type",
        required: true,
        maxSelect: 1,
        values: ["order", "sale"],
      },
      {
        type: "text",
        name: "target_id",
        required: true,
        max: 32,
      },
      {
        type: "number",
        name: "amount",
        required: true,
        onlyInt: false,
        min: 0,
      },
      {
        type: "select",
        name: "method",
        required: true,
        maxSelect: 1,
        values: ["efectivo", "transferencia", "mercado_pago", "otro"],
      },
      {
        type: "date",
        name: "paid_at",
        required: true,
      },
      {
        type: "text",
        name: "notes",
        required: false,
        max: 500,
      },
      {
        type: "autodate",
        name: "created",
        onCreate: true,
        onUpdate: false,
      },
      {
        type: "autodate",
        name: "updated",
        onCreate: true,
        onUpdate: true,
      },
    ],
    indexes: [
      "CREATE INDEX idx_payments_target ON payments (target_type, target_id)",
      "CREATE INDEX idx_payments_paid_at ON payments (paid_at)",
    ],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("payments");
  return app.delete(collection);
});
