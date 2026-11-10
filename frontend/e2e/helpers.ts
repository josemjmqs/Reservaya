import { readFileSync } from "fs";
import { expect, type Page } from "@playwright/test";

// Utilidades compartidas por las pruebas e2e (negocio demo del seed)

export const DEMO = {
  slug: "demo-peluqueria",
  email: "demo@reservahoy.local",
  password: "demo1234",
};

const TZ = "America/Santiago";
const isoDate = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const weekday = (d: Date) =>
  d.toLocaleDateString("en-US", { timeZone: TZ, weekday: "short" });

// El primer día que cumple `ok` desde dentro de `fromDays` días (YYYY-MM-DD)
function dayFrom(fromDays: number, ok: (d: Date) => boolean): string {
  const d = new Date(Date.now() + fromDays * 86_400_000);
  while (!ok(d)) d.setDate(d.getDate() + 1);
  return isoDate(d);
}

// Día hábil (lunes a sábado) lejos de las reservas del seed. Cada prueba usa
// su propio desfase para no pisarse con las demás
export const workdayFrom = (fromDays: number) =>
  dayFrom(fromDays, (d) => weekday(d) !== "Sun");
export const sundayFrom = (fromDays: number) =>
  dayFrom(fromDays, (d) => weekday(d) === "Sun");

// Sesión del dueño demo, guardada una sola vez por auth.setup.ts (el login tiene
// un límite de 5 intentos por minuto y varias pruebas la necesitan)
export const AUTH_FILE = "e2e/.auth/demo.json";

export async function loginAsDemo(page: Page) {
  const { cookies } = JSON.parse(readFileSync(AUTH_FILE, "utf8"));
  await page.context().addCookies(cookies);
  await page.goto("/dashboard/agenda");
  await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible();
}

const slotButtons = (page: Page) =>
  page.getByRole("button", { name: /^\d{1,2}:\d{2}/ });

// Abre la página pública, elige un servicio y un día, y devuelve las horas ofrecidas
export async function openSlots(
  page: Page,
  {
    category,
    service,
    date,
  }: { category: string; service: string; date: string },
): Promise<string[]> {
  await page.goto(`/${DEMO.slug}`);
  await page.getByRole("button", { name: new RegExp(`^${category}`) }).click();
  await page.getByRole("button", { name: new RegExp(service) }).click();
  // Espera la respuesta de ese día: mientras carga, la página muestra
  // "No hay horas disponibles" y la lista se leería vacía
  const loaded = page.waitForResponse(
    (r) =>
      r.url().includes("/availability") && r.url().includes(`date=${date}`),
  );
  await page.locator('input[type="date"]').fill(date);
  await loaded;
  await expect(
    slotButtons(page).first().or(page.getByText("No hay horas disponibles")),
  ).toBeVisible();
  return (await slotButtons(page).allTextContents()).map((t) => t.trim());
}

// Reserva la primera hora libre y devuelve esa hora (tal como se mostró)
export async function bookFirstSlot(
  page: Page,
  opts: { category: string; service: string; date: string; customer: string },
): Promise<string> {
  const [time] = await openSlots(page, opts);
  expect(time, "debería haber horas libres ese día").toBeTruthy();
  await slotButtons(page).first().click();
  await page.getByPlaceholder("Nombre").fill(opts.customer);
  await page.getByPlaceholder("Correo").fill(`e2e-${Date.now()}@ejemplo.cl`);
  await page.getByRole("button", { name: "Confirmar reserva" }).click();
  await expect(page.getByText("¡Reserva confirmada!")).toBeVisible();
  return time;
}
