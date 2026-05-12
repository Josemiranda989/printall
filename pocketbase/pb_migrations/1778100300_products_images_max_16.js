/// <reference path="../pb_data/types.d.ts" />

/**
 * Sube el límite de imágenes por producto de 8 a 16.
 *
 * Solo cambia `maxSelect` del campo `images` de la collection `products`.
 * Los archivos existentes y las imágenes ya cargadas no se ven afectadas.
 */

migrate((app) => {
  const collection = app.findCollectionByNameOrId("products");
  const field = collection.fields.getByName("images");
  if (field) {
    field.maxSelect = 16;
    app.save(collection);
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("products");
  const field = collection.fields.getByName("images");
  if (field) {
    field.maxSelect = 8;
    app.save(collection);
  }
});
