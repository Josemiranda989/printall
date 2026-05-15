# Design: add-supply-sales

## Decisiones de arquitectura

### 1. Colección separada `supply_sales`, no extender `orders`
`orders` rastrea **producción** de impresiones: `material`, `color`,
`priority`, `units_done` son campos del proceso de fabricación. Una venta de
insumo no tiene color de impresión ni avance. Meterla en `orders` obligaría a
dejar la mitad de los campos en `null` según el caso — señal inequívoca de dos
conceptos distintos forzados en una entidad. Cada cosa en su colección, con su
propio ciclo de vida.

### 2. Reporting unificado en la capa de aplicación, no PocketBase view
La intención original era una **view collection** de PocketBase con `UNION ALL`
de `orders` y `supply_sales`. Se intentó y **falló**: el parser de view queries
de PocketBase no soporta `UNION` — tokeniza mal el límite entre los dos SELECT
(`... AS fecha ss.id AS id`). Es una limitación del parser propio de PB, no
SQLite crudo.

La unión se resuelve entonces en un helper de `lib/` (`sales-ledger.ts`): hace
dos consultas (`orders` y `supply_sales`), normaliza cada record a una forma
común y los une en TypeScript. Ventajas sobre la view: es **testeable** con
vitest, no depende del parser limitado de PB, y da control total sobre la
forma del resultado.

### 3. `supply_sales.item` como relación a `materials`
`materials` ya tiene `cost_price` y `sell_price` — estaba medio diseñado para
ser vendible. En vez de un `item_name` de texto libre (inconsistente,
propenso a errores), `item` es una relación. Beneficios: catálogo consistente,
autocompletado de precio, y **margen real por venta** gratis (`cost_price` vs
`unit_price`).

### 4. Snapshot de `unit_price` en `supply_sales`
Aunque el precio se autocomplete desde `materials.sell_price`, se persiste en
el record. Una venta es un hecho histórico: su precio se congela al momento de
la transacción. Es el mismo principio por el que `orders` guarda su propio
`unit_price` en vez de relacionarse al precio vigente del producto.

### 5. `status` e `is_paid` ortogonales
"Reservado, entregado, pagado" no es una secuencia lineal: se puede entregar
sin cobrar, o cobrar una seña antes de entregar. Por eso `status`
(`reservado` / `entregado` / `cancelado`) maneja la entrega e `is_paid` (bool)
maneja el cobro, como dimensiones independientes. Coherente con `orders`, que
ya separa `status` de `is_paid`.

### 6. Sin flag `sellable` en `materials`
Decisión del negocio: **todo lo que está en `materials` es vendible**. Por lo
tanto `supply_sales.item` se relaciona a cualquier material sin filtro
adicional. Se evita un campo innecesario.

### 7. No renombrar `materials`
Con adhesivos y accesorios adentro, el nombre `materials` se queda corto
conceptualmente. Pero renombrar una colección en PocketBase implica migración
+ hooks + types + lib + todas las referencias del frontend. El costo no
justifica el beneficio cosmético. Se documenta que el concepto se ensanchó.

## El helper `sales-ledger.ts`

Forma de cada entrada normalizada:

```ts
type SalesLedgerEntry = {
  tipo: "impresion" | "insumo";
  concepto: string;        // project_name | materials.name
  customer_name: string;
  total: number;           // unit_price * units_ordered | unit_price * quantity
  is_paid: boolean;
  fecha: string;           // order_date | sale_date
};
```

El helper consulta `orders` (excluyendo `status = "cancelled"`) y
`supply_sales` (excluyendo `status = "cancelado"`, con `expand=item` para
traer `materials.name`), mapea ambas a `SalesLedgerEntry[]` y concatena. El
filtro por rango de fechas se aplica en las consultas PB.

## Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `pocketbase/pb_migrations/{ts}_materials_expand_kind.js` | nuevo — agrega `adhesive`, `accessory` al enum `kind` |
| `pocketbase/pb_migrations/{ts}_create_supply_sales.js` | nuevo — colección `supply_sales` |
| `pocketbase/pb_hooks/supply_sales.pb.js` | nuevo — default `status = reservado` |
| `frontend/src/lib/types.ts` | + `SUPPLY_SALE_STATUS_VALUES`, tipos, + kinds nuevos |
| `frontend/src/lib/admin-supply-sales.ts` | nuevo — extractor + validador de `FormData` |
| `frontend/src/lib/sales-ledger.ts` | nuevo — unión normalizada de `orders` + `supply_sales` |
| `frontend/src/lib/admin-materials.ts` | actualizar `MATERIAL_KIND_VALUES` y copy del form |
| `frontend/src/pages/admin/insumos/index.astro` | nuevo — listado |
| `frontend/src/pages/admin/insumos/nuevo.astro` | nuevo — alta |
| `frontend/src/pages/admin/insumos/[id].astro` | nuevo — edición + borrado |
| `frontend/src/pages/admin/insumos/reporte.astro` | nuevo — reporte por rango de fechas |
| `frontend/src/components/admin/SupplySaleForm.astro` | nuevo — form reutilizable |
| `frontend/src/components/admin/MaterialForm.astro` | actualizar selector de `kind` |
