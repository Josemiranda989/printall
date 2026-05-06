/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId("products");
  collection.fields = collection.fields.filter(
    (f) => f.name !== "whatsapp_message",
  );
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("products");
  if (!collection.fields.find((f) => f.name === "whatsapp_message")) {
    collection.fields.push({
      type: "text",
      name: "whatsapp_message",
      required: false,
      max: 500,
    });
  }
  return app.save(collection);
});
