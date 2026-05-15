# Tasks: add-supply-sales

## Fase 1 - Schema (migraciones PocketBase)

- [x] 1.1 Migración `materials_expand_kind` — agregar `adhesive` y `accessory` al enum `kind` (REQ-01) — aplicada
- [x] 1.2 Migración `create_supply_sales` — colección con todos los campos (REQ-02) — aplicada
- [x] 1.3 ~~Migración `create_sales_ledger_view`~~ — DESCARTADA: PocketBase no soporta `UNION` en view queries. El reporting unificado se mueve a la capa de aplicación (ver Fase 3.5).
- [x] 1.4 Verificar migraciones aplicadas — `supply_sales` existe, PB `healthy`, sitio responde 200

## Fase 2 - Backend hooks

- [x] 2.1 Hook `supply_sales.pb.js` — default `status = reservado` en `onRecordCreateRequest` (REQ-03) — desplegado, PB `healthy`, hook cargado sin errores

## Fase 3 - Types y lib

- [x] 3.1 `types.ts` — agregados `SupplySale`, `SupplySaleWithItem`, `SalesLedgerEntry`, `SUPPLY_SALE_STATUS_*`, helper `supplySaleTotal`
- [x] 3.2 `types.ts` — agregados `adhesive` y `accessory` a `MaterialKind` / `MATERIAL_KIND_VALUES` / `_LABELS` / `_UNIT`
- [x] 3.3 `admin-supply-sales.ts` — extractor + validador desde `FormData` — 10 tests pasando
- [x] 3.4 `admin-materials.ts` — `VALID_KIND` toma los kinds nuevos automáticamente; mensaje de error del selector actualizado
- [x] 3.5 `sales-ledger.ts` — helper que une `orders` + `supply_sales` (funciones puras + `getSalesLedger` async) — 6 tests pasando (REQ-05)
- [x] 3.6 Verificación: `vitest run` 418/418 ✅, `astro check` 0 errors ✅

## Fase 4 - Admin UI

- [x] 4.1 `SupplySaleForm.astro` — form reutilizable (item con autocompletado de precio, quantity, unit_price, total en vivo, status, is_paid, fechas, notas)
- [x] 4.2 `pages/admin/insumos/index.astro` — listado de ventas (REQ-06). NOTA: listado simple sin filtros, igual que `materiales/index.astro`. Filtros pueden ser un follow-up si se vuelve tedioso.
- [x] 4.3 `pages/admin/insumos/nuevo.astro` — alta de venta
- [x] 4.4 `pages/admin/insumos/[id].astro` — edición + borrado con confirm
- [x] 4.5 `MaterialForm.astro` — selector de `kind` con los tipos nuevos (radio buttons + `KIND_UNIT` del script + texto de ayuda)
- [x] 4.6 `pages/admin/insumos/reporte.astro` — reporte por rango de fechas usando `sales-ledger.ts` (REQ-07): totales general/impresiones/insumos/cobrado + tabla
- [x] 4.7 Link de navegación a `/admin/insumos` en `AdminLayout.astro` (desktop + mobile)

## Fase 5 - Verificación

- [x] 5.1 `vitest run` — 418/418 passed ✅
- [x] 5.2 `astro check` — 0 errors, 0 warnings ✅
- [ ] 5.3 Prueba manual: alta de venta, transición de estado, reporte por fecha — REQUIERE rebuild del container `printall-frontend` (los `.astro` son source; el container corre el build viejo). Pendiente de hacer en navegador.
- [ ] 5.4 Commit

## Pendiente de deploy

- El container `printall-frontend` corre un build viejo. Para que los cambios estén en vivo:
  `docker compose build frontend && docker compose up -d frontend`. Implica un blip breve del frontend.
