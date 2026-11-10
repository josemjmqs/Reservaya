import { expect, test as setup } from "@playwright/test";
import { AUTH_FILE, DEMO } from "./helpers";

// Inicia sesión una vez con el dueño demo (desde la pantalla de login) y guarda
// la sesión para las pruebas que la necesitan
setup("el dueño demo inicia sesión", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(DEMO.email);
  await page.locator('input[type="password"]').fill(DEMO.password);
  await page.locator('input[type="password"]').press("Enter");
  await page.waitForURL("**/dashboard/**");
  await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible();
  await page.context().storageState({ path: AUTH_FILE });
});
