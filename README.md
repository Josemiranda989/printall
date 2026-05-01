# Printall

Catálogo online de [Print All](https://www.instagram.com/printall.tuc/) — emprendimiento de impresión 3D en Aguilares, Tucumán.

## Stack

- **Frontend**: Astro SSR + Tailwind
- **Backend / Admin**: PocketBase (SQLite + admin UI built-in)
- **Orders**: WhatsApp deeplink (no e-commerce con pagos en esta fase)
- **Deploy**: Docker Compose en homelab + Cloudflare Tunnel
- **Dominio**: `printall.jmlabs.app`

## Estructura

```
printall/
├── docker-compose.yml
├── frontend/                 # Astro app
│   ├── src/
│   └── public/
│       └── logo.png
└── pocketbase/
    ├── pb_data/              # gitignored — datos reales (SQLite + uploads)
    ├── pb_migrations/        # versionado en git — schema as code
    └── pb_hooks/             # custom hooks (JS) si hace falta
```

## Levantar el entorno

```bash
docker compose up -d
```

- Catálogo público: <http://localhost:4321>
- Admin de PocketBase: <http://localhost:8090/_/>

Primer arranque: PocketBase pide crear admin user al entrar a `/_/`.

## Convenciones

- `pb_migrations/` se versiona en git (es el schema). `pb_data/` NUNCA se commitea.
- Productos heterogéneos (filamentos, vasos, llaveros) usan campo `attributes` JSON para no inflar el modelo.
- Categorías iniciales alineadas con highlights de IG: Filamentos, Mates, Vasos, Llaveros, Porta celulares, Chops 3D, Organizadores, Insumos.
