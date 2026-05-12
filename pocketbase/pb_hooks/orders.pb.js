/// <reference path="../pb_data/types.d.ts" />

// === CREATE: autonumeración + defaults seguros ===
//
// IMPORTANTE: el callback se ejecuta en un Goja runtime del pool de hooks
// (--hooksPool, default 15) — funciones definidas en el top-level de este
// archivo NO son visibles dentro del callback. Toda la lógica vive INLINE.
onRecordCreateRequest((e) => {
  try {
    // ── 1) order_number autogenerado solo si llegó vacío ──
    const currentNumber = e.record.get("order_number");
    if (!currentNumber || String(currentNumber).trim() === "") {
      const year = new Date().getFullYear();
      const prefix = year + "-";
      let seq = 1;
      try {
        const recs = e.app.findRecordsByFilter(
          "orders",
          'order_number ~ "' + prefix + '"',
          "-order_number",
          1,
          0,
        );
        if (recs && recs.length > 0) {
          const last = String(recs[0].get("order_number") || "");
          const parts = last.split("-");
          if (parts.length === 2) {
            const parsed = parseInt(parts[1], 10);
            if (!isNaN(parsed) && parsed > 0) {
              seq = parsed + 1;
            }
          }
        }
      } catch (innerErr) {
        // Fallback a 0001 si la consulta falla — el UNIQUE INDEX evita duplicados.
        seq = 1;
      }
      const padded = String(seq);
      const padding = "0000".substring(0, 4 - padded.length);
      e.record.set("order_number", prefix + padding + padded);
    }

    // ── 2) Defaults solo si el campo llegó vacío ──
    if (!e.record.get("status")) {
      e.record.set("status", "pending");
    }
    if (!e.record.get("priority")) {
      e.record.set("priority", "medium");
    }
    if (e.record.get("units_ordered") == null || e.record.get("units_ordered") === 0) {
      e.record.set("units_ordered", 1);
    }
    if (e.record.get("units_done") == null) {
      e.record.set("units_done", 0);
    }
    if (e.record.get("is_paid") == null) {
      e.record.set("is_paid", false);
    }
    if (!e.record.get("order_date")) {
      e.record.set("order_date", new Date().toISOString());
    }
  } catch (err) {
    // Sin este log, un crash del hook devuelve HTTP 400 con body vacío
    // y el error queda invisible. Lo mantenemos para diagnóstico futuro.
    console.log("[orders.pb.js] hook crashed:", err);
    throw err;
  }

  e.next();
}, "orders");

// === SYNC A NOTION (after create + after update) ===
//
// Estrategia:
//  - onRecordAfterCreateSuccess crea la página en Notion y guarda el page id en el record.
//  - onRecordAfterUpdateSuccess actualiza la página existente (PATCH) usando el page id.
//  - Si NOTION_TOKEN no está configurado, el sync se skipea silenciosamente.
//  - Si Notion falla, log + return — NO afecta la creación/edición en PocketBase.
//
// LIMITACIÓN del JSVM: como las funciones / constantes top-level NO son visibles
// en el pool de runtimes, TODA la lógica del sync (mappers, database_id, http, etc)
// está INLINE en cada hook. Hay duplicación entre los dos handlers — aceptado
// por simplicidad. NO subir nada al top-level: explota con ReferenceError.

// CREATE → POST a Notion
onRecordAfterCreateSuccess((e) => {
  try {
    const token = $os.getenv("NOTION_TOKEN");
    if (!token) {
      e.next();
      return;
    }

    const order = e.record;

    // Mappers PB → Notion
    const MATERIAL_MAP = {
      pla: "PLA", abs: "ABS", petg: "PETG", tpu: "TPU",
      nylon: "Nylon", asa: "ASA", pc: "PC (Policarbonato)", hips: "HIPS",
    };
    const COLOR_MAP = {
      blanco: "Blanco", negro: "Negro", gris: "Gris", azul: "Azul",
      rojo: "Rojo", verde: "Verde", amarillo: "Amarillo", naranja: "Naranja",
      morado: "Morado", transparente: "Transparente", celeste: "Celeste",
    };
    const PRIORITY_MAP = { high: "Alta", medium: "Media", low: "Baja" };
    const STATUS_MAP = {
      pending: "Pendiente", in_progress: "En proceso", completed: "Completado",
      delivered: "Entregado", cancelled: "Cancelado",
    };

    const unitsOrdered = Number(order.get("units_ordered")) || 0;
    const unitsDone = Number(order.get("units_done")) || 0;
    // Notion percent es float 0-1 (0.7 = 70%)
    const progress = unitsOrdered > 0 ? Math.round((unitsDone / unitsOrdered) * 100) / 100 : 0;

    const properties = {
      "Nombre del Proyecto": {
        title: [{ text: { content: String(order.get("project_name") || "") } }],
      },
      "Cliente": {
        rich_text: [{ text: { content: String(order.get("customer_name") || "") } }],
      },
      "Material": { select: { name: MATERIAL_MAP[order.get("material")] || "PLA" } },
      "Color": { select: { name: COLOR_MAP[order.get("color")] || "Negro" } },
      "Prioridad": { select: { name: PRIORITY_MAP[order.get("priority")] || "Media" } },
      "Estado": { status: { name: STATUS_MAP[order.get("status")] || "Pendiente" } },
      "Pagado": { checkbox: !!order.get("is_paid") },
      "Precio": { number: Number(order.get("unit_price")) || 0 },
      "Total": { number: unitsOrdered },
      "Ok": { number: unitsDone },
      "Progreso": { number: progress },
      "Notas": {
        rich_text: [{ text: { content: String(order.get("notes") || "") } }],
      },
    };

    // Pedido (datetime)
    const orderDate = order.get("order_date");
    if (orderDate) {
      const d = new Date(orderDate);
      if (!isNaN(d.getTime())) {
        properties["Pedido"] = { date: { start: d.toISOString() } };
      }
    }
    // Entrega (date sin time)
    const deliveryDate = order.get("delivery_date");
    if (deliveryDate) {
      const d = new Date(deliveryDate);
      if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        properties["Entrega"] = { date: { start: yyyy + "-" + mm + "-" + dd } };
      }
    }

    const body = JSON.stringify({
      parent: { database_id: "2a2a0601b3688033934df6357eb82da2" },
      properties: properties,
    });

    const res = $http.send({
      url: "https://api.notion.com/v1/pages",
      method: "POST",
      body: body,
      headers: {
        "Authorization": "Bearer " + token,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      timeout: 10,
    });

    if (res.statusCode >= 400) {
      console.log("[orders.pb.js] Notion create failed:", res.statusCode, res.raw);
      e.next();
      return;
    }

    // Parsear respuesta y guardar el page id en el record (sin disparar hooks)
    try {
      const data = JSON.parse(res.raw);
      const newPageId = data.id;
      if (newPageId) {
        e.record.set("notion_page_id", newPageId);
        e.app.save(e.record);
        console.log("[orders.pb.js] Notion page created:", newPageId);
      }
    } catch (parseErr) {
      console.log("[orders.pb.js] Failed to parse Notion response:", parseErr);
    }
  } catch (err) {
    console.log("[orders.pb.js] Notion create exception:", err);
  }

  e.next();
}, "orders");

// UPDATE → PATCH a Notion (o POST si no hay page id todavía)
onRecordAfterUpdateSuccess((e) => {
  try {
    const token = $os.getenv("NOTION_TOKEN");
    if (!token) {
      e.next();
      return;
    }

    const order = e.record;

    // Si el ÚNICO cambio respecto al snapshot original es notion_page_id,
    // este update vino del propio hook (después de crear la página) — skipear
    // para no disparar un PATCH innecesario con datos idénticos.
    try {
      const original = order.original();
      const businessFields = [
        "project_name", "customer_name", "customer_whatsapp",
        "material", "color", "priority", "status", "is_paid",
        "unit_price", "units_ordered", "units_done",
        "order_date", "delivery_date", "notes",
      ];
      let businessChanged = false;
      for (let i = 0; i < businessFields.length; i++) {
        const f = businessFields[i];
        if (String(original.get(f) || "") !== String(order.get(f) || "")) {
          businessChanged = true;
          break;
        }
      }
      if (!businessChanged) {
        e.next();
        return;
      }
    } catch (origErr) {
      // Si original() no está disponible, seguimos con el sync (peor caso: 1 PATCH extra)
      console.log("[orders.pb.js] original() not available, proceeding:", origErr);
    }

    const notionPageId = String(order.get("notion_page_id") || "").trim();

    // Mappers PB → Notion (duplicados del create — limitación del JSVM pool)
    const MATERIAL_MAP = {
      pla: "PLA", abs: "ABS", petg: "PETG", tpu: "TPU",
      nylon: "Nylon", asa: "ASA", pc: "PC (Policarbonato)", hips: "HIPS",
    };
    const COLOR_MAP = {
      blanco: "Blanco", negro: "Negro", gris: "Gris", azul: "Azul",
      rojo: "Rojo", verde: "Verde", amarillo: "Amarillo", naranja: "Naranja",
      morado: "Morado", transparente: "Transparente", celeste: "Celeste",
    };
    const PRIORITY_MAP = { high: "Alta", medium: "Media", low: "Baja" };
    const STATUS_MAP = {
      pending: "Pendiente", in_progress: "En proceso", completed: "Completado",
      delivered: "Entregado", cancelled: "Cancelado",
    };

    const unitsOrdered = Number(order.get("units_ordered")) || 0;
    const unitsDone = Number(order.get("units_done")) || 0;
    const progress = unitsOrdered > 0 ? Math.round((unitsDone / unitsOrdered) * 100) / 100 : 0;

    const properties = {
      "Nombre del Proyecto": {
        title: [{ text: { content: String(order.get("project_name") || "") } }],
      },
      "Cliente": {
        rich_text: [{ text: { content: String(order.get("customer_name") || "") } }],
      },
      "Material": { select: { name: MATERIAL_MAP[order.get("material")] || "PLA" } },
      "Color": { select: { name: COLOR_MAP[order.get("color")] || "Negro" } },
      "Prioridad": { select: { name: PRIORITY_MAP[order.get("priority")] || "Media" } },
      "Estado": { status: { name: STATUS_MAP[order.get("status")] || "Pendiente" } },
      "Pagado": { checkbox: !!order.get("is_paid") },
      "Precio": { number: Number(order.get("unit_price")) || 0 },
      "Total": { number: unitsOrdered },
      "Ok": { number: unitsDone },
      "Progreso": { number: progress },
      "Notas": {
        rich_text: [{ text: { content: String(order.get("notes") || "") } }],
      },
    };

    const orderDate = order.get("order_date");
    if (orderDate) {
      const d = new Date(orderDate);
      if (!isNaN(d.getTime())) {
        properties["Pedido"] = { date: { start: d.toISOString() } };
      }
    }
    const deliveryDate = order.get("delivery_date");
    if (deliveryDate) {
      const d = new Date(deliveryDate);
      if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        properties["Entrega"] = { date: { start: yyyy + "-" + mm + "-" + dd } };
      }
    }

    let url, method, body;

    if (notionPageId) {
      // Update existente
      url = "https://api.notion.com/v1/pages/" + notionPageId;
      method = "PATCH";
      body = JSON.stringify({ properties: properties });
    } else {
      // No tiene page id (probablemente porque el create syncó cuando NOTION_TOKEN
      // no estaba configurado). Crear página nueva ahora.
      url = "https://api.notion.com/v1/pages";
      method = "POST";
      body = JSON.stringify({
        parent: { database_id: "2a2a0601b3688033934df6357eb82da2" },
        properties: properties,
      });
    }

    const res = $http.send({
      url: url,
      method: method,
      body: body,
      headers: {
        "Authorization": "Bearer " + token,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      timeout: 10,
    });

    if (res.statusCode >= 400) {
      console.log("[orders.pb.js] Notion update failed:", res.statusCode, res.raw);
      e.next();
      return;
    }

    // Si fue create (no había page id), guardar el id que devolvió Notion
    if (!notionPageId) {
      try {
        const data = JSON.parse(res.raw);
        const newPageId = data.id;
        if (newPageId) {
          e.record.set("notion_page_id", newPageId);
          e.app.save(e.record);
          console.log("[orders.pb.js] Notion page created (from update):", newPageId);
        }
      } catch (parseErr) {
        console.log("[orders.pb.js] Failed to parse Notion response:", parseErr);
      }
    } else {
      console.log("[orders.pb.js] Notion page updated:", notionPageId);
    }
  } catch (err) {
    console.log("[orders.pb.js] Notion update exception:", err);
  }

  e.next();
}, "orders");
