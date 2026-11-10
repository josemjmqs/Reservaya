import { expect, test } from "@playwright/test";
import { bookFirstSlot, openSlots, workdayFrom } from "./helpers";

// El cliente cancela con el enlace privado de su reserva, sin cuenta, y la hora
// vuelve a quedar libre. "Lavado y peinado" lo hace una sola profesional, así
// que mientras la reserva existe esa hora no se ofrece a nadie más.
test("el cliente cancela con su enlace y la hora vuelve a quedar libre", async ({
  page,
}) => {
  const choice = {
    category: "Pelo",
    service: "Lavado y peinado",
    date: workdayFrom(11),
  };
  const time = await bookFirstSlot(page, {
    ...choice,
    customer: `Cancela E2E ${Date.now().toString(36)}`,
  });

  // Desde la confirmación, abre su reserva
  await page.getByRole("link", { name: "Abrir mi reserva" }).click();
  await expect(page.getByRole("heading", { name: "Tu reserva" })).toBeVisible();
  await expect(page.getByText("Lavado y peinado")).toBeVisible();
  await expect(page.getByText(time)).toBeVisible();
  const manageUrl = page.url();

  // Mientras está reservada, esa hora no se ofrece
  expect(await openSlots(page, choice)).not.toContain(time);

  // Cancela (acepta el "¿Seguro?")
  await page.goto(manageUrl);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Cancelar reserva" }).click();
  await expect(page.getByText("Cancelada")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cancelar reserva" }),
  ).toHaveCount(0);

  // La hora vuelve a estar disponible
  expect(await openSlots(page, choice)).toContain(time);
});
