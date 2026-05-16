import { test, expect } from "@playwright/test";

test.describe("Admin login", () => {
  test("/admin redirige a /admin/login cuando no hay sesión", async ({ page }) => {
    await page.goto("/admin/clientes");
    // Debe terminar en /admin/login con redirect param
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("login page renderiza el formulario", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.getByRole("button", { name: /entrar|login|ingresar/i })).toBeVisible();
  });
});
