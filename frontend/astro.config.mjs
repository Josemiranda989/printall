import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";

// Sentry se carga solo si SENTRY_DSN está seteado en el entorno. Sin DSN,
// no hace nada (no-op). Esto permite mergear el setup sin cuenta de Sentry
// y activarlo después con solo agregar la env var.
const sentryDsn = process.env.SENTRY_DSN ?? "";
const sentryIntegrations = [];
if (sentryDsn) {
  const { default: sentry } = await import("@sentry/astro");
  sentryIntegrations.push(
    sentry({
      dsn: sentryDsn,
      environment: process.env.SENTRY_ENVIRONMENT ?? "production",
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    }),
  );
}

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
  integrations: sentryIntegrations,
  vite: {
    plugins: [tailwindcss()],
  },
});
