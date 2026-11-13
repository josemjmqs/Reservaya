import { expect, test } from "@playwright/test";
import { bookFirstSlot, loginAsDemo, workdayFrom, zonedTime } from "./helpers";

// En la agenda de hoy, las reservas que ya terminaron bajan a "Ya pasaron" y
// conservan sus botones. Con el reloj simulado del navegador, un día futuro
// pasa a ser "hoy" sin depender de la hora a la que corre la prueba
test("en la agenda de hoy, las reservas que ya pasaron van abajo", async ({
  page,
}) => {
  const date = workdayFrom(15);
  const customer = `Hoy E2E ${Date.now().toString(36)}`;
  await bookFirstSlot(page, {
    category: "Barba",
    service: "Perfilado de barba",
    date,
    customer,
  });
  await loginAsDemo(page);

  const card = page.getByRole("listitem").filter({ hasText: customer });
  const pastSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Ya pasaron" }) });

  // Temprano ese día: la reserva todavía viene, arriba y sin "Ya pasaron"
  await page.clock.setFixedTime(zonedTime(date, "00:01"));
  await page.goto("/dashboard/agenda");
  await expect(card).toBeVisible();
  await expect(pastSection).toHaveCount(0);

  // Al final del día: ya terminó, baja a "Ya pasaron" con sus botones
  await page.clock.setFixedTime(zonedTime(date, "23:59"));
  await page.reload();
  await expect(page.getByText("No quedan reservas por hoy.")).toBeVisible();
  const pastCard = pastSection
    .getByRole("listitem")
    .filter({ hasText: customer });
  await expect(pastCard).toBeVisible();
  await expect(
    pastCard.getByRole("button", { name: "Completada" }),
  ).toBeVisible();

  // Al día siguiente, ese día ya es pasado y se ve normal: una sola lista
  await page.clock.setFixedTime(
    zonedTime(date, "23:59").getTime() + 86_400_000,
  );
  await page.goto(`/dashboard/agenda?date=${date}`);
  await expect(card).toBeVisible();
  await expect(pastSection).toHaveCount(0);
});
