/// <reference path="../pb_data/types.d.ts" />

/**
 * Hooks de mantenimiento de la relacion `client` en `orders` y `supply_sales`.
 *
 * En cada create/update: resuelve (o crea) el client correspondiente a
 * (customer_name, customer_whatsapp) y lo setea en el campo `client`.
 *
 * Matching:
 *  - Si customer_whatsapp tiene digitos → busca por whatsapp_norm.
 *  - Si no → busca por name_norm (lowercase + sin tildes + trim).
 *
 * Si no existe ningun client matcheable → se crea uno nuevo.
 *
 * LIMITACION DEL JSVM POOL: funciones top-level NO son visibles en los
 * callbacks. Toda la logica (normalizacion + lookup + create) va INLINE
 * en cada hook. Hay duplicacion entre orders y supply_sales — aceptado
 * por simplicidad. NO factorizar al top-level: explota con ReferenceError.
 */

// ─── ORDERS: create ───
onRecordCreateRequest((e) => {
  try {
    const name = String(e.record.get("customer_name") || "").trim();
    const whatsapp = String(e.record.get("customer_whatsapp") || "").trim();
    if (!name && !whatsapp) {
      e.next();
      return;
    }

    const wnorm = whatsapp.replace(/\D/g, "");
    const diacritics = new RegExp("[\\u0300-\\u036f]", "g");
    const nnorm = name
      .normalize("NFD")
      .replace(diacritics, "")
      .toLowerCase()
      .replace(/\s+/g, " ");

    // Buscar client existente
    let client = null;
    try {
      if (wnorm) {
        client = e.app.findFirstRecordByFilter(
          "clients",
          "whatsapp_norm = {:w}",
          { w: wnorm },
        );
      } else if (nnorm) {
        client = e.app.findFirstRecordByFilter(
          "clients",
          "name_norm = {:n} && (whatsapp_norm = '' || whatsapp_norm = null)",
          { n: nnorm },
        );
      }
    } catch (_) {
      client = null;
    }

    // Crear si no existe
    if (!client) {
      const clients = e.app.findCollectionByNameOrId("clients");
      const record = new Record(clients);
      record.set("name", name || "(sin nombre)");
      record.set("whatsapp", whatsapp);
      record.set("whatsapp_norm", wnorm);
      record.set("name_norm", nnorm);
      record.set("notes", "");
      e.app.save(record);
      client = record;
    }

    e.record.set("client", client.id);
  } catch (err) {
    console.log("[clients.pb.js] orders create hook failed:", err);
  }

  e.next();
}, "orders");

// ─── ORDERS: update ───
onRecordUpdateRequest((e) => {
  try {
    const name = String(e.record.get("customer_name") || "").trim();
    const whatsapp = String(e.record.get("customer_whatsapp") || "").trim();
    if (!name && !whatsapp) {
      e.next();
      return;
    }

    // Si los datos del cliente no cambiaron, no reresolver — evita lookups
    // innecesarios en updates que solo tocan status/paid/progress.
    try {
      const original = e.record.original();
      const origName = String(original.get("customer_name") || "").trim();
      const origWa = String(original.get("customer_whatsapp") || "").trim();
      const hasClient = !!e.record.get("client");
      if (origName === name && origWa === whatsapp && hasClient) {
        e.next();
        return;
      }
    } catch (_) {
      // Si original() no disponible, seguimos con la resolucion
    }

    const wnorm = whatsapp.replace(/\D/g, "");
    const diacritics = new RegExp("[\\u0300-\\u036f]", "g");
    const nnorm = name
      .normalize("NFD")
      .replace(diacritics, "")
      .toLowerCase()
      .replace(/\s+/g, " ");

    let client = null;
    try {
      if (wnorm) {
        client = e.app.findFirstRecordByFilter(
          "clients",
          "whatsapp_norm = {:w}",
          { w: wnorm },
        );
      } else if (nnorm) {
        client = e.app.findFirstRecordByFilter(
          "clients",
          "name_norm = {:n} && (whatsapp_norm = '' || whatsapp_norm = null)",
          { n: nnorm },
        );
      }
    } catch (_) {
      client = null;
    }

    if (!client) {
      const clients = e.app.findCollectionByNameOrId("clients");
      const record = new Record(clients);
      record.set("name", name || "(sin nombre)");
      record.set("whatsapp", whatsapp);
      record.set("whatsapp_norm", wnorm);
      record.set("name_norm", nnorm);
      record.set("notes", "");
      e.app.save(record);
      client = record;
    }

    e.record.set("client", client.id);
  } catch (err) {
    console.log("[clients.pb.js] orders update hook failed:", err);
  }

  e.next();
}, "orders");

// ─── SUPPLY_SALES: create ───
onRecordCreateRequest((e) => {
  try {
    const name = String(e.record.get("customer_name") || "").trim();
    const whatsapp = String(e.record.get("customer_whatsapp") || "").trim();
    if (!name && !whatsapp) {
      e.next();
      return;
    }

    const wnorm = whatsapp.replace(/\D/g, "");
    const diacritics = new RegExp("[\\u0300-\\u036f]", "g");
    const nnorm = name
      .normalize("NFD")
      .replace(diacritics, "")
      .toLowerCase()
      .replace(/\s+/g, " ");

    let client = null;
    try {
      if (wnorm) {
        client = e.app.findFirstRecordByFilter(
          "clients",
          "whatsapp_norm = {:w}",
          { w: wnorm },
        );
      } else if (nnorm) {
        client = e.app.findFirstRecordByFilter(
          "clients",
          "name_norm = {:n} && (whatsapp_norm = '' || whatsapp_norm = null)",
          { n: nnorm },
        );
      }
    } catch (_) {
      client = null;
    }

    if (!client) {
      const clients = e.app.findCollectionByNameOrId("clients");
      const record = new Record(clients);
      record.set("name", name || "(sin nombre)");
      record.set("whatsapp", whatsapp);
      record.set("whatsapp_norm", wnorm);
      record.set("name_norm", nnorm);
      record.set("notes", "");
      e.app.save(record);
      client = record;
    }

    e.record.set("client", client.id);
  } catch (err) {
    console.log("[clients.pb.js] supply_sales create hook failed:", err);
  }

  e.next();
}, "supply_sales");

// ─── SUPPLY_SALES: update ───
onRecordUpdateRequest((e) => {
  try {
    const name = String(e.record.get("customer_name") || "").trim();
    const whatsapp = String(e.record.get("customer_whatsapp") || "").trim();
    if (!name && !whatsapp) {
      e.next();
      return;
    }

    try {
      const original = e.record.original();
      const origName = String(original.get("customer_name") || "").trim();
      const origWa = String(original.get("customer_whatsapp") || "").trim();
      const hasClient = !!e.record.get("client");
      if (origName === name && origWa === whatsapp && hasClient) {
        e.next();
        return;
      }
    } catch (_) {
      // continuar
    }

    const wnorm = whatsapp.replace(/\D/g, "");
    const diacritics = new RegExp("[\\u0300-\\u036f]", "g");
    const nnorm = name
      .normalize("NFD")
      .replace(diacritics, "")
      .toLowerCase()
      .replace(/\s+/g, " ");

    let client = null;
    try {
      if (wnorm) {
        client = e.app.findFirstRecordByFilter(
          "clients",
          "whatsapp_norm = {:w}",
          { w: wnorm },
        );
      } else if (nnorm) {
        client = e.app.findFirstRecordByFilter(
          "clients",
          "name_norm = {:n} && (whatsapp_norm = '' || whatsapp_norm = null)",
          { n: nnorm },
        );
      }
    } catch (_) {
      client = null;
    }

    if (!client) {
      const clients = e.app.findCollectionByNameOrId("clients");
      const record = new Record(clients);
      record.set("name", name || "(sin nombre)");
      record.set("whatsapp", whatsapp);
      record.set("whatsapp_norm", wnorm);
      record.set("name_norm", nnorm);
      record.set("notes", "");
      e.app.save(record);
      client = record;
    }

    e.record.set("client", client.id);
  } catch (err) {
    console.log("[clients.pb.js] supply_sales update hook failed:", err);
  }

  e.next();
}, "supply_sales");
