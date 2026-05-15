/// <reference path="../pb_data/types.d.ts" />

/**
 * Backfill: crea un registro en `clients` por cada cliente unico que
 * aparece en `orders` o `supply_sales`, y linkea cada pedido/venta a
 * su client.
 *
 * Estrategia de matching:
 *  - Si customer_whatsapp tiene digitos → key = whatsapp_norm
 *  - Si no → key = name_norm (lowercase, trim, sin tildes)
 *
 * Si dos pedidos comparten la misma key → mismo cliente.
 *
 * Notas operativas:
 *  - El hook de Notion (orders.pb.js) NO incluye `client` en businessFields,
 *    asi que setear ese campo NO dispara sync a Notion.
 *  - Funciones inline (sin top-level helpers) — consistencia con la limitacion
 *    del JSVM pool en hooks. Aca tecnicamente no hace falta porque la migration
 *    corre en un solo runtime, pero mantenemos el patron por defensa.
 */

migrate((app) => {
  const clients = app.findCollectionByNameOrId("clients");

  // Cache en memoria: key → client record (para no reconsultar la DB en cada pedido)
  const clientByKey = {};

  // ── Helpers inline ──
  function normWhatsapp(raw) {
    if (!raw) return "";
    return String(raw).replace(/\D/g, "");
  }
  function normName(raw) {
    if (!raw) return "";
    // Quita tildes/diacriticos (rango U+0300 a U+036F).
    // Usamos RegExp constructor con escape para evitar problemas de encoding
    // en el source file segun el editor.
    const diacritics = new RegExp("[\\u0300-\\u036f]", "g");
    return String(raw)
      .normalize("NFD")
      .replace(diacritics, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
  }
  function getOrCreateClient(name, whatsapp) {
    const wnorm = normWhatsapp(whatsapp);
    const nnorm = normName(name);
    const key = wnorm ? "w:" + wnorm : "n:" + nnorm;

    if (clientByKey[key]) {
      return clientByKey[key];
    }

    // Buscar en DB por si ya existe (otra migracion previa o pedido procesado)
    let existing = null;
    try {
      if (wnorm) {
        existing = app.findFirstRecordByFilter(
          "clients",
          "whatsapp_norm = {:w}",
          { w: wnorm },
        );
      } else if (nnorm) {
        existing = app.findFirstRecordByFilter(
          "clients",
          "name_norm = {:n} && (whatsapp_norm = '' || whatsapp_norm = null)",
          { n: nnorm },
        );
      }
    } catch (_) {
      // findFirstRecordByFilter tira si no encuentra — tratamos como null
      existing = null;
    }

    if (existing) {
      clientByKey[key] = existing;
      return existing;
    }

    // Crear nuevo client
    const record = new Record(clients);
    record.set("name", String(name || "").trim() || "(sin nombre)");
    record.set("whatsapp", String(whatsapp || "").trim());
    record.set("whatsapp_norm", wnorm);
    record.set("name_norm", nnorm);
    record.set("notes", "");
    app.save(record);
    clientByKey[key] = record;
    return record;
  }

  // ── Procesar orders en batches ──
  const BATCH = 500;
  let offset = 0;
  while (true) {
    const batch = app.findRecordsByFilter("orders", "", "created", BATCH, offset);
    if (!batch || batch.length === 0) break;

    for (const order of batch) {
      const existingClient = order.get("client");
      if (existingClient) continue; // ya linkeado, saltar

      const name = order.get("customer_name");
      const whatsapp = order.get("customer_whatsapp");
      if (!name && !whatsapp) continue;

      const client = getOrCreateClient(name, whatsapp);
      order.set("client", client.id);
      app.save(order);
    }

    if (batch.length < BATCH) break;
    offset += BATCH;
  }

  // ── Procesar supply_sales en batches ──
  offset = 0;
  while (true) {
    const batch = app.findRecordsByFilter(
      "supply_sales",
      "",
      "created",
      BATCH,
      offset,
    );
    if (!batch || batch.length === 0) break;

    for (const sale of batch) {
      const existingClient = sale.get("client");
      if (existingClient) continue;

      const name = sale.get("customer_name");
      const whatsapp = sale.get("customer_whatsapp");
      if (!name && !whatsapp) continue;

      const client = getOrCreateClient(name, whatsapp);
      sale.set("client", client.id);
      app.save(sale);
    }

    if (batch.length < BATCH) break;
    offset += BATCH;
  }
}, (app) => {
  // ── Down: limpiar `client` en orders/supply_sales y borrar todos los clients ──
  // Riesgoso en prod si el usuario ya edito clients manualmente, pero la down
  // de una migration de backfill es siempre best-effort.

  const BATCH = 500;
  let offset = 0;
  while (true) {
    const batch = app.findRecordsByFilter("orders", "client != ''", "created", BATCH, offset);
    if (!batch || batch.length === 0) break;
    for (const order of batch) {
      order.set("client", "");
      app.save(order);
    }
    if (batch.length < BATCH) break;
    offset += BATCH;
  }

  offset = 0;
  while (true) {
    const batch = app.findRecordsByFilter("supply_sales", "client != ''", "created", BATCH, offset);
    if (!batch || batch.length === 0) break;
    for (const sale of batch) {
      sale.set("client", "");
      app.save(sale);
    }
    if (batch.length < BATCH) break;
    offset += BATCH;
  }

  offset = 0;
  while (true) {
    const batch = app.findRecordsByFilter("clients", "", "created", BATCH, offset);
    if (!batch || batch.length === 0) break;
    for (const client of batch) {
      app.delete(client);
    }
    // No incrementamos offset porque los borrados achican el set
    if (batch.length < BATCH) break;
  }
});
