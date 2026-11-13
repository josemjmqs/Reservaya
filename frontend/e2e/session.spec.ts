import { readFileSync } from "fs";
import { expect, test } from "@playwright/test";
import { AUTH_FILE, loginAsDemo } from "./helpers";

// La sesión del panel dura 30 días (y se renueva con el uso, lo que cubre
// session.spec.ts en el backend). Si vence con el panel abierto, la siguiente
// petición lleva al login con un aviso en vez de mostrar "Unauthorized"

test("la sesión del dueño dura 30 días", async () => {
  const { cookies } = JSON.parse(readFileSync(AUTH_FILE, "utf8")) as {
    cookies: { name: string; expires: number }[];
  };
  const token = cookies.find((c) => c.name === "token");
  expect(token, "auth.setup.ts guarda la cookie de sesión").toBeTruthy();
  const days = (token!.expires * 1000 - Date.now()) / 86_400_000;
  expect(days).toBeGreaterThan(29);
  expect(days).toBeLessThanOrEqual(30);
});

test("si la sesión vence con el panel abierto, va al login con un aviso", async ({
  page,
}) => {
  await loginAsDemo(page); // deja la agenda abierta
  // Que termine de cargar: si no, una petición de la carga inicial responde
  // 401 y lleva al login antes del clic en "Actualizar"
  await page.waitForLoadState("networkidle");
  await page.context().clearCookies();
  await page.getByRole("button", { name: "Actualizar" }).click();

  await expect(page).toHaveURL(/\/login\?expired=1$/);
  await expect(
    page.getByRole("status").filter({ hasText: "Tu sesión expiró" }),
  ).toBeVisible();
  await expect(page.getByText("Unauthorized")).toHaveCount(0);
});
