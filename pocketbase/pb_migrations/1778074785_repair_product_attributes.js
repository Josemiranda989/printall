/// <reference path="../pb_data/types.d.ts" />

// Migration de reparación: la 1778074417_create_product_attributes corrió con
// un bug en JSVM (Object.entries sobre []byte de Go en vez de objeto parseado),
// dejando records con keys "0","1","2"... y values con bytes ASCII del JSON original.
// Este parche borra los records corruptos y repuebla con los attributes correctos
// reconstruidos a partir de los bytes capturados (verificados manualmente).

migrate((app) => {
  // 1) Borrar TODOS los records actuales de product_attributes (todos están corruptos).
  const all = app.findAllRecords("product_attributes");
  for (const r of all) {
    app.delete(r);
  }

  // 2) Re-poblar con la data verificada del filamento PLA (id `z7u54dbk8l9rixp`).
  // El otro producto cargado (organizador, id `piaciqg4yknnuzd`) tenía attributes nulo,
  // así que no necesita records.
  const attrs = app.findCollectionByNameOrId("product_attributes");
  const filamento = [
    { key: "color", value: "negro" },
    { key: "diametro_mm", value: "1.75" },
    { key: "marca", value: "3Nmax" },
    { key: "peso_kg", value: "1" },
  ];
  filamento.forEach((entry, i) => {
    const rec = new Record(attrs);
    rec.set("product", "z7u54dbk8l9rixp");
    rec.set("key", entry.key);
    rec.set("value", entry.value);
    rec.set("order", i);
    app.save(rec);
  });
}, (app) => {
  // Down: no podemos restaurar el estado corrupto (ni queremos). Lo dejamos como no-op.
});
