import { expect, test } from "@playwright/test";
import { loginAsDemo } from "./helpers";

// La duración total de un servicio se escribe en minutos, horas o días; se
// guarda en minutos y, al editar, vuelve a abrir en la unidad exacta
test("la duración total se elige en horas o días y se mantiene al editar", async ({
  page,
}) => {
  const name = `Duración E2E ${Date.now().toString(36)}`;
  await loginAsDemo(page);
  await page.goto("/dashboard/services");

  const form = page.locator("form").filter({ hasText: "Nuevo servicio" });
  await form.getByRole("textbox", { name: /^Nombre/ }).fill(name);
  await form.getByRole("spinbutton", { name: /Tiempo de atención/ }).fill("30");
  await form.getByRole("spinbutton", { name: /Duración total/ }).fill("2");
  await form.getByRole("combobox", { name: "Unidad" }).selectOption("horas");
  await form.getByRole("button", { name: "Agregar" }).click();

  const row = page.getByRole("listitem").filter({ hasText: name });
  await expect(row).toContainText("total 2 h");

  try {
    // Al editar abre en horas; se cambia a 1 día. En edición el nombre está
    // dentro de un campo, así que la fila se ubica por su botón "Guardar"
    await row.getByRole("button", { name: "Editar" }).click();
    const editing = page
      .getByRole("listitem")
      .filter({ has: page.getByRole("button", { name: "Guardar" }) });
    await expect(editing.getByRole("textbox", { name: /^Nombre/ })).toHaveValue(
      name,
    );
    const total = editing.getByRole("spinbutton", { name: /Duración total/ });
    const unit = editing.getByRole("combobox", { name: "Unidad" });
    await expect(total).toHaveValue("2");
    await expect(unit).toHaveValue("h");
    await total.fill("1");
    await unit.selectOption("días");
    await editing.getByRole("button", { name: "Guardar" }).click();
    await expect(row).toContainText("total 1 día");
  } finally {
    // El negocio demo queda como estaba: el servicio de prueba se desactiva
    // (recargar cierra la edición si la prueba falló a medias)
    await page.reload();
    await row.getByRole("button", { name: "Desactivar" }).click();
    await expect(row).toContainText("Desactivado");
  }
});
