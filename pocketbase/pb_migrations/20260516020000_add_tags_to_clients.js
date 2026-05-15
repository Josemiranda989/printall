/// <reference path="../pb_data/types.d.ts" />

/**
 * Agrega campo `tags` a la coleccion `clients`: lista de etiquetas
 * separadas por coma, libres (ej: "vip, mayorista, moroso").
 *
 * Formato libre porque la cantidad de tags posibles es indeterminada y
 * delegamos al frontend la normalizacion (lowercase + trim al guardar,
 * split por coma al filtrar).
 */

migrate((app) => {
  const collection = app.findCollectionByNameOrId("clients");
  collection.fields.add(
    new Field({
      type: "text",
      name: "tags",
      required: false,
      max: 200,
    }),
  );
  collection.indexes = [
    ...collection.indexes,
    "CREATE INDEX idx_clients_tags ON clients (tags)",
  ];
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("clients");
  collection.fields.removeByName("tags");
  collection.indexes = collection.indexes.filter(
    (idx) => !idx.includes("idx_clients_tags"),
  );
  app.save(collection);
});
