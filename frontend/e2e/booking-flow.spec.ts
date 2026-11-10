import { expect, test } from "@playwright/test";
import { bookFirstSlot, loginAsDemo, workdayFrom } from "./helpers";

// Lo que de verdad le importa a un negocio: un cliente reserva desde la página
// pública y el dueño la ve en su agenda. Usa el negocio demo del seed.
test("un cliente reserva desde la página pública y el dueño la ve en su agenda", async ({
  page,
}) => {
  const date = workdayFrom(9);
  const customer = `Cliente E2E ${Date.now().toString(36)}`;

  // 1. Cliente: elige servicio, día y hora, y reserva sin cuenta
  const time = await bookFirstSlot(page, {
    category: "Pelo",
    service: "Corte de pelo",
    date,
    customer,
  });

  // 2. Dueño: inicia sesión y la ve en la agenda de ese día
  await loginAsDemo(page);
  await page.goto(`/dashboard/agenda?date=${date}`);
  const card = page.getByRole("listitem").filter({ hasText: customer });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Corte de pelo");
  await expect(card).toContainText("Confirmada");
  await expect(card).toContainText(time);
});
