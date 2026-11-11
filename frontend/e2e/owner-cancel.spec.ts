import { expect, test } from "@playwright/test";
import { bookFirstSlot, loginAsDemo, openSlots, workdayFrom } from "./helpers";

// El dueño cancela una reserva desde su agenda: primero confirma (un toque
// accidental no cancela nada) y la hora vuelve a quedar libre. El correo al
// cliente lo cubren los tests de integración (agenda.service.int-spec.ts).
test("el dueño cancela una reserva tras confirmar y la hora queda libre", async ({
  page,
}) => {
  const choice = {
    category: "Pelo",
    service: "Lavado y peinado",
    date: workdayFrom(13),
  };
  const customer = `Cancelada E2E ${Date.now().toString(36)}`;
  const time = await bookFirstSlot(page, { ...choice, customer });

  await loginAsDemo(page);
  await page.goto(`/dashboard/agenda?date=${choice.date}`);
  const card = page.getByRole("listitem").filter({ hasText: customer });
  const dialog = page.getByRole("dialog", { name: "¿Cancelar esta reserva?" });

  // "Volver" y Esc cierran sin cancelar
  await card.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(customer);
  await expect(dialog).toContainText("Lavado y peinado");
  await expect(dialog).toContainText("Le enviaremos un correo");
  await dialog.getByRole("button", { name: "Volver" }).click();
  await expect(dialog).toBeHidden();
  await card.getByRole("button", { name: "Cancelar" }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(card).toContainText("Confirmada");

  // Confirmar cancela, con motivo
  await card.getByRole("button", { name: "Cancelar" }).click();
  await dialog.getByLabel("Motivo (opcional)").fill("Tuvimos un imprevisto");
  await dialog.getByRole("button", { name: "Sí, cancelar" }).click();
  await expect(dialog).toBeHidden();
  await expect(card).toContainText("Cancelada");
  await expect(card.getByRole("button", { name: "Cancelar" })).toHaveCount(0);

  // La hora vuelve a ofrecerse en la página pública
  expect(await openSlots(page, choice)).toContain(time);
});
