import { expect, request, test } from "@playwright/test";

// La puerta de entrada de un negocio nuevo: se registra, entra a su panel y,
// hasta confirmar su correo, su página pública no recibe reservas
test("un negocio nuevo se registra y queda esperando confirmar su correo", async ({
  page,
}) => {
  const run = Date.now().toString(36);
  const email = `nuevo-${run}@test.local`;
  const slug = `nuevo-${run}`;

  await page.goto("/register");
  await page.getByPlaceholder("Tu nombre").fill("Dueña Nueva");
  await page.getByPlaceholder("Correo").fill(email);
  await page.getByPlaceholder("Contraseña").fill("password123");
  await page.getByPlaceholder("Nombre del negocio").fill(`Taller ${run}`);
  await page.getByPlaceholder("Link de tu negocio").fill(slug);
  // Ve cómo queda su link antes de crear la cuenta
  await expect(page.getByText(`reservahoy.cl/${slug}`)).toBeVisible();
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  // Entra a su panel, con el aviso para confirmar el correo
  await page.waitForURL("**/dashboard/**");
  await expect(page.getByText(`Taller ${run}`)).toBeVisible();
  await expect(page.getByText("Confirma tu correo")).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  // Su página pública existe, pero todavía no acepta reservas
  await page.goto(`/${slug}`);
  await expect(
    page.getByRole("heading", { name: `Taller ${run}` }),
  ).toBeVisible();
  await expect(page.getByText("todavía no recibe reservas")).toBeVisible();

  // Un segundo registro con el mismo nombre de página se rechaza con un mensaje
  // claro. Va directo a la API con otra IP: registrarse tiene un límite de 5 por
  // minuto y así la prueba se puede repetir seguido
  const api = await request.newContext({
    baseURL: process.env.E2E_API_URL ?? "http://localhost:3000",
    extraHTTPHeaders: { "X-Forwarded-For": "203.0.113.20" },
  });
  const duplicate = await api.post("/auth/register", {
    data: {
      name: "Otra persona",
      email: `otro-${run}@test.local`,
      password: "password123",
      businessName: "Otro taller",
      slug,
    },
  });
  expect(duplicate.status()).toBe(409);
  expect((await duplicate.json()).message).toBe("Ese slug ya está en uso");
  await api.dispose();
});
