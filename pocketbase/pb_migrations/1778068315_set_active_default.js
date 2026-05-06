/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId("products");
  const field = collection.fields.find((f) => f.name === "active");
  if (!field) {
    throw new Error("[set_active_default] field 'active' not found on products");
  }
  field.default = true;
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("products");
  const field = collection.fields.find((f) => f.name === "active");
  if (field) {
    delete field.default;
  }
  return app.save(collection);
});
