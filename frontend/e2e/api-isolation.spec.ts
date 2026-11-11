import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import {
  expect,
  request,
  test,
  type APIRequestContext,
  type APIResponse,
} from "@playwright/test";

// Aislamiento entre negocios en TODA la API, con peticiones HTTP reales:
// - sin sesión, cada ruta del panel responde 401
// - con la sesión de otro negocio, nunca se ve ni se cambia nada ajeno (404 / 400)
// Negocio A = demo del seed. Negocio B = uno nuevo registrado por la prueba.

const API = process.env.E2E_API_URL ?? "http://localhost:3000";
const run = Date.now().toString(36);

// Cada contexto usa su propia IP (X-Forwarded-For; el backend confía en un proxy)
// para no chocar con el límite de 60 peticiones por minuto por IP
const context = (ip: string) =>
  request.newContext({
    baseURL: API,
    extraHTTPHeaders: { "X-Forwarded-For": ip },
  });

const dateIn = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toLocaleDateString("en-CA", {
    timeZone: "America/Santiago",
  });
const range = `from=${dateIn(-7)}&to=${dateIn(14)}`;

interface Ids {
  member: string;
  service: string;
  booking: string;
  block: string;
}
type Call = (ctx: APIRequestContext, a: Ids) => Promise<APIResponse>;

// Rutas que no requieren sesión (públicas o de autenticación)
const PUBLIC_ROUTES = [
  "GET /",
  "GET /health",
  "GET /health/live",
  "POST /auth/register",
  "POST /auth/login",
  "POST /auth/logout",
  "POST /auth/forgot-password",
  "POST /auth/reset-password",
  "POST /auth/verify-email",
  "GET /public/:slug",
  "GET /public/:slug/availability",
  "POST /public/:slug/bookings",
  "GET /public/bookings/:token",
  "POST /public/bookings/:token/cancel",
];

// Rutas del panel: cómo llamarlas apuntando a recursos del negocio A y qué debe
// responder el negocio B. `other` es el estado esperado o una revisión propia.
const PANEL_ROUTES: Record<
  string,
  {
    call: Call;
    other: number | number[] | ((res: APIResponse, a: Ids) => Promise<void>);
  }
> = {
  "GET /auth/me": {
    call: (c) => c.get("/auth/me"),
    other: async (res) => {
      expect((await res.json()).email).not.toBe("demo@reservahoy.local");
    },
  },
  "POST /auth/resend-verification": {
    // B reenvía su propio correo: no toca nada de A
    call: (c) => c.post("/auth/resend-verification"),
    other: [200, 429],
  },
  "GET /agenda": {
    call: (c, a) => c.get(`/agenda?${range}&memberId=${a.member}`),
    other: 404,
  },
  "GET /agenda/next": {
    call: (c, a) => c.get(`/agenda/next?memberId=${a.member}`),
    other: 404,
  },
  "PATCH /agenda/:id/status": {
    call: (c, a) =>
      c.patch(`/agenda/${a.booking}/status`, { data: { status: "CANCELLED" } }),
    other: 404,
  },
  "GET /services": {
    call: (c) => c.get("/services"),
    other: async (res, a) => {
      const ids = (await res.json()).map((s: { id: string }) => s.id);
      expect(ids).not.toContain(a.service);
    },
  },
  "POST /services": {
    // crea un servicio en B; no hay id de A que apuntar
    call: (c) =>
      c.post("/services", { data: { name: "Servicio B", durationMin: 30 } }),
    other: 201,
  },
  "PATCH /services/:id": {
    call: (c, a) =>
      c.patch(`/services/${a.service}`, { data: { name: "Hackeado" } }),
    other: 404,
  },
  "POST /services/:id/image": {
    // sin R2 configurado responde 503 antes de mirar el dueño; nunca 2xx
    call: (c, a) => c.post(`/services/${a.service}/image`),
    other: [404, 503],
  },
  "DELETE /services/:id/image": {
    call: (c, a) => c.delete(`/services/${a.service}/image`),
    other: 404,
  },
  "DELETE /services/:id": {
    call: (c, a) => c.delete(`/services/${a.service}`),
    other: 404,
  },
  "GET /members": {
    call: (c) => c.get("/members"),
    other: async (res, a) => {
      const ids = (await res.json()).map((m: { id: string }) => m.id);
      expect(ids).not.toContain(a.member);
    },
  },
  "POST /members": {
    // asignarle a un profesional de B un servicio de A
    call: (c, a) =>
      c.post("/members", {
        data: { displayName: "Intruso", serviceIds: [a.service] },
      }),
    other: 400,
  },
  "PATCH /members/:id": {
    call: (c, a) =>
      c.patch(`/members/${a.member}`, { data: { active: false } }),
    other: 404,
  },
  "GET /working-hours": {
    call: (c, a) => c.get(`/working-hours?memberId=${a.member}`),
    other: 404,
  },
  "PUT /working-hours": {
    call: (c, a) =>
      c.put("/working-hours", {
        data: {
          memberId: a.member,
          days: [{ weekday: 1, opensAt: "10:00", closesAt: "11:00" }],
        },
      }),
    other: 404,
  },
  "GET /time-blocks": {
    call: (c) => c.get("/time-blocks"),
    other: async (res, a) => {
      const ids = (await res.json()).blocks.map((b: { id: string }) => b.id);
      expect(ids).not.toContain(a.block);
    },
  },
  "POST /time-blocks": {
    call: (c, a) =>
      c.post("/time-blocks", {
        data: {
          startDate: "2033-02-01",
          endDate: "2033-02-01",
          allDay: true,
          memberId: a.member,
        },
      }),
    other: 404,
  },
  "DELETE /time-blocks/:id": {
    call: (c, a) => c.delete(`/time-blocks/${a.block}`),
    other: 404,
  },
  "GET /business": {
    call: (c) => c.get("/business"),
    other: async (res) => {
      expect((await res.json()).name).not.toBe("Peluquería Demo");
    },
  },
  "PATCH /business": {
    // B cambia su propio negocio; al final se revisa que el de A siga igual
    call: (c) =>
      c.patch("/business", {
        data: { name: "Negocio B editado", phone: "22 222 2222" },
      }),
    other: 200,
  },
  "GET /settings": {
    call: (c) => c.get("/settings"),
    other: async (res) => {
      expect((await res.json()).email).not.toBe("demo@reservahoy.local");
    },
  },
  "PATCH /settings": {
    // B cambia sus propios ajustes; al final se revisa que los de A sigan igual
    call: (c) => c.patch("/settings", { data: { newBookingEmail: false } }),
    other: 200,
  },
};

// Todas las rutas declaradas en los controladores del backend
function backendRoutes(): string[] {
  const root = join(process.cwd(), "../backend/src");
  const files = readdirSync(root, { recursive: true, encoding: "utf8" }).filter(
    (f) => f.endsWith(".controller.ts"),
  );
  return files.flatMap((f) => {
    const src = readFileSync(join(root, f), "utf8");
    const prefix = src.match(/@Controller\((?:'([^']*)')?\)/)?.[1] ?? "";
    return [
      ...src.matchAll(/@(Get|Post|Patch|Put|Delete)\((?:'([^']*)')?\)/g),
    ].map(
      ([, method, path]) =>
        `${method.toUpperCase()} /${[prefix, path].filter(Boolean).join("/")}`,
    );
  });
}

let anon: APIRequestContext;
let ownerA: APIRequestContext;
let ownerB: APIRequestContext;
const a = {} as Ids;

test.beforeAll(async () => {
  [anon, ownerA, ownerB] = await Promise.all([
    context("203.0.113.10"),
    context("203.0.113.11"),
    context("203.0.113.12"),
  ]);

  const login = await ownerA.post("/auth/login", {
    data: { email: "demo@reservahoy.local", password: "demo1234" },
  });
  expect(login.ok(), "¿Corriste el seed? (npx prisma db seed)").toBeTruthy();

  const register = await ownerB.post("/auth/register", {
    data: {
      name: "Dueño B",
      email: `e2e-${run}@test.local`,
      password: "password123",
      businessName: "Negocio B",
      slug: `e2e-${run}`,
    },
  });
  expect(register.ok()).toBeTruthy();

  a.member = (await (await ownerA.get("/members")).json())[0].id;
  a.service = (await (await ownerA.get("/services")).json())[0].id;
  const agenda = await (await ownerA.get(`/agenda?${range}`)).json();
  expect(
    agenda.length,
    "el seed debe dejar reservas en el negocio demo",
  ).toBeGreaterThan(0);
  a.booking = agenda[0].id;
  a.block = (
    await (
      await ownerA.post("/time-blocks", {
        data: {
          startDate: "2033-01-10",
          endDate: "2033-01-10",
          allDay: true,
          reason: "e2e",
        },
      })
    ).json()
  ).id;
});

test.afterAll(async () => {
  await ownerA?.delete(`/time-blocks/${a.block}`);
  await Promise.all([anon, ownerA, ownerB].map((c) => c?.dispose()));
});

test("cada ruta del backend está clasificada como pública o del panel", () => {
  const known = new Set([...PUBLIC_ROUTES, ...Object.keys(PANEL_ROUTES)]);
  const missing = backendRoutes().filter((r) => !known.has(r));
  expect(
    missing,
    "Ruta nueva sin cubrir: agrégala a PANEL_ROUTES (con su prueba de aislamiento) o a PUBLIC_ROUTES",
  ).toEqual([]);
});

for (const [route, { call }] of Object.entries(PANEL_ROUTES)) {
  test(`sin sesión: ${route} responde 401`, async () => {
    const fake = { member: "x", service: "x", booking: "x", block: "x" };
    expect((await call(anon, fake)).status()).toBe(401);
  });
}

for (const [route, { call, other }] of Object.entries(PANEL_ROUTES)) {
  test(`otro negocio: ${route} no ve ni cambia nada ajeno`, async () => {
    const res = await call(ownerB, a);
    if (typeof other === "function") {
      expect(res.status()).toBe(200);
      await other(res, a);
    } else {
      expect([other].flat()).toContain(res.status());
    }
  });
}

test("los datos del negocio A siguen intactos", async () => {
  const agenda = await (await ownerA.get(`/agenda?${range}`)).json();
  expect(
    agenda.find((b: { id: string }) => b.id === a.booking).status,
  ).not.toBe("CANCELLED");
  const services = await (await ownerA.get("/services")).json();
  const service = services.find((s: { id: string }) => s.id === a.service);
  expect(service.name).not.toBe("Hackeado");
  expect(service.active).toBe(true);
  const members = await (await ownerA.get("/members")).json();
  expect(members.find((m: { id: string }) => m.id === a.member).active).toBe(
    true,
  );
  expect((await (await ownerA.get("/settings")).json()).newBookingEmail).toBe(
    true,
  );
  expect(await (await ownerA.get("/business")).json()).toMatchObject({
    name: "Peluquería Demo",
    phone: "+56 9 1234 5678",
  });
  const blocks = (await (await ownerA.get("/time-blocks")).json()).blocks;
  expect(blocks.map((b: { id: string }) => b.id)).toContain(a.block);
});
