# Proposal: add-unit-tests

## Intent
Agregar infraestructura de testing con Vitest y tests unitarios para las
funciones de la capa `lib/` que contienen lógica de negocio crítica.

## Motivation
- `sanitizeSlug` previene inyección en filtros de PocketBase — sin tests,
  un cambio accidental puede abrir una vulnerabilidad.
- `getFileUrl` construye todas las URLs de imágenes del catálogo — un bug
  silencioso rompería la carga visual de todos los productos.
- `getWhatsAppUrl` / `getProductWhatsAppUrl` son el único CTA del sitio —
  una URL mal formateada elimina conversiones.

## Scope
- Instalar Vitest como devDependency en `frontend/`
- Exportar `sanitizeSlug` y `getFileUrl` desde `pocketbase.ts`
- Escribir `src/lib/pocketbase.test.ts` con tests para las 4 funciones
- Agregar script `"test": "vitest run"` en `package.json`

## Out of scope
- Tests E2E (requieren stack completo corriendo)
- Mocks de PocketBase para funciones async (`getProducts`, etc.)
- CI/CD pipeline

## Rollback
Revertir es trivial: eliminar `vitest.config.ts`, `pocketbase.test.ts` y
el devDependency. Las modificaciones a `pocketbase.ts` (exports añadidos)
son backwards-compatible — no rompen nada si se revierten.

## Risks
- Bajo: solo se agregan exports y tests, no se modifica lógica existente
