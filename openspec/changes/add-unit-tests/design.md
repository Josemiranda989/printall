# Design: add-unit-tests

## Decisiones de arquitectura

### 1. Vitest sobre Jest
Vitest es el runner nativo del ecosistema Vite/Astro. Comparte configuración
con el build (mismo `vite.config`), soporta `import.meta.env` out-of-the-box,
y no requiere transformaciones adicionales para TypeScript.

### 2. Tests colocados junto al source
`src/lib/pocketbase.test.ts` vive al lado de `pocketbase.ts`.
Convenio estándar de Vitest — evita sincronizar dos árboles de directorios.

### 3. Exportar helpers internos
`sanitizeSlug` y `getFileUrl` se exportan porque:
- Tienen valor intrínseco fuera del módulo (sanitización de input de usuario)
- Son las funciones con mayor impacto si se rompen silenciosamente
- Exportarlas no rompe el API existente

### 4. import.meta.env en tests
Vitest provee `import.meta.env` nativo. Las variables custom (`POCKETBASE_URL`,
`PUBLIC_POCKETBASE_URL`, `PUBLIC_WHATSAPP_NUMBER`) tendrán valor `undefined`
en tests, activando los fallbacks definidos en el código (`|| "http://localhost:8090"`).
No se requiere configuración extra de env.

## Archivos afectados

| Archivo | Cambio |
|---------|--------|
| `frontend/package.json` | + `vitest` devDep, + script `"test"` |
| `frontend/vitest.config.ts` | nuevo — config mínima |
| `frontend/src/lib/pocketbase.ts` | export `sanitizeSlug`, export `getFileUrl` |
| `frontend/src/lib/pocketbase.test.ts` | nuevo — tests unitarios |
