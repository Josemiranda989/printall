/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const products = app.findCollectionByNameOrId("products");

  // 1) Crear la collection product_attributes
  const attrs = new Collection({
    type: "base",
    name: "product_attributes",
    fields: [
      {
        type: "relation",
        name: "product",
        required: true,
        collectionId: products.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      { type: "text", name: "key", required: true, max: 80 },
      { type: "text", name: "value", required: true, max: 500 },
      { type: "number", name: "order", required: false },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE INDEX idx_product_attributes_product ON product_attributes (product, `order`)",
    ],
    listRule: "product.published = true",
    viewRule: "product.published = true",
    createRule: null,
    updateRule: null,
    deleteRule: null,
  });
  app.save(attrs);

  // 2) Migrar la data existente: cada entry del JSON `attributes` → record en product_attributes
  // OJO: en PB 0.37 JSVM, `record.get("attributes")` devuelve types.JSONRaw (un []byte en Go),
  // NO un JS object. Hay que serializarlo a string y luego JSON.parse.
  const allProducts = app.findAllRecords("products");
  for (const p of allProducts) {
    const raw = p.get("attributes");
    let parsed = null;
    try {
      if (raw == null) {
        parsed = null;
      } else if (typeof raw === "string") {
        parsed = JSON.parse(raw);
      } else if (raw && typeof raw.length === "number") {
        // []byte-like: convertir a string vía char codes y parsear
        parsed = JSON.parse(String.fromCharCode.apply(null, raw));
      } else if (typeof raw === "object") {
        parsed = raw;
      }
    } catch (e) {
      console.warn("[migration] no se pudo parsear attributes de", p.id, e);
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
    let order = 0;
    for (const [key, value] of Object.entries(parsed)) {
      const rec = new Record(attrs);
      rec.set("product", p.id);
      rec.set("key", String(key));
      rec.set(
        "value",
        value === null || value === undefined ? "" : String(value),
      );
      rec.set("order", order);
      app.save(rec);
      order += 1;
    }
  }

  // 3) Borrar el campo `attributes` del schema de products
  products.fields = products.fields.filter((f) => f.name !== "attributes");
  app.save(products);
}, (app) => {
  const products = app.findCollectionByNameOrId("products");

  // 1) Re-agregar el campo attributes si no existe
  if (!products.fields.find((f) => f.name === "attributes")) {
    products.fields.push({
      type: "json",
      name: "attributes",
      required: false,
      maxSize: 2000,
    });
    app.save(products);
  }

  // 2) Re-poblar attributes desde los records de product_attributes
  const allProducts = app.findAllRecords("products");
  for (const p of allProducts) {
    const recs = app.findRecordsByFilter(
      "product_attributes",
      `product = "${p.id}"`,
      "+order",
    );
    if (!recs || recs.length === 0) continue;
    const json = {};
    for (const r of recs) {
      json[r.get("key")] = r.get("value");
    }
    p.set("attributes", json);
    app.save(p);
  }

  // 3) Borrar la collection product_attributes
  const attrsColl = app.findCollectionByNameOrId("product_attributes");
  app.delete(attrsColl);
});
