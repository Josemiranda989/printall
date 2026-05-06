# Pendientes — Print All

> Última actualización: 2026-05-06

## 🧪 Mejoras de carga de productos (admin) — pendientes nivel 2 y 3

Hicimos el **nivel 1**: auto-slug + defaults (`active=true`, `stock_status=in_stock`) + placeholder de imagen.
Quedan dos niveles más si la carga manual se vuelve tediosa:

### Nivel 2 — cambios de schema

- [ ] Migrar `attributes` (JSON crudo en admin) → collection separada `product_attributes` con relación al producto y campos `key` + `value`. El admin pasa a tener formulario real con "+ Add row" en vez de pedirte tipear `{"color":"negro"}`.
- [ ] Renombrar `active` → `published` para que no se confunda con `featured`.
- [ ] Considerar borrar `whatsapp_message` (siempre se llena con el template default — el fallback en código ya lo cubre y nadie lo personaliza).
- [ ] Migration nueva para setear `default: true` en el campo `active` a nivel schema (así el checkbox del admin form arranca marcado y la UX es coherente con el hook).

### Nivel 3 — admin custom

- [ ] Crear `/admin/productos` en Astro consumiendo la API de PocketBase, con login admin:
  - Placeholders y help text reales
  - Drag-and-drop de imágenes con preview
  - Slug auto-visible mientras tipeás el nombre
  - Attributes como filas key/value editables
  - Reordenar imágenes con drag

## 🐛 Conocidos / aceptados

- **Default `active=true` solo aplica desde API.** En el admin form de PocketBase el checkbox arranca desmarcado, pero el hook `onRecordCreateRequest` después lo fuerza a `true`. Visualmente raro pero el producto SÍ queda publicado al guardar. Solución limpia: ver pendiente nivel 2 (migration con `default: true`).
- **Warning `ts(6133)` en `frontend/src/pages/productos/[slug].astro:2`.** Dice "'slug' is declared but its value is never read" pero la variable sí se usa en el `Astro.redirect`. Parece falso positivo del plugin de Astro. Si molesta, agregarle `// @ts-expect-error` o reordenar.

## 💡 Ideas futuras (no urgentes)

- [ ] Newsletter / suscripción de novedades
- [ ] Blog / sección "novedades" para mostrar trabajos recientes

## ✅ Lo que ya está cerrado

- ✅ Cloudflare Tunnel: `printall.jmlabs.app` (público) + `printall-api.jmlabs.app` (PocketBase con CF Access en `/_/`)
- ✅ Tests unitarios con vitest (14 passing)
- ✅ Bug de imágenes resuelto (`expandProductImages` y `getFileUrl` corregidos para PB 0.25)
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
- ✅ Reorden de imágenes: verificado que el drag-and-drop nativo del admin de PB 0.25 funciona y el frontend respeta el orden — no hace falta código custom

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
| Logo / mascota | `frontend/public/{logo.png, mascot.png, placeholder.svg}` |
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
