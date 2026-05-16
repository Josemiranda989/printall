import { test, expect } from "@playwright/test";

test.describe("Catálogo público", () => {
  test("home renderiza el catálogo", async ({ page }) => {
    await page.goto("/");
    // El layout siempre incluye el logo de Print All
    await expect(page).toHaveTitle(/Print All/i);
  });

  test("/cotizar muestra el formulario", async ({ page }) => {
    await page.goto("/cotizar");
    await expect(page.getByRole("heading", { name: /Cotizar a medida/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /Título/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /Nombre/i })).toBeVisible();
  });

  test("/cotizar valida campos requeridos antes de enviar", async ({ page }) => {
    await page.goto("/cotizar");
    const submit = page.getByRole("button", { name: /Enviar pedido/i });
    await submit.click();
    // El navegador debe bloquear el submit por la validación HTML5
    // (campos `required`). El form sigue visible y no apareció el éxito.
    await expect(page.locator("#quote-success")).toBeHidden();
  });
});
