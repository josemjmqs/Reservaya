import { expect, test } from "@playwright/test";
import { DEMO, loginAsDemo } from "./helpers";

// El dueño cambia el nombre y el teléfono de su negocio en Ajustes: el
// encabezado del panel se actualiza y el teléfono aparece en su página pública
test("el dueño edita nombre y teléfono y se ven en el panel y en su página", async ({
  page,
}) => {
  await loginAsDemo(page);
  await page.goto("/dashboard/settings");
  const name = page.getByLabel("Nombre del negocio");
  const phone = page.getByLabel("Teléfono");
  await expect(name).toHaveValue("Peluquería Demo");

  try {
    await name.fill("Peluquería Demo Centro");
    await phone.fill("+56 9 5555 0000");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Guardado." }),
    ).toBeVisible();
    await expect(
      page.getByText("Peluquería Demo Centro").first(),
    ).toBeVisible();

    // Un teléfono con letras se rechaza con un mensaje claro
    await phone.fill("llámame");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(
      page.getByText("El teléfono solo puede tener números"),
    ).toBeVisible();

    await page.goto(`/${DEMO.slug}`);
    await expect(
      page.getByRole("heading", { name: "Peluquería Demo Centro" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "+56 9 5555 0000" }),
    ).toHaveAttribute("href", "tel:+56955550000");
  } finally {
    // Deja el negocio demo como estaba
    await page.request.patch("/api/business", {
      data: { name: "Peluquería Demo", phone: "+56 9 1234 5678" },
    });
  }
});
