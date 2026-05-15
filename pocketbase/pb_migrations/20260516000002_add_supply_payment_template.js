/// <reference path="../pb_data/types.d.ts" />

/**
 * Agrega un template seed para recordatorios de pago en ventas de insumos.
 *
 * Usa los placeholders nuevos disponibles en contexto 'sale':
 *   {{item_name}}, {{quantity}}, {{color}}
 *
 * Idempotente: si ya existe un template con este nombre, no se duplica.
 */

migrate((app) => {
  const collection = app.findCollectionByNameOrId("whatsapp_templates");
  const name = "Recordatorio de pago - insumo";

  let existing = null;
  try {
    existing = app.findFirstRecordByFilter(
      "whatsapp_templates",
      "name = {:n}",
      { n: name },
    );
  } catch (_) {
    existing = null;
  }
  if (existing) return;

  const record = new Record(collection);
  record.set("name", name);
  record.set("applies_to", "sale");
  record.set(
    "body",
    "Hola {{customer_name}}, te recuerdo que el saldo de *{{item_name}}* " +
      "({{color}}) x{{quantity}} es {{saldo}}. ¡Gracias! \u{1F4B0}",
  );
  app.save(record);
}, (app) => {
  try {
    const r = app.findFirstRecordByFilter(
      "whatsapp_templates",
      "name = {:n}",
      { n: "Recordatorio de pago - insumo" },
    );
    app.delete(r);
  } catch (_) {
    // ya borrado
  }
});
