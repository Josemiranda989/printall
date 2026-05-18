# Contributing — Print All

Workflow para contribuir al repo. Aplica tanto si sos vos (mantenedor) como si entra otra persona.

## Branch model

- `main` es la rama de producción. Está protegida — no se pushea directo.
- Cada cambio nace de una rama feature/fix/chore desde `main`.

## Naming de branches

| Prefijo | Para qué | Ejemplo |
|---------|----------|---------|
| `feat/` | Feature nueva | `feat/wishlist` |
| `fix/` | Bug fix | `fix/cobranzas-whatsapp-fallback` |
| `chore/` | Tooling, deps, docs | `chore/bump-astro-6` |
| `refactor/` | Cambio sin alterar comportamiento | `refactor/extract-pending-query` |
| `test/` | Solo tests | `test/cover-quote-convert` |

## Conventional commits

Títulos de commit y de PR siguen [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(orders): add bulk action to mark delivered
fix(cobranzas): fallback to client.whatsapp when snapshot empty
chore(deps): bump astrojs to 5.6.1
docs: update README screenshots
```

Scope opcional pero útil cuando aplica (`orders`, `admin`, `public`, `pb-hook`, etc.).

## Flow estándar

```bash
# 1. Crear branch desde main al día
git checkout main && git pull --ff-only
git checkout -b fix/algo

# 2. Editar + commit (uno o varios)
git add ...
git commit -m "fix(area): descripción corta"

# 3. Push y abrir PR
git push -u origin fix/algo
gh pr create               # el template se carga solo

# 4. Esperar CI verde
gh pr checks --watch

# 5. Squash merge (la branch remota se borra sola)
gh pr merge --squash --auto

# 6. Sync local
git checkout main && git pull --ff-only
git branch -d fix/algo
```

## Checks obligatorios antes del merge

Branch protection en `main` exige que pasen estos status checks:

- **Frontend (tests + type check)** — corre `astro check` + `vitest run` (`.github/workflows/ci.yml`)
- **PocketBase migrations** — levanta PB contra un `pb_data` limpio y aplica todas las migrations + hooks
- **GitGuardian Security Checks** — escaneo de secrets

Si alguna falla, el merge queda bloqueado hasta arreglar.

## Política de merge

- **Squash merge únicamente** — cada PR se mergea como un solo commit en `main`. Los commits intermedios del feature branch se descartan a favor de una historia legible.
- **`required_status_checks.strict = true`** — si `main` avanza mientras tu PR está abierto, hay que rebasear tu branch antes de poder mergear.
- **Force push y deletion bloqueados en main** — protección contra accidentes.

## Releases

- Etiquetas semver: `v0.X.0` para features/mejoras, `v0.0.X` para fixes puros.
- Cada release se acompaña con notas en GitHub Releases (`gh release create`).
- El versionado del `package.json` puede ir desfasado del tag — el tag es la fuente de verdad.

## Datos de prueba

Si vas a crear datos de prueba en PocketBase (vía Playwright, scripts, etc.), **usá un prefijo claro y limpiá al final**. Prefijos sugeridos:

- `TEST_PW_` — tests de Playwright
- `DIAG_PW_` — diagnóstico de bugs
- `VERIFY_` — verificación post-deploy

Sweep al cierre con un grep del prefijo en cada listado del admin (`/admin/pedidos`, `/admin/clientes`, etc.).

## Comandos útiles

```bash
# Tests
cd frontend && npm test                     # vitest una vez
cd frontend && npx vitest                   # watch mode
cd frontend && npx astro check              # type check

# Dev local
cd frontend && npm run dev                  # astro dev en :4321 (sin Docker)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up   # con hot reload + PB

# Deploy a homelab (manual)
cd /d/Development/printall
docker compose build frontend
docker compose up -d frontend
```

## Estructura del repo

| Path | Contenido |
|------|-----------|
| `frontend/` | App Astro + admin + tests |
| `pocketbase/pb_migrations/` | Migrations de schema (TODO `.js`, sin contaminación) |
| `pocketbase/pb_hooks/` | Hooks Goja (limitación JSVM pool: todo INLINE en cada handler) |
| `pocketbase/pb_data/` | DB y archivos (gitignored) |
| `openspec/changes/` | Specs de cambios en curso |
| `openspec/changes/archive/` | Specs de cambios completados |
| `docs/screenshots/` | Capturas para README |
| `.github/workflows/` | GitHub Actions (CI) |
| `.github/pull_request_template.md` | Template auto-cargado en cada PR |
