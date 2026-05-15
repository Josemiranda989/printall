/// <reference path="../pb_data/types.d.ts" />

/**
 * Adds color field to supply_sales — the specific color sold in this transaction
 */
migrate((app) => {
  const collection = app.findCollectionByNameOrId("supply_sales");
  collection.fields.add(
    new Field({
      type: "text",
      name: "color",
      required: false,
      max: 100,
    }),
  );
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("supply_sales");
  collection.fields.removeByName("color");
  app.save(collection);
});
