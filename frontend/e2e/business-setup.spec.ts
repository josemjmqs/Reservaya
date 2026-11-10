import { expect, test, type Page } from "@playwright/test";
import { loginAsDemo, openSlots, sundayFrom } from "./helpers";

// Abre el horario y espera a que llegue el guardado: antes de eso la página
// muestra todos los días cerrados
async function openHours(page: Page) {
  const loaded = page.waitForResponse(
    (r) =>
      r.url().includes("/api/working-hours") && r.request().method() === "GET",
  );
  await page.goto("/dashboard/hours");
  await loaded;
}

// El dueño configura su negocio desde el panel y se refleja en su página
// pública: un servicio nuevo y abrir un día que estaba cerrado (domingo)
test("un servicio y un horario nuevos del panel aparecen en la página pública", async ({
  page,
}) => {
  const service = `Masaje E2E ${Date.now().toString(36)}`;
  const sunday = sundayFrom(8);
  await loginAsDemo(page);

  // Servicio nuevo (se asigna solo a la dueña)
  await page.goto("/dashboard/services");
  await page.getByLabel("Nombre").fill(service);
  await page.getByLabel("Categoría").fill("Bienestar");
  await page.getByLabel("Tiempo de atención (min)").fill("60");
  await page.getByRole("button", { name: "Agregar" }).click();
  await expect(page.getByText(service)).toBeVisible();

  // El domingo está cerrado: no hay horas
  expect(
    await openSlots(page, { category: "Bienestar", service, date: sunday }),
  ).toEqual([]);

  // Abre el domingo de 10:00 a 13:00
  await openHours(page);
  const domingo = page.getByRole("listitem").filter({ hasText: "Domingo" });
  await domingo.getByRole("checkbox").check();
  await domingo.locator('input[type="time"]').first().fill("10:00");
  await domingo.locator('input[type="time"]').last().fill("13:00");
  await page.getByRole("button", { name: "Guardar horario" }).click();
  await expect(page.getByText("Horario guardado.")).toBeVisible();

  try {
    // Ahora el domingo ofrece 10:00, 11:00 y 12:00 para el servicio nuevo
    const slots = await openSlots(page, {
      category: "Bienestar",
      service,
      date: sunday,
    });
    expect(slots.map((s) => s.slice(0, 5))).toEqual([
      "10:00",
      "11:00",
      "12:00",
    ]);
  } finally {
    // Deja el negocio demo como estaba: domingo cerrado y sin el servicio de prueba
    await openHours(page);
    await page
      .getByRole("listitem")
      .filter({ hasText: "Domingo" })
      .getByRole("checkbox")
      .uncheck();
    await page.getByRole("button", { name: "Guardar horario" }).click();
    await expect(page.getByText("Horario guardado.")).toBeVisible();
    const services: { id: string; name: string }[] = await (
      await page.request.get("/api/services")
    ).json();
    const created = services.find((s) => s.name === service);
    if (created) await page.request.delete(`/api/services/${created.id}`);
  }
});
