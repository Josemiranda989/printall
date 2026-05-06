import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://printall.jmlabs.app",
  output: "server",
  adapter: node({
    mode: "standalone",
  }),
  // Deshabilitamos el CSRF check de Astro porque detrás del Cloudflare Tunnel
  // el contenedor recibe Host="localhost:4321" mientras que el browser manda
  // Origin="https://printall.jmlabs.app", lo que rompe POSTs legítimos. La
  // protección equivalente la da la cookie `pb_admin_token` con SameSite=Lax
  // (ver lib/admin-auth.ts): en cross-site POST el navegador no envía la cookie
  // y el middleware redirige a /admin/login antes de procesar nada.
  security: {
    checkOrigin: false,
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
