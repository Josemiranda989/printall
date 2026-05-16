/// <reference path="../pb_data/types.d.ts" />

/**
 * Agrega campo `attachments` (file multi) a orders. Usado para subir STL,
 * fotos de referencia, recibos de pago, etc.
 *
 * Limites:
 *  - 10 archivos por pedido
 *  - 10 MB cada uno
 *  - Mime types permitidos: imagenes, PDFs y STL/3MF/OBJ
 */

migrate((app) => {
  const collection = app.findCollectionByNameOrId("orders");
  collection.fields.add(
    new Field({
      type: "file",
      name: "attachments",
      required: false,
      maxSelect: 10,
      maxSize: 10485760, // 10 MB
      mimeTypes: [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "application/pdf",
        "model/stl",
        "application/sla",
        "application/octet-stream", // STL/3MF muchas veces se sirven así
        "application/vnd.ms-pki.stl",
        "model/3mf",
        "application/vnd.ms-package.3dmanufacturing-3dmodel+xml",
      ],
    }),
  );
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("orders");
  collection.fields.removeByName("attachments");
  app.save(collection);
});
