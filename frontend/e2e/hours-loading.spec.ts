import { expect, test } from "@playwright/test";
import { loginAsDemo } from "./helpers";

// Con conexión lenta, el horario no se puede editar ni guardar hasta que llega:
// antes se mostraban todos los días cerrados y guardar borraba la semana entera
test("el horario no se puede guardar mientras está cargando", async ({
  page,
}) => {
  await loginAsDemo(page);

  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route("**/api/working-hours", async (route) => {
    if (route.request().method() === "GET") await held;
    await route.continue();
  });

  await page.goto("/dashboard/hours");
  await expect(page.getByText("Cargando horario...")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Guardar horario" }),
  ).toBeDisabled();
  await expect(page.getByRole("checkbox")).toHaveCount(0);

  release();
  const lunes = page.getByRole("listitem").filter({ hasText: "Lunes" });
  await expect(lunes.getByRole("checkbox")).toBeChecked();
  await expect(
    page.getByRole("button", { name: "Guardar horario" }),
  ).toBeEnabled();
  await expect(page.getByText("Cargando horario...")).toHaveCount(0);
});
