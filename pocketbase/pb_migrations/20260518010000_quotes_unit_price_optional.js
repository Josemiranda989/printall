/// <reference path="../pb_data/types.d.ts" />

/**
 * Hace `unit_price` opcional en quotes para que el endpoint público
 * /api/quote-request pueda crear cotizaciones sin precio (el admin lo
 * pone después al revisar).
 *
 * Contexto: PB 0.37 trata `number required:true` con valor 0 como
 * `validation_required` ("Cannot be blank."). Eso rompía el endpoint
 * público que enviaba `unit_price: 0` esperando que el admin lo cargara
 * después.
 *
 * También ajusta la createRule: antes requería `unit_price = 0` para
 * impedir que el público creara cotizaciones con precio inflado. Ahora
 * lo flexibilizamos a "unit_price = 0 o vacío", que cubre tanto el
 * payload del endpoint como ausencia total del campo.
 */

migrate((app) => {
  const collection = app.findCollectionByNameOrId("quotes");

  // Field: unit_price required → false
  const field = collection.fields.getByName("unit_price");
  if (field) {
    field.required = false;
    app.save(collection);
  }

  // Rule: aceptar también unit_price vacío/null
  collection.createRule =
    '(unit_price = 0 || unit_price = null) && status = "pending" && (converted_order_id = "" || converted_order_id = null)';
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("quotes");

  const field = collection.fields.getByName("unit_price");
  if (field) {
    field.required = true;
    app.save(collection);
  }

  collection.createRule =
    'status = "pending" && unit_price = 0 && (converted_order_id = "" || converted_order_id = null)';
  app.save(collection);
});
