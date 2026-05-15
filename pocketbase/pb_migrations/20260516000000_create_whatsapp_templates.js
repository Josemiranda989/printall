/// <reference path="../pb_data/types.d.ts" />

/**
 * Crea la coleccion `whatsapp_templates`: plantillas reutilizables de
 * mensajes para enviar por WhatsApp con placeholders interpolables.
 *
 * - `name`: titulo legible del template (ej: "Pedido listo para retirar").
 * - `body`: cuerpo del mensaje, soporta placeholders tipo {{customer_name}},
 *   {{project_name}}, {{total}}, {{saldo}}, etc. Renderizado server-side
 *   al construir el deeplink de WhatsApp.
 * - `applies_to`: a que contexto aplica el template:
 *     'order' → solo en detalle de pedido
 *     'sale'  → solo en detalle de venta de insumo
 *     'any'   → ambos (templates universales como saludo, agradecimiento)
 *
 * Index en applies_to porque filtramos templates por contexto en cada page
 * load del detalle.
 */

migrate((app) => {
  const collection = new Collection({
    type: "base",
    name: "whatsapp_templates",
    fields: [
      {
        type: "text",
        name: "name",
        required: true,
        max: 100,
      },
      {
        type: "text",
        name: "body",
        required: true,
        max: 2000,
      },
      {
        type: "select",
        name: "applies_to",
        required: true,
        maxSelect: 1,
        values: ["order", "sale", "any"],
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
      "CREATE INDEX idx_whatsapp_templates_applies_to ON whatsapp_templates (applies_to)",
    ],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("whatsapp_templates");
  return app.delete(collection);
});
