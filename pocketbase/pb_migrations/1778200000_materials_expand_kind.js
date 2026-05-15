/// <reference path="../pb_data/types.d.ts" />

/**
 * Expande el enum `kind` de `materials` con los tipos nuevos de insumo:
 *  - `adhesive`  (gotita, pegamentos)
 *  - `accessory` (vasos de aluminio, polimeros para mate)
 *
 * Cambio aditivo: los valores existentes (`filament`, `component`) se
 * conservan. La calculadora de costos sigue filtrando por `kind`, asi que
 * los tipos nuevos quedan fuera de su alcance automaticamente.
 */

migrate((app) => {
  const collection = app.findCollectionByNameOrId("materials");
  const kindField = collection.fields.getByName("kind");
  kindField.values = ["filament", "component", "adhesive", "accessory"];
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("materials");
  const kindField = collection.fields.getByName("kind");
  kindField.values = ["filament", "component"];
  app.save(collection);
});
