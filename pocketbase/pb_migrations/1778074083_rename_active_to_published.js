/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId("products");
  const field = collection.fields.find((f) => f.name === "active");
  if (!field) {
    throw new Error("[rename_active_to_published] field 'active' not found on products");
  }
  field.name = "published";

  collection.listRule = "published = true";
  collection.viewRule = "published = true";

  collection.indexes = collection.indexes.map((idx) =>
    idx
      .replace(/\(category,\s*active\)/g, "(category, published)")
      .replace(/\(featured,\s*active\)/g, "(featured, published)"),
  );

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("products");
  const field = collection.fields.find((f) => f.name === "published");
  if (field) {
    field.name = "active";
  }

  collection.listRule = "active = true";
  collection.viewRule = "active = true";

  collection.indexes = collection.indexes.map((idx) =>
    idx
      .replace(/\(category,\s*published\)/g, "(category, active)")
      .replace(/\(featured,\s*published\)/g, "(featured, active)"),
  );

  return app.save(collection);
});
