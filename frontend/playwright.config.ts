import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config. Los tests E2E NO corren en CI por ahora — requieren
 * docker compose up con el stack completo (frontend + pocketbase). Se
 * corren manualmente desde el host:
 *
 *   1. docker compose up -d
 *   2. cd frontend && npx playwright install chromium  (solo la primera vez)
 *   3. npm run e2e
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:4321",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
