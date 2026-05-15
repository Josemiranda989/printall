/// <reference path="../pb_data/types.d.ts" />

/**
 * Sincronizacion payments → target (order o sale).
 *
 * Cuando se crea/actualiza/borra un payment, recalculamos:
 *  - Para orders: paid_amount = SUM(payments.amount) clamped al rango [0, total].
 *  - Para sales: is_paid = (SUM(payments.amount) >= total).
 *
 * LIMITACION JSVM POOL: funciones top-level NO son visibles en callbacks.
 * Toda la logica de recalculo va INLINE en cada hook. Duplicacion aceptada.
 *
 * IMPORTANTE: la sincronizacion modifica el record target, que a su vez puede
 * disparar el hook de Notion (en orders). Eso es deseado — Notion debe quedar
 * sincronizado con el monto pagado real.
 */

// ─── PAYMENT CREATE ───
onRecordAfterCreateSuccess((e) => {
  try {
    const targetType = e.record.get("target_type");
    const targetId = e.record.get("target_id");
    if (!targetType || !targetId) {
      e.next();
      return;
    }

    if (targetType === "order") {
      // Sumar todos los payments del order y actualizar paid_amount
      let sum = 0;
      try {
        const all = e.app.findRecordsByFilter(
          "payments",
          "target_type = 'order' && target_id = {:i}",
          { i: targetId },
          "created",
          1000,
          0,
        );
        for (const p of all) {
          sum += Number(p.get("amount")) || 0;
        }
      } catch (err) {
        console.log("[payments.pb.js] error sumando payments:", err);
      }

      try {
        const order = e.app.findRecordById("orders", targetId);
        const total =
          (Number(order.get("unit_price")) || 0) *
          (Number(order.get("units_ordered")) || 0);
        const clamped = Math.max(0, Math.min(sum, total));
        order.set("paid_amount", clamped);
        order.set("is_paid", clamped >= total && total > 0);
        e.app.save(order);
      } catch (err) {
        console.log("[payments.pb.js] error actualizando order:", err);
      }
    } else if (targetType === "sale") {
      let sum = 0;
      try {
        const all = e.app.findRecordsByFilter(
          "payments",
          "target_type = 'sale' && target_id = {:i}",
          { i: targetId },
          "created",
          1000,
          0,
        );
        for (const p of all) {
          sum += Number(p.get("amount")) || 0;
        }
      } catch (err) {
        console.log("[payments.pb.js] error sumando payments sale:", err);
      }

      try {
        const sale = e.app.findRecordById("supply_sales", targetId);
        const total =
          (Number(sale.get("unit_price")) || 0) *
          (Number(sale.get("quantity")) || 0);
        sale.set("is_paid", sum >= total && total > 0);
        e.app.save(sale);
      } catch (err) {
        console.log("[payments.pb.js] error actualizando sale:", err);
      }
    }
  } catch (err) {
    console.log("[payments.pb.js] create hook crashed:", err);
  }

  e.next();
}, "payments");

// ─── PAYMENT UPDATE ───
onRecordAfterUpdateSuccess((e) => {
  try {
    const targetType = e.record.get("target_type");
    const targetId = e.record.get("target_id");
    if (!targetType || !targetId) {
      e.next();
      return;
    }

    if (targetType === "order") {
      let sum = 0;
      try {
        const all = e.app.findRecordsByFilter(
          "payments",
          "target_type = 'order' && target_id = {:i}",
          { i: targetId },
          "created",
          1000,
          0,
        );
        for (const p of all) {
          sum += Number(p.get("amount")) || 0;
        }
      } catch (err) {
        console.log("[payments.pb.js] update sum order error:", err);
      }
      try {
        const order = e.app.findRecordById("orders", targetId);
        const total =
          (Number(order.get("unit_price")) || 0) *
          (Number(order.get("units_ordered")) || 0);
        const clamped = Math.max(0, Math.min(sum, total));
        order.set("paid_amount", clamped);
        order.set("is_paid", clamped >= total && total > 0);
        e.app.save(order);
      } catch (err) {
        console.log("[payments.pb.js] update order error:", err);
      }
    } else if (targetType === "sale") {
      let sum = 0;
      try {
        const all = e.app.findRecordsByFilter(
          "payments",
          "target_type = 'sale' && target_id = {:i}",
          { i: targetId },
          "created",
          1000,
          0,
        );
        for (const p of all) {
          sum += Number(p.get("amount")) || 0;
        }
      } catch (err) {
        console.log("[payments.pb.js] update sum sale error:", err);
      }
      try {
        const sale = e.app.findRecordById("supply_sales", targetId);
        const total =
          (Number(sale.get("unit_price")) || 0) *
          (Number(sale.get("quantity")) || 0);
        sale.set("is_paid", sum >= total && total > 0);
        e.app.save(sale);
      } catch (err) {
        console.log("[payments.pb.js] update sale error:", err);
      }
    }
  } catch (err) {
    console.log("[payments.pb.js] update hook crashed:", err);
  }

  e.next();
}, "payments");

// ─── PAYMENT DELETE ───
// Se dispara DESPUES de borrar, por lo que el record ya no esta en la query.
// Usamos los datos del record (que sigue accesible en e.record) para saber a
// quien recalcular.
onRecordAfterDeleteSuccess((e) => {
  try {
    const targetType = e.record.get("target_type");
    const targetId = e.record.get("target_id");
    if (!targetType || !targetId) {
      e.next();
      return;
    }

    if (targetType === "order") {
      let sum = 0;
      try {
        const all = e.app.findRecordsByFilter(
          "payments",
          "target_type = 'order' && target_id = {:i}",
          { i: targetId },
          "created",
          1000,
          0,
        );
        for (const p of all) {
          sum += Number(p.get("amount")) || 0;
        }
      } catch (err) {
        console.log("[payments.pb.js] delete sum order error:", err);
      }
      try {
        const order = e.app.findRecordById("orders", targetId);
        const total =
          (Number(order.get("unit_price")) || 0) *
          (Number(order.get("units_ordered")) || 0);
        const clamped = Math.max(0, Math.min(sum, total));
        order.set("paid_amount", clamped);
        order.set("is_paid", clamped >= total && total > 0);
        e.app.save(order);
      } catch (err) {
        console.log("[payments.pb.js] delete order error:", err);
      }
    } else if (targetType === "sale") {
      let sum = 0;
      try {
        const all = e.app.findRecordsByFilter(
          "payments",
          "target_type = 'sale' && target_id = {:i}",
          { i: targetId },
          "created",
          1000,
          0,
        );
        for (const p of all) {
          sum += Number(p.get("amount")) || 0;
        }
      } catch (err) {
        console.log("[payments.pb.js] delete sum sale error:", err);
      }
      try {
        const sale = e.app.findRecordById("supply_sales", targetId);
        const total =
          (Number(sale.get("unit_price")) || 0) *
          (Number(sale.get("quantity")) || 0);
        sale.set("is_paid", sum >= total && total > 0);
        e.app.save(sale);
      } catch (err) {
        console.log("[payments.pb.js] delete sale error:", err);
      }
    }
  } catch (err) {
    console.log("[payments.pb.js] delete hook crashed:", err);
  }

  e.next();
}, "payments");
