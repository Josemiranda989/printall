/// <reference path="../pb_data/types.d.ts" />

/**
 * Seed inicial de templates de WhatsApp.
 *
 * El usuario puede editarlos/borrarlos despues desde /admin/mensajes.
 * Si vuelve a correr esta migration (re-up), los seed se vuelven a crear
 * con `findFirstRecordByFilter` evitando duplicados por nombre.
 *
 * Placeholders disponibles:
 *   {{customer_name}}, {{project_name}}, {{order_number}},
 *   {{total}}, {{paid}}, {{saldo}}, {{delivery_date}}
 */

migrate((app) => {
  const collection = app.findCollectionByNameOrId("whatsapp_templates");

  // Usamos escapes Unicode (¡, ñ, \u{1F44B}, \u{1F4B0}) para evitar
  // problemas de codificacion al persistir desde el editor/git/docker.
  const seeds = [
    {
      name: "Saludo inicial",
      applies_to: "any",
      body: "¡Hola {{customer_name}}! \u{1F44B}",
    },
    {
      name: "Pedido listo para retirar",
      applies_to: "order",
      body:
        "¡Hola {{customer_name}}! Tu pedido *{{project_name}}* ya esta listo para retirar. " +
        "Cuando puedas pasamos a coordinar. \u{1F4E6}",
    },
    {
      name: "Recordatorio de pago",
      applies_to: "order",
      body:
        "Hola {{customer_name}}, te recuerdo que el saldo de *{{project_name}}* es {{saldo}}. " +
        "¡Gracias! \u{1F4B0}",
    },
  ];

  for (const seed of seeds) {
    // Idempotente: si ya existe por nombre, lo skipeamos
    let existing = null;
    try {
      existing = app.findFirstRecordByFilter(
        "whatsapp_templates",
        "name = {:n}",
        { n: seed.name },
      );
    } catch (_) {
      existing = null;
    }
    if (existing) continue;

    const record = new Record(collection);
    record.set("name", seed.name);
    record.set("body", seed.body);
    record.set("applies_to", seed.applies_to);
    app.save(record);
  }
}, (app) => {
  // Down: borrar los 3 templates por nombre (solo los nuestros, no los que el
  // usuario haya agregado a mano).
  const names = ["Saludo inicial", "Pedido listo para retirar", "Recordatorio de pago"];
  for (const name of names) {
    try {
      const r = app.findFirstRecordByFilter("whatsapp_templates", "name = {:n}", { n: name });
      app.delete(r);
    } catch (_) {
      // ya borrado o no existia
    }
  }
});
