/// <reference path="../pb_data/types.d.ts" />

/**
 * supply_sales: default de `status` en el alta.
 *
 * Si el alta no trae `status` explicito, se asigna `reservado` — el estado
 * inicial natural de una venta de insumo. Mismo patron que products.pb.js
 * con `stock_status`.
 *
 * El operador `!` es seguro aca: `status` es un select (string). El unico
 * valor "vacio" posible es "", y `!""` es true — exactamente cuando queremos
 * el default. No hay riesgo del bug del `!` sobre bool (caso `published`).
 */

onRecordCreateRequest((e) => {
  if (!e.record.get("status")) {
    e.record.set("status", "reservado");
  }
  e.next();
}, "supply_sales");
