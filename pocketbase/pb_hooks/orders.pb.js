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
