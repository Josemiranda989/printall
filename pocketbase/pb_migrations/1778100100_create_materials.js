/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  // 1) Crear collection materials
  const collection = new Collection({
    type: "base",
    name: "materials",
    fields: [
      {
        type: "text",
        name: "name",
        required: true,
        max: 60,
      },
      {
        type: "select",
        name: "kind",
        required: true,
        maxSelect: 1,
        values: ["filament", "component"],
      },
      {
        type: "number",
        name: "price",
        required: true,
        onlyInt: false,
        min: 0,
      },
      {
        type: "number",
        name: "multiplier",
        required: true,
        onlyInt: false,
        min: 0,
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
      "CREATE UNIQUE INDEX idx_materials_name ON materials (name)",
      "CREATE INDEX idx_materials_active_kind ON materials (active, kind, name)",
    ],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  });

  app.save(collection);

  // 2) Seed inicial — los valores que el usuario maneja hoy
  const materials = app.findCollectionByNameOrId("materials");

  const seed = [
    { name: "PLA", kind: "filament", price: 18000, multiplier: 5, active: true },
    { name: "PETG", kind: "filament", price: 20000, multiplier: 5, active: true },
    { name: "Argollas", kind: "component", price: 90, multiplier: 1, active: true },
  ];

  for (const item of seed) {
    const rec = new Record(materials);
    rec.set("name", item.name);
    rec.set("kind", item.kind);
    rec.set("price", item.price);
    rec.set("multiplier", item.multiplier);
    rec.set("active", item.active);
    app.save(rec);
  }
}, (app) => {
  return app.delete(app.findCollectionByNameOrId("materials"));
});
