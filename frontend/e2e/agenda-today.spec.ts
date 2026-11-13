import { expect, test } from "@playwright/test";
import { bookFirstSlot, loginAsDemo, workdayFrom, zonedTime } from "./helpers";

// "10:00 a. m." / "01:30 p. m." (como lo muestra la página pública) -> "HH:MM"
// un minuto después, en 24 horas
function oneMinuteAfter(label: string): string {
  const match = label.match(/(\d{1,2}):(\d{2})\s*([ap])?/i);
  if (!match) throw new Error(`Hora inesperada: ${label}`);
  let hours = Number(match[1]);
  const period = match[3]?.toLowerCase(); // sin a/p: ya viene en 24 horas
  if (period === "a" && hours === 12) hours = 0;
  if (period === "p" && hours !== 12) hours += 12;
  const total = hours * 60 + Number(match[2]) + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

// En la agenda de hoy, las reservas que ya terminaron bajan a "Ya pasaron" y
// conservan sus botones. Con el reloj simulado del navegador, un día futuro
// pasa a ser "hoy" sin depender de la hora a la que corre la prueba
test("en la agenda de hoy, las reservas que ya pasaron van abajo", async ({
  page,
}) => {
  const date = workdayFrom(15);
  const customer = `Hoy E2E ${Date.now().toString(36)}`;
  const start = await bookFirstSlot(page, {
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

  // Un minuto después de empezar: está en curso y sigue arriba (baja recién
  // cuando termina, no cuando empieza)
  await page.clock.setFixedTime(zonedTime(date, oneMinuteAfter(start)));
  await page.reload();
  await expect(card).toBeVisible();
  await expect(pastSection.getByText(customer)).toHaveCount(0);

  // Al final del día: ya terminó, baja a "Ya pasaron" con sus botones, y como
  // hoy no queda ninguna por venir aparece la próxima reserva (de otro día)
  await page.clock.setFixedTime(zonedTime(date, "23:59"));
  await page.reload();
  await expect(page.getByText("No quedan reservas por hoy.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Próxima reserva" }),
  ).toBeVisible();
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
