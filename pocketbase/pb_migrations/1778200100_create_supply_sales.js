/// <reference path="../pb_data/types.d.ts" />

/**
 * Crea la coleccion `supply_sales`: registro de ventas de insumos 3D.
 *
 * - `item` es una relacion a `materials` (todo material es vendible).
 * - `unit_price` se persiste como foto del precio al momento de la venta;
 *   no se deriva de `materials.sell_price`.
 * - `status` (reservado/entregado/cancelado) e `is_paid` son ortogonales,
 *   igual que en `orders`.
 */

migrate((app) => {
  const materials = app.findCollectionByNameOrId("materials");

  const collection = new Collection({
    type: "base",
    name: "supply_sales",
    fields: [
      {
        type: "text",
        name: "customer_name",
        required: true,
        max: 120,
      },
      {
        type: "text",
        name: "customer_whatsapp",
        required: false,
        max: 30,
      },
      {
        type: "relation",
        name: "item",
        required: true,
        collectionId: materials.id,
        cascadeDelete: false,
        maxSelect: 1,
      },
      {
        type: "number",
        name: "quantity",
        required: true,
        onlyInt: true,
        min: 1,
      },
      {
        type: "number",
        name: "unit_price",
        required: true,
        onlyInt: false,
        min: 0,
      },
      {
        type: "select",
        name: "status",
        required: true,
        maxSelect: 1,
        values: ["reservado", "entregado", "cancelado"],
      },
      {
        type: "bool",
        name: "is_paid",
        required: false,
      },
      {
        type: "date",
        name: "sale_date",
        required: true,
      },
      {
        type: "date",
        name: "delivery_date",
        required: false,
      },
      {
        type: "text",
        name: "notes",
        required: false,
        max: 2000,
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
      "CREATE INDEX idx_supply_sales_status ON supply_sales (status)",
      "CREATE INDEX idx_supply_sales_sale_date ON supply_sales (sale_date)",
      "CREATE INDEX idx_supply_sales_is_paid ON supply_sales (is_paid)",
    ],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("supply_sales");
  return app.delete(collection);
});
