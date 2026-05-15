# Proposal: add-supply-sales

## Intent
Registrar las ventas de insumos 3D (filamentos por rollo, gotita, argollas
por unidad, vasos de aluminio, polímeros para mate) como una entidad propia,
y unificar el reporting de facturación con las ventas de impresiones (`orders`).

## Motivation
- `orders` no es una tabla de ventas genérica: rastrea **producción** de
  impresiones (`material`, `color`, `priority`, `units_done`). Registrar la
  venta de un insumo ahí dejaría la mitad de los campos en `null` y sin
  sentido — un code smell claro de dos conceptos en la misma caja.
- Las ventas de insumos tienen su propio ciclo de vida (`reservado` →
  `entregado`), distinto al de producción (`pending` → `in_progress` → ...).
- Hoy no hay forma de saber cuánto factura el negocio por reventa de insumos.
- El negocio necesita un **número único de facturación** que sume impresiones
  e insumos.

## Scope
- Expandir el enum `kind` de la colección `materials` para admitir los tipos
  nuevos de insumo (adhesivo, accesorio).
- Crear la colección `supply_sales` con relación a `materials`.
- Implementar el reporting unificado en la **capa de aplicación**: un helper
  en `lib/` que consulta `orders` + `supply_sales`, normaliza y une los
  registros (PocketBase no soporta `UNION` en view collections).
- Hook `supply_sales.pb.js` con defaults (`status = reservado`).
- Admin: sección `/admin/insumos` (CRUD) + vista de reporte por rango de fechas.
- Types y lib (`admin-supply-sales.ts`, `sales-ledger.ts`) para extracción/
  validación de formulario y para la unión de ventas.

## Out of scope
- Stock / inventario cuantitativo de `materials` (sigue siendo `active` bool;
  no hay conteo de unidades disponibles).
- Renombrar la colección `materials` (el concepto se ensanchó, pero renombrar
  implica tocar migraciones, hooks, types, lib y todas las referencias — churn
  sin valor proporcional).
- Mostrar insumos en el catálogo público.
- Integración con la calculadora de costos (sigue filtrando `materials` por
  `kind`, los tipos nuevos quedan fuera de su alcance automáticamente).

## Rollback
- `supply_sales` es una colección nueva: borrarla no afecta nada existente.
- La expansión del enum `kind` es **aditiva** (no quita valores) —
  backwards-compatible con los records actuales de `materials`.
- El helper de reporting y las páginas de admin son código nuevo — eliminarlos
  no rompe nada existente.

## Risks
- Bajo: la expansión del enum es aditiva, no destructiva.
- Nota de implementación: se descartó la PocketBase view collection para el
  reporting unificado — su parser de view queries no soporta `UNION`. La
  unión se resuelve en la capa de aplicación.
