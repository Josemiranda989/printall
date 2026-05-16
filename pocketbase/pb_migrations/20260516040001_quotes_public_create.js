/// <reference path="../pb_data/types.d.ts" />

/**
 * Permite que el endpoint publico /api/quote-request cree quotes sin auth.
 *
 * Solo abre createRule. List/view/update/delete siguen siendo admin-only.
 *
 * Restricciones aplicadas en la rule:
 *  - status debe ser "pending" (el publico no puede crear quotes ya aprobadas)
 *  - unit_price debe ser 0 (el admin pone el precio al revisar)
 *  - converted_order_id vacio
 *
 * La proteccion contra spam la hace el endpoint con rate limit por IP.
 */

migrate((app) => {
  const collection = app.findCollectionByNameOrId("quotes");
  collection.createRule =
    'status = "pending" && unit_price = 0 && (converted_order_id = "" || converted_order_id = null)';
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("quotes");
  collection.createRule = null;
  app.save(collection);
});
