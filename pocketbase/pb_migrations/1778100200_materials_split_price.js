/// <reference path="../pb_data/types.d.ts" />

/**
 * Refactor de `materials`:
 *  - Reemplaza `price` + `multiplier` por `cost_price` + `sell_price`.
 *  - Migra cada row: cost_price = price; sell_price = price * multiplier.
 *  - Down: revierte (price = cost_price; multiplier = sell_price / cost_price).
 *
 * Hay que hacerlo en 3 pasos para evitar romper records existentes:
 *  1) Agregar cost_price y sell_price (required: false durante la migración).
 *  2) Setear los valores derivados en cada record.
 *  3) Borrar price y multiplier; promover los nuevos campos a required: true.
 */

migrate((app) => {
  const collection = app.findCollectionByNameOrId("materials");

  // 1) Agregar los nuevos campos (no required todavía).
  collection.fields.add(
    new Field({
      type: "number",
      name: "cost_price",
      required: false,
      onlyInt: false,
      min: 0,
    }),
  );
  collection.fields.add(
    new Field({
      type: "number",
      name: "sell_price",
      required: false,
      onlyInt: false,
      min: 0,
    }),
  );
  app.save(collection);

  // 2) Migrar valores: para cada record, calcular cost_price y sell_price.
  const records = app.findAllRecords("materials");
  for (const r of records) {
    const oldPrice = Number(r.get("price") ?? 0);
    const oldMult = Number(r.get("multiplier") ?? 1);
    r.set("cost_price", oldPrice);
    r.set("sell_price", oldPrice * oldMult);
    app.save(r);
  }

  // 3) Borrar campos viejos y promover los nuevos a required.
  collection.fields.removeByName("price");
  collection.fields.removeByName("multiplier");

  // Re-buscar los nuevos por nombre y marcarlos required.
  const costField = collection.fields.getByName("cost_price");
  if (costField) costField.required = true;
  const sellField = collection.fields.getByName("sell_price");
  if (sellField) sellField.required = true;

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("materials");

  // 1) Agregar campos viejos.
  collection.fields.add(
    new Field({
      type: "number",
      name: "price",
      required: false,
      onlyInt: false,
      min: 0,
    }),
  );
  collection.fields.add(
    new Field({
      type: "number",
      name: "multiplier",
      required: false,
      onlyInt: false,
      min: 0,
    }),
  );
  app.save(collection);

  // 2) Restaurar valores: price = cost_price; multiplier = sell_price / cost_price (o 1 si cost = 0).
  const records = app.findAllRecords("materials");
  for (const r of records) {
    const cost = Number(r.get("cost_price") ?? 0);
    const sell = Number(r.get("sell_price") ?? 0);
    r.set("price", cost);
    r.set("multiplier", cost > 0 ? sell / cost : 1);
    app.save(r);
  }

  // 3) Borrar campos nuevos y promover viejos a required.
  collection.fields.removeByName("cost_price");
  collection.fields.removeByName("sell_price");

  const priceField = collection.fields.getByName("price");
  if (priceField) priceField.required = true;
  const multField = collection.fields.getByName("multiplier");
  if (multField) multField.required = true;

  app.save(collection);
});
