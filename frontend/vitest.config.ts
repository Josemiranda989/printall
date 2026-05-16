import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Excluimos tests/e2e porque son specs de Playwright (.spec.ts) que vitest
    // levantaba por default y rompian con "Playwright Test did not expect
    // test.describe() to be called here". Playwright corre aparte con su
    // propio runner (ver playwright.config.ts).
    exclude: ["**/node_modules/**", "**/dist/**", "tests/e2e/**"],
  },
});
