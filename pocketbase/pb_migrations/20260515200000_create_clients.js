/// <reference path="../pb_data/types.d.ts" />

/**
 * Crea la coleccion `clients`: agenda de clientes derivada de pedidos.
 *
 * - `name` y `whatsapp` son lo que ve el usuario.
 * - `whatsapp_norm` y `name_norm` son campos de matching usados por hooks y backfill:
 *     whatsapp_norm = solo digitos (sin "+", espacios, "-")
 *     name_norm     = lowercase + trim + sin tildes
 *   Indexed para lookups rapidos, NO unique (varios clients pueden tener
 *   whatsapp vacio, y dos clientes con el mismo nombre normalizado son
 *   posibles si tienen tel distintos).
 * - Los counters (total_orders, total_spent, last_seen_at) NO se persisten:
 *   se calculan on-the-fly al renderizar (decision deliberada para evitar
 *   cache desincronizado).
 */

migrate((app) => {
  const collection = new Collection({
    type: "base",
    name: "clients",
    fields: [
      {
        type: "text",
        name: "name",
        required: true,
        max: 120,
      },
      {
        type: "text",
        name: "whatsapp",
        required: false,
        max: 30,
      },
      {
        type: "text",
        name: "whatsapp_norm",
        required: false,
        max: 30,
      },
      {
        type: "text",
        name: "name_norm",
        required: false,
        max: 120,
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
      "CREATE INDEX idx_clients_whatsapp_norm ON clients (whatsapp_norm)",
      "CREATE INDEX idx_clients_name_norm ON clients (name_norm)",
    ],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("clients");
  return app.delete(collection);
});
