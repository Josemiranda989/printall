/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const categories = app.findCollectionByNameOrId("categories");

  const collection = new Collection({
    type: "base",
    name: "products",
    fields: [
      {
        type: "text",
        name: "name",
        required: true,
        max: 120,
      },
      {
        type: "text",
        name: "slug",
        required: true,
        max: 120,
        pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
      },
      {
        type: "relation",
        name: "category",
        required: true,
        collectionId: categories.id,
        cascadeDelete: false,
        maxSelect: 1,
      },
      {
        type: "editor",
        name: "description",
        required: false,
      },
      {
        type: "number",
        name: "price",
        required: false,
        onlyInt: false,
        min: 0,
      },
      {
        type: "text",
        name: "price_label",
        required: false,
        max: 60,
      },
      {
        type: "select",
        name: "stock_status",
        required: true,
        maxSelect: 1,
        values: ["in_stock", "low_stock", "out_of_stock", "made_to_order"],
      },
      {
        type: "bool",
        name: "featured",
        required: false,
      },
      {
        type: "json",
        name: "attributes",
        required: false,
        maxSize: 4000,
      },
      {
        type: "text",
        name: "whatsapp_message",
        required: false,
        max: 500,
      },
      {
        type: "file",
        name: "images",
        required: false,
        maxSelect: 8,
        maxSize: 5242880,
        mimeTypes: ["image/jpeg", "image/png", "image/webp"],
        thumbs: ["120x120", "400x400", "800x800"],
      },
      {
        type: "bool",
        name: "active",
        required: false,
      },
      {
        type: "autodate",
        name: "created",
        onCreate: true,
        onUpdate: false,
      },
      {
        type: "autodate",
        name: "updated",
        onCreate: true,
        onUpdate: true,
      },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_products_slug ON products (slug)",
      "CREATE INDEX idx_products_category_active ON products (category, active)",
      "CREATE INDEX idx_products_featured ON products (featured, active)",
    ],
    listRule: "active = true",
    viewRule: "active = true",
    createRule: null,
    updateRule: null,
    deleteRule: null,
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("products");
  return app.delete(collection);
});
