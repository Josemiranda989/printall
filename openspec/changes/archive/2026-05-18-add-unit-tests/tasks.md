# Tasks: add-unit-tests

## Fase 1 — Infraestructura

- [x] 1.1 Crear estructura openspec/
- [x] 1.2 Instalar vitest en frontend/
- [x] 1.3 Crear vitest.config.ts
- [x] 1.4 Agregar script "test" en package.json

## Fase 2 — Modificaciones al source

- [x] 2.1 Exportar `sanitizeSlug` en pocketbase.ts
- [x] 2.2 Exportar `getFileUrl` en pocketbase.ts

## Fase 3 — Tests

- [x] 3.1 Escribir tests de sanitizeSlug (REQ-01) — 5 casos
- [x] 3.2 Escribir tests de getFileUrl (REQ-02) — 3 casos
- [x] 3.3 Escribir tests de getWhatsAppUrl (REQ-03) — 3 casos
- [x] 3.4 Escribir tests de getProductWhatsAppUrl (REQ-04) — 3 casos

## Fase 4 — Verificación

- [x] 4.1 vitest run → 14/14 passed ✅
- [x] 4.2 astro check → 0 errors ✅
- [x] 4.3 Commit ✅
