/// <reference path="../pb_data/types.d.ts" />

/**
 * Crea la collection `quotes`: cotizaciones pre-pedido para clientes
 * que piden precio sin confirmar todavia. Cuando aceptan, se "convierten"
 * en un order (la conversion crea un order linkeado y marca el quote
 * como converted).
 *
 * Status:
 *  - pending     → creada, esperando respuesta del cliente
 *  - approved    → cliente acepto pero todavia no se convirtio
 *  - rejected    → cliente rechazo
 *  - converted   → se creo un order desde este quote (campo converted_order_id apunta a ese order)
 *  - expired     → caducó sin respuesta (uso futuro con cron)
 */

migrate((app) => {
  const collection = new Collection({
    type: "base",
    name: "quotes",
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
        type: "text",
        name: "title",
        required: true,
        max: 200,
      },
      {
        type: "text",
        name: "description",
        required: false,
        max: 2000,
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
        name: "quantity",
        required: true,
        onlyInt: true,
        min: 1,
      },
      {
        type: "select",
        name: "status",
        required: true,
        maxSelect: 1,
        values: ["pending", "approved", "rejected", "converted", "expired"],
      },
      {
        type: "date",
        name: "valid_until",
        required: false,
      },
      {
        type: "text",
        name: "converted_order_id",
        required: false,
        max: 32,
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
      "CREATE INDEX idx_quotes_status ON quotes (status)",
      "CREATE INDEX idx_quotes_created ON quotes (created)",
    ],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("quotes");
  return app.delete(collection);
});
