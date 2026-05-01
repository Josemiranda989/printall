/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = new Collection({
    type: "base",
    name: "categories",
    fields: [
      {
        type: "text",
        name: "name",
        required: true,
        max: 80,
      },
      {
        type: "text",
        name: "slug",
        required: true,
        max: 80,
        pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
      },
      {
        type: "text",
        name: "icon",
        required: false,
        max: 8,
      },
      {
        type: "text",
        name: "description",
        required: false,
        max: 240,
      },
      {
        type: "number",
        name: "order",
        required: false,
        onlyInt: true,
      },
      {
        type: "bool",
        name: "active",
        required: false,
      },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_categories_slug ON categories (slug)",
      "CREATE INDEX idx_categories_active_order ON categories (active, `order`)",
    ],
    listRule: "active = true",
    viewRule: "active = true",
    createRule: null,
    updateRule: null,
    deleteRule: null,
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("categories");
  return app.delete(collection);
});
