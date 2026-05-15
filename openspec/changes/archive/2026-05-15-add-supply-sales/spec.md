# Spec: add-supply-sales

## REQ-01: expansión del enum `kind` de materials

El campo `kind` de la colección `materials` MUST admitir los valores nuevos
`adhesive` y `accessory`, además de los existentes `filament` y `component`.
La expansión MUST ser aditiva — los valores existentes SHALL conservarse.

**Given** un material existente con `kind = "filament"`
**When** se aplica la migración de expansión del enum
**Then** el record conserva su `kind` sin cambios

**Given** el formulario de alta de material
**When** el usuario abre el selector de tipo
**Then** las opciones incluyen filamento, componente, adhesivo y accesorio

## REQ-02: colección `supply_sales`

La colección `supply_sales` MUST existir con los campos: `customer_name`
(text, required), `customer_whatsapp` (text), `item` (relation a `materials`,
required, maxSelect 1), `quantity` (number int, min 1, required), `unit_price`
(number, min 0, required), `status` (select, required), `is_paid` (bool),
`sale_date` (date, required), `delivery_date` (date), `notes` (text),
`created` y `updated` (autodate).

**Given** un intento de crear una venta de insumo sin `item`
**When** se guarda el record
**Then** PocketBase rechaza la operación por campo requerido

**Given** un intento de crear una venta con `quantity = 0`
**When** se guarda el record
**Then** PocketBase rechaza la operación por violar `min 1`

## REQ-03: ciclo de vida de la venta

El campo `status` de `supply_sales` MUST aceptar únicamente los valores
`reservado`, `entregado` y `cancelado`. Al crear un record sin `status`
explícito, el hook SHALL asignar `reservado` por defecto. El campo `is_paid`
MUST ser independiente de `status` — una venta puede estar `entregado` sin
estar pagada, o pagada sin estar `entregado` (seña).

**Given** una venta de insumo creada sin `status`
**When** el hook `onRecordCreateRequest` procesa el record
**Then** el `status` resultante es `reservado`

**Given** una venta con `status = "entregado"` e `is_paid = false`
**When** se guarda el record
**Then** la operación es válida — los dos campos son ortogonales

## REQ-04: snapshot del precio

El campo `unit_price` de `supply_sales` MUST persistirse en el record y NO
derivarse en lectura desde `materials.sell_price`. El formulario de admin
SHOULD autocompletar `unit_price` con el `sell_price` actual del material
elegido, pero el valor MUST quedar editable y fijado al momento de la venta.

**Given** un material con `sell_price = 1000` y una venta registrada con ese precio
**When** luego se actualiza `materials.sell_price` a `1500`
**Then** la venta previa conserva `unit_price = 1000`

## REQ-05: reporting unificado de ventas

El reporting MUST unir las ventas de `orders` (impresiones) y `supply_sales`
(insumos) en una estructura común (`tipo`, `concepto`, `customer_name`,
`total`, `is_paid`, `fecha`). La unión MUST resolverse en la capa de
aplicación mediante un helper en `lib/` — NO mediante una PocketBase view
collection, porque el parser de view queries de PocketBase no soporta `UNION`.
Los registros cancelados (`cancelled` / `cancelado`) MUST excluirse. El
`total` SHALL calcularse como `unit_price * units_ordered` para impresiones y
`unit_price * quantity` para insumos.

**Given** una orden de impresión y una venta de insumo, ninguna cancelada
**When** se invoca el helper de reporting
**Then** devuelve ambos registros normalizados con su `total` calculado

**Given** una venta de insumo con `status = "cancelado"`
**When** se invoca el helper de reporting
**Then** ese registro no aparece en el resultado

## REQ-06: admin CRUD de insumos

La ruta `/admin/insumos` MUST permitir listar, crear, editar y eliminar
records de `supply_sales`, siguiendo el patrón de las secciones de admin
existentes (auth por cookie httpOnly, `Astro.locals.adminPB`).

**Given** un admin autenticado en `/admin/insumos/nuevo`
**When** envía el formulario con datos válidos
**Then** se crea el record y redirige al listado

## REQ-07: reporte de facturación por rango de fechas

La sección de reporte MUST usar el helper de reporting unificado y permitir
filtrar por rango de fechas, mostrando el total facturado (suma de `total`)
del período, discriminando por `tipo` (impresión / insumo).

**Given** ventas registradas en distintas fechas
**When** el admin filtra por un rango de fechas específico
**Then** el reporte suma solo los `total` de los registros dentro del rango
