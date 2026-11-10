import { defineConfig, devices } from "@playwright/test";

// Pruebas de punta a punta contra la app levantada con el seed
// (backend en :3000 y frontend en :3001). Ver "Pruebas e2e" en el README.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_FRONTEND_URL ?? "http://localhost:3001",
    locale: "es-CL",
    timezoneId: "America/Santiago",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
