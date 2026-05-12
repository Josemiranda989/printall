/// <reference path="../pb_data/types.d.ts" />

/**
 * Agrega `notion_page_id` (text, opcional) a la collection `orders`.
 *
 * Lo usa el hook `orders.pb.js` para guardar el ID de la página de Notion
 * creada al syncar. En updates posteriores reusamos ese ID para hacer PATCH
 * en vez de crear una página nueva.
 */

migrate((app) => {
  const collection = app.findCollectionByNameOrId("orders");
  collection.fields.add(
    new Field({
      type: "text",
      name: "notion_page_id",
      required: false,
      max: 64,
    }),
  );
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("orders");
  collection.fields.removeByName("notion_page_id");
  app.save(collection);
});
