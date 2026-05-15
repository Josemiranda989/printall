# Pendientes — Print All

> Última actualización: 2026-05-12 (suite 402/402 + 4 PRs cerrados: inline editing, fix test, security audit, E2E orders)

## 🧪 Mejoras de carga de productos (admin) — pendientes nivel 2 y 3

Hicimos el **nivel 1**: auto-slug + defaults (`active=true`, `stock_status=in_stock`) + placeholder de imagen.
Quedan dos niveles más si la carga manual se vuelve tediosa:

### Nivel 2 — cambios de schema

- ~~Migrar `attributes` (JSON crudo en admin) → collection separada `product_attributes`~~ ✅ **Hecho** (commits `2913ba6` + `f6c7d24`). Cada attribute ahora es un record con `product`, `key`, `value`, `order`. El detalle del producto los renderiza vía back-relation expand (`product_attributes_via_product`). Ojo: el bug del []byte-en-JSVM dejó como aprendizaje el patrón correcto de parsing — ver `pocketbase-037-quirks.md`.
- ~~Renombrar `active` → `published` para que no se confunda con `featured`~~ ✅ **Hecho** (commit `1e99796`). Migration que renombra field, listRule/viewRule e indexes; hook + types + lib + tests actualizados.
- ~~Migration nueva para setear `default: true` en el campo `active`~~. **WONTFIX (limitación de PB 0.37).** El struct `BoolField` no tiene propiedad `Default` — la migration se aplica sin error pero PB la ignora. La única solución limpia para que el admin form arranque marcado es el Nivel 3 (admin custom). Por ahora el hook `onRecordCreateRequest` cubre el comportamiento correcto al guardar.

### Nivel 3 — admin custom

**Sprint 1 (branch `feat/admin-custom`)** — base de auth y CRUD básico de productos:

- ✅ `lib/admin-auth.ts` — login con `_superusers`, cookie httpOnly `pb_admin_token`, `verifyAdminToken` con `authRefresh`
- ✅ `middleware.ts` — guarda `/admin/*`, inyecta `Astro.locals.adminPB` y `Astro.locals.admin`
- ✅ `layouts/AdminLayout.astro` — header sobrio con email + logout
- ✅ `pages/admin/login.astro` + `logout.ts` + `index.astro` (redirect)
- ✅ `pages/admin/productos/index.astro` — listado con thumb, badges, link a editar
- ✅ `components/admin/ProductForm.astro` — form reutilizable, slug en vivo (JS browser), validación client/server
- ✅ `lib/admin-products.ts` — extractor + validador desde `FormData` (11 tests)
- ✅ `lib/slug.ts` — slugify compartido frontend/PB-hook (7 tests)
- ✅ `pages/admin/productos/nuevo.astro` — crear producto
- ✅ `pages/admin/productos/[id].astro` — editar + borrar (con confirm)
- ✅ Hook `products.pb.js`: removí default de `published` para que el form pueda mandar `false` explícito sin que el hook lo pise a `true`

**Sprints completados (multi-sprint, todos mergeados a `main`)**:

- ~~Drag-and-drop de imágenes con preview (multipart upload, sortable)~~ ✅ **Sprint 2** — `ImagesEditor` server-rendered con SortableJS, multipart submit, spinner, swap a CDN al éxito.
- ~~Reordenar imágenes con drag~~ ✅ **Sprint 2** (mismo sprint, drag-and-drop nativo + endpoint PATCH).
- ~~Attributes como filas key/value editables (CRUD de `product_attributes`)~~ ✅ **Sprint 3** — `AttributesEditor` con tabla editable, save al blur/Enter, validator puro, endpoints REST.
- ~~Gestión de categorías (`/admin/categorias` — CRUD básico)~~ ✅ **Sprint 4** — listado con count de productos, slug auto, unique enforced, drag-and-drop reorder (Sprint 8).
- ~~Search/filter en el listado cuando haya >20 productos~~ ✅ **Sprint 7+9** — búsqueda expandida a name+description+slug + paginación.
- ~~Manejo de errores PB con mensajes amigables~~ ✅ `lib/admin-errors.ts` con `mapPBErrorToString` y 30 tests.

**Pendientes Nivel 3 (próximas sesiones)**:

- [ ] Vista de producto en preview interno (sin tener que abrir el sitio público) — único que queda del scope original

## 🐛 Conocidos / aceptados

- **Productos creados desde el admin de PocketBase quedan como borrador (`published=false`).** Es por design: el hook `products.pb.js` ya no setea `published=true` por default (tenía un bug que pisaba `false` explícito). Los productos creados desde el admin custom (`/admin/productos/nuevo`) usan el form que manda `published=true` por default — el checkbox arranca marcado.
- **Astro 5 → 6 upgrade pendiente (deuda diferida, NO urgente).** Versiones actuales: `astro@^5.6.1`, `@astrojs/node@^9.2.0`. Verificado por grep que el proyecto NO usa features deprecadas (`Astro.glob`, `<ViewTransitions/>`, `astro:schema`, Content Collections, `define:vars`, Server Islands, i18n). Node 22.17 ya cumple el requirement de v6. Estimación: 2-4 horas (bump deps, install, check, test, build, smoke, deploy). Razón para diferir: cero security risk real (las vulns moderate del audit aplican a features que no se usan) y cero feature regression. Migration guide: https://docs.astro.build/en/guides/upgrade-to/v6/
- **7 vulnerabilities moderate de `npm audit` analizadas y descartadas.** Todas requieren los major upgrades del punto anterior y las features afectadas no se usan. La única HIGH (`fast-uri` path traversal) ya está resuelta vía `npm audit fix` (PR #13).

## 💡 Ideas futuras (no urgentes)

- [ ] Newsletter / suscripción de novedades
- [ ] Blog / sección "novedades" para mostrar trabajos recientes
- [ ] Agenda de clientes — registrar clientes recurrentes con historial de pedidos/ventas

## ✅ Lo que ya está cerrado

- ✅ Cloudflare Tunnel: `printall.jmlabs.app` (público) + `printall-api.jmlabs.app` (PocketBase con CF Access en `/_/`)
- ✅ Tests unitarios con vitest (38 passing — funciones puras + `getRelatedProducts`/`getCategories`/`getProducts` con mock del cliente PB + endpoint `/sitemap.xml`)
- ✅ Bug de imágenes resuelto (`expandProductImages` y `getFileUrl` corregidos para PB 0.23+)
- ✅ Rediseño visual completo bajo el lenguaje **retro-industrial playful**:
  - Hero (mascota + noise + dot grid + marquee de categorías)
  - Header (mobile menu, WhatsApp pill, sticky shadow)
  - Footer (3 columnas, contacto con icons, back-to-top)
  - Catalog header (sticker pills, search con focus-glow, sticky shadow)
  - Product cards (border 2px, sello rotado, dashed separator, hover glow)
  - CTA (scroll-triggered reveal, dual CTAs, decorative bubble)
  - Página de detalle (gallery con badges sticker, price card, spec cards)
- ✅ Auto-slug + defaults + placeholder de imagen
- ✅ Autoskills instalado en `frontend/.agents/` y `frontend/.claude/` (lockfile commiteado, dirs gitignored)
- ✅ Patrón `.env.example` adoptado
- ✅ Logo nuevo (transparente, sin fondo) + mascota recoloreada al brand orange
- ✅ Repo sincronizado con `origin` (todos los commits en GitHub)
- ✅ SEO base: `sitemap.xml` (SSR endpoint con productos activos + lastmod ISO 8601) + `robots.txt` apuntando al sitemap
- ✅ Página `/contacto` rediseñada en el lenguaje retro-industrial (hero con noise/dot grid, card con sello rotado, info en cards dashed)
- ✅ Sección "Te puede interesar" al final del detalle (3-4 productos de la misma categoría, no aparece si no hay relacionados)
- ✅ Open Graph image dinámica por producto: endpoint `/og/producto/[slug].png` con Satori + @resvg/resvg-js (1200×630, branding completo, fonts via @fontsource, cache 1d cliente / 30d Cloudflare, query `?v=updated_ts` para invalidar redes sociales al editar)
- ✅ Reorden de imágenes: verificado que el drag-and-drop nativo del admin de PB 0.37 funciona y el frontend respeta el orden — no hace falta código custom
- ✅ Campo `whatsapp_message` borrado del schema y del código (siempre se llenaba con el template default; el fallback en `getProductWhatsAppUrl` ya cubría todos los casos)
- ✅ Warning `ts(6133)` en `productos/[slug].astro` silenciado (refactor del frontmatter para evitar el falso positivo del plugin Astro check)
- ✅ **Lighthouse mobile HOME 100/100/100/100** (commit `6813d48`). Tras enrutar los thumbnails de productos vía Cloudflare Image Resizing (`/cdn-cgi/image/format=auto,...`), el browser negocia AVIF/WebP y todas las auditorías de imágenes pasan. Ejemplo medido: thumb 400x400 cae de 53 KB JPEG → 25 KB AVIF (−52%). LCP 1.9 s, CLS 0, TBT 0 ms, FCP 1.0 s, SI 1.6 s. Cambio mínimo: rewrite de `getFileUrl()` en `frontend/src/lib/pocketbase.ts` + nueva env var `PUBLIC_SITE_URL` + 3 tests nuevos (suite 41 passing). Requiere Image Transformations habilitado en la zona de Cloudflare (`same-zone`).
- ✅ **Lighthouse mobile** anterior (pre-CDN): HOME `perf 90 / a11y 100 / bp 100 / seo 100` · DETAIL `perf 97 / a11y 100 / bp 100 / seo 100`. Mejoras de esa fase: PNG→WebP (mascot −74%, logo −72%), preload del LCP, fonts self-hosted vía `@fontsource`, contraste WCAG AA (token nuevo `--color-accent-strong: #9a3412`), heading order corregido, WhatsApp button usa `accent-hover`.

### Cerrado post-2026-05-06 (módulo de pedidos + cierre de admin custom)

- ✅ **Sistema de pedidos completo (PR #2)** — módulo `/admin/pedidos` con CRUD, listado, kanban, materiales catalog y calculadora de costos.
- ✅ **Mobile UX de admin (PR #1 + PR #3)** — drawer responsive, tablas adaptables, inputs accesibles en pantallas chicas.
- ✅ **Notion sync de pedidos (PR #6)** — sync one-way de orders a Notion + redirect create/edit al listado.
- ✅ **Admin dashboard con KPIs (PR #7)** — `/admin` con métricas operativas + mensuales (revenue, pedidos por estado, productos top).
- ✅ **Partial payments con paid_amount (PR #8)** — soporte de señas / pagos parciales en `orders`, balance shown across UI.
- ✅ **BNA payment block (PR #9)** — copy-to-clipboard del mensaje de transferencia para clientes.
- ✅ **Gallery zoom + swipe (PR #10)** — gestos táctiles en el lightbox del detalle de producto.
- ✅ **Inline editing pedidos (PR #11)** — `units_done` y `paid_amount` editables inline en la tabla con patrón optimista (Enter/blur guarda, Escape cancela, rollback si server rechaza). Endpoint `/paid` extendido para aceptar `{ is_paid }` (toggle) o `{ paid_amount }` (custom). +53 tests de validators.
- ✅ **Test alignment IMAGES_MAX_COUNT (PR #12)** — fix de assertion que quedó atrás tras subir el límite de imágenes de 8 a 16. Ahora usa la constante directa.
- ✅ **Security audit fix HIGH (PR #13)** — `npm audit fix` resolvió la única vulnerability HIGH (`fast-uri` path traversal CVSS 7.5). Solo `package-lock.json` cambió, sin breaking changes.
- ✅ **E2E tests de orders endpoints (PR #14)** — 52 integration tests cubriendo los 4 PATCH endpoints (`status`, `priority`, `paid`, `progress`). Cubre auth, validation, lookup, update, error handling y la lógica de clamp/derivación server-side que vive solo en el endpoint.
- ✅ **Sprint 5 — perf/SEO público**: srcset/sizes, JSON-LD entities decodificadas (validado 15/15 checks en prod contra schema.org/Product).
- ✅ **Sprint 6 — seed tooling**: `frontend/scripts/seed-products.mjs` con auth contra PB y workflow Mac/Linux/Windows para cargar productos.
- ✅ **Sprint 8 — drag-and-drop reorder de categorías** (PR `b49e12d`).
- ✅ **Suite total**: 402/402 tests verde, `astro check` 0 errors / 0 warnings, `npm audit` 0 HIGH (7 moderate analizadas y descartadas).

## 📂 Referencia rápida — dónde vive cada cosa

| Concepto | Ubicación |
|----------|-----------|
| Componentes UI | `frontend/src/components/` |
| Páginas | `frontend/src/pages/` |
| Estilos / theme tokens | `frontend/src/layouts/BaseLayout.astro` (block `@theme`) |
| PB Hooks | `pocketbase/pb_hooks/products.pb.js` |
| PB Migrations | `pocketbase/pb_migrations/*` |
| Datos PB (NO commitear) | `pocketbase/pb_data/` |
| Cloudflare Tunnel config | `C:\ProgramData\Cloudflare\cloudflared\config.yml` (en homelab) |
| Logo / mascota | `frontend/public/{logo.webp, mascot.webp, placeholder.svg}` (logo.png se conserva como favicon) |
| Vars build-time (frontend) | `frontend/.env.production` (gitignored) |
| Vars docker-compose | `.env` (root, gitignored) |
| Skills locales | `frontend/.claude/skills/` (gitignored, lockfile en `frontend/skills-lock.json`) |

## 📌 Operations / runbook

- **Deploy frontend** (manual, no CI/CD):
  ```
  ssh homelab "cd /d D:\Development\printall && docker compose build --no-cache frontend && docker compose up -d --force-recreate frontend"
  ```
- **Restart PocketBase** (después de editar `pb_hooks/`):
  ```
  ssh homelab "cd /d D:\Development\printall && docker compose restart pocketbase"
  ```
- En cualquier deployment nuevo, recrear manualmente:
  - `frontend/.env.production` desde `frontend/.env.example`
  - root `.env` desde `.env.example`
- **PB version**: confirmar con `ssh homelab "docker exec printall-pocketbase /usr/local/bin/pocketbase --version"`. Hoy: 0.37.4. La imagen `latest` puede actualizarse al recrear el container.
- **`pb_migrations/` debe contener SOLO archivos `.js`** — PB 0.37 ejecuta TODOS los archivos del dir. Si hay `.db`, `.d.ts`, etc., PB hace panic al startup. En el homelab hay un backup en `pb_migrations_backup/` con archivos contaminantes pre-existentes.
