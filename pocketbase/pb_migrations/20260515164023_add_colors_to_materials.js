/// <reference path="../pb_data/types.d.ts" />

/**
 * Adds colors field to materials — comma-separated list of available colors
 * e.g. "negro, blanco, verde"
 */
migrate((app) => {
  const collection = app.findCollectionByNameOrId("materials");
  collection.fields.add(
    new Field({
      type: "text",
      name: "colors",
      required: false,
      max: 200,
    }),
  );
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("materials");
  collection.fields.removeByName("colors");
  app.save(collection);
});
