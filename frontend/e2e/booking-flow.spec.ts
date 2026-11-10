import { expect, test } from "@playwright/test";

// Lo que de verdad le importa a un negocio: un cliente reserva desde la página
// pública y el dueño la ve en su agenda. Usa el negocio demo del seed.

// Un día hábil (lunes a sábado) a más de una semana: el seed no deja reservas ahí
function freeWorkday(): string {
  const d = new Date(Date.now() + 9 * 86_400_000);
  const weekday = (day: Date) =>
    day.toLocaleDateString("en-US", {
      timeZone: "America/Santiago",
      weekday: "short",
    });
  while (weekday(d) === "Sun") d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
}

test("un cliente reserva desde la página pública y el dueño la ve en su agenda", async ({
  page,
}) => {
  const date = freeWorkday();
  const customer = `Cliente E2E ${Date.now().toString(36)}`;

  // 1. Cliente: elige servicio, día y hora, y reserva sin cuenta
  await page.goto("/demo-peluqueria");
  await expect(
    page.getByRole("heading", { name: "Peluquería Demo" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Pelo/ }).click();
  await page.getByRole("button", { name: /Corte de pelo/ }).click();
  await page.locator('input[type="date"]').fill(date);

  const firstSlot = page
    .getByRole("button", { name: /^\d{1,2}:\d{2}/ })
    .first();
  await expect(firstSlot).toBeVisible();
  const time = (await firstSlot.textContent())!.trim();
  await firstSlot.click();

  await page.getByPlaceholder("Nombre").fill(customer);
  await page.getByPlaceholder("Correo").fill(`e2e-${Date.now()}@ejemplo.cl`);
  await page.getByRole("button", { name: "Confirmar reserva" }).click();
  await expect(page.getByText("¡Reserva confirmada!")).toBeVisible();

  // 2. Dueño: inicia sesión y la ve en la agenda de ese día
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("demo@reservahoy.local");
  await page.locator('input[type="password"]').fill("demo1234");
  await page.locator('input[type="password"]').press("Enter");
  await page.waitForURL("**/dashboard/**");

  await page.goto(`/dashboard/agenda?date=${date}`);
  const card = page.getByRole("listitem").filter({ hasText: customer });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Corte de pelo");
  await expect(card).toContainText("Confirmada");
  await expect(card).toContainText(time);
});
