/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = new Collection({
    type: "base",
    name: "orders",
    fields: [
      {
        type: "text",
        name: "order_number",
        required: false,
        max: 20,
        pattern: "^\\d{4}-\\d{4,}$",
      },
      {
        type: "text",
        name: "project_name",
        required: true,
        max: 200,
      },
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
        type: "select",
        name: "material",
        required: true,
        maxSelect: 1,
        values: ["pla", "abs", "petg", "tpu", "nylon", "asa", "pc", "hips"],
      },
      {
        type: "select",
        name: "color",
        required: true,
        maxSelect: 1,
        values: [
          "blanco",
          "negro",
          "gris",
          "azul",
          "rojo",
          "verde",
          "amarillo",
          "naranja",
          "morado",
          "transparente",
          "celeste",
        ],
      },
      {
        type: "select",
        name: "priority",
        required: true,
        maxSelect: 1,
        values: ["high", "medium", "low"],
      },
      {
        type: "select",
        name: "status",
        required: true,
        maxSelect: 1,
        values: ["pending", "in_progress", "completed", "delivered", "cancelled"],
      },
      {
        type: "bool",
        name: "is_paid",
        required: false,
      },
      {
        type: "number",
        name: "unit_price",
        required: true,
        onlyInt: false,
        min: 0,
      },
      {
        type: "number",
        name: "units_ordered",
        required: true,
        onlyInt: true,
        min: 1,
      },
      {
        type: "number",
        name: "units_done",
        required: false,
        onlyInt: true,
        min: 0,
      },
      {
        type: "date",
        name: "order_date",
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
      "CREATE UNIQUE INDEX idx_orders_order_number ON orders (order_number)",
      "CREATE INDEX idx_orders_status_created ON orders (status, created)",
      "CREATE INDEX idx_orders_delivery_date ON orders (delivery_date)",
      "CREATE INDEX idx_orders_priority ON orders (priority)",
      "CREATE INDEX idx_orders_is_paid ON orders (is_paid)",
    ],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("orders");
  return app.delete(collection);
});
