/// <reference path="../pb_data/types.d.ts" />

/**
 * Agrega campo `client` (relation a clients, opcional) a `orders` y
 * `supply_sales`.
 *
 * IMPORTANTE: mantenemos los campos planos `customer_name` y
 * `customer_whatsapp` en ambas colecciones. NO los reemplazamos por
 * la relation. Razon: son SNAPSHOT historico — si el cliente cambia
 * su nombre o telefono, los pedidos viejos deben conservar lo que
 * decian en su momento.
 *
 * cascadeDelete: false — si borras un cliente, los pedidos no se
 * borran (el snapshot sigue intacto, solo se desvincula).
 */

migrate((app) => {
  const clients = app.findCollectionByNameOrId("clients");

  // ── orders ──
  const orders = app.findCollectionByNameOrId("orders");
  orders.fields.add(
    new Field({
      type: "relation",
      name: "client",
      required: false,
      collectionId: clients.id,
      cascadeDelete: false,
      maxSelect: 1,
    }),
  );
  orders.indexes = [
    ...orders.indexes,
    "CREATE INDEX idx_orders_client ON orders (client)",
  ];
  app.save(orders);

  // ── supply_sales ──
  const supplySales = app.findCollectionByNameOrId("supply_sales");
  supplySales.fields.add(
    new Field({
      type: "relation",
      name: "client",
      required: false,
      collectionId: clients.id,
      cascadeDelete: false,
      maxSelect: 1,
    }),
  );
  supplySales.indexes = [
    ...supplySales.indexes,
    "CREATE INDEX idx_supply_sales_client ON supply_sales (client)",
  ];
  app.save(supplySales);
}, (app) => {
  const orders = app.findCollectionByNameOrId("orders");
  orders.fields.removeByName("client");
  orders.indexes = orders.indexes.filter(
    (idx) => !idx.includes("idx_orders_client"),
  );
  app.save(orders);

  const supplySales = app.findCollectionByNameOrId("supply_sales");
  supplySales.fields.removeByName("client");
  supplySales.indexes = supplySales.indexes.filter(
    (idx) => !idx.includes("idx_supply_sales_client"),
  );
  app.save(supplySales);
});
