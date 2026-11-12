# Reservahoy

Plataforma de reservas online para pequeños negocios. Cada negocio tiene una página pública (`/[slug]`) donde sus clientes reservan sin cuenta, y un panel para administrar servicios, equipo, horarios y agenda.

## Stack
- Backend: NestJS 12 (CommonJS), TypeScript, Prisma 6.19 (NO usar Prisma 7), PostgreSQL 16
- Frontend: Next.js (App Router, `src/`), TypeScript, Tailwind v4 (`@tailwindcss/postcss`)
- Node 22. Tests: Jest en modo ESM (unitarios `*.spec.ts`, integración `*.int-spec.ts` contra PostgreSQL)
- Infra: Vercel (frontend), Render (API), Neon (DB), Cloudflare (DNS, R2 para respaldos y para fotos de servicios), Resend (correo)

## Estructura
- `backend/`: API (auth, business, services, members, working-hours, availability, bookings, agenda, notifications, settings)
- `frontend/`: Next.js. El navegador llama a `/api/*` (rewrite hacia el backend con `API_URL`), así la cookie de sesión es first-party
- `docker-compose.yml`: PostgreSQL local en el puerto 5433

## Comandos
- Todo `npm`/`npx` se ejecuta DENTRO de `backend/` o `frontend/`; en la raíz solo `docker compose` y `git`
- Backend: `npm run start:dev`, `npx nest build`, `npm test`, `npm run test:integration`
- Frontend: `npm run dev` (puerto 3001), `npx tsc --noEmit`, `npm run lint`, `npm run build`
- Base local: `docker compose up -d`; consola: `docker compose exec db psql -U reservaya -d reservaya`
- Datos de prueba: `npx prisma db seed` (en `backend/`, `prisma/seed.mts`): negocio demo `demo-peluqueria`, login `demo@reservahoy.local` / `demo1234`; `SEED_TODAY=1` agrega reservas hoy. Solo corre contra bases locales

## Reglas del proyecto
- El `businessId` SIEMPRE se obtiene de la membresía del usuario autenticado, nunca del cliente. Recursos de otro negocio responden 404
- La restricción `booking_no_overlap` (exclusion constraint de PostgreSQL) es la garantía final contra dobles reservas; solape y deadlock se traducen a 409
- Todas las fechas se guardan en UTC y se convierten con luxon según la zona del negocio (`America/Santiago`)
- Código y nombres en inglés; textos visibles al usuario en español
- Sesión: JWT en cookie `httpOnly` (también se acepta header Bearer para pruebas)
- Correos: nunca deben romper el flujo principal (el envío captura sus errores) y se mandan sin `await` (`void`). Todos pasan por `NotificationsService.send`, que reintenta 3 veces ante fallas pasajeras (`isTransient`) con la misma clave de idempotencia de Resend
- Al crear una reserva se avisa por correo a los miembros activos con cuenta y `notifyNewBookings` (`BookingsService.notifyStaff`, preferencia en `/settings`)
- Si el negocio cancela (`PATCH /agenda/:id/status` a `CANCELLED`, motivo opcional `reason`), se avisa al cliente por correo una sola vez: solo quien pasa la reserva de activa a cancelada envía (`updateMany` condicional en `AgendaService.updateStatus`)
- Datos del negocio (nombre, teléfono): `GET/PATCH /business`, solo el `OWNER` los cambia. Las preferencias de cada miembro van en `/settings`
- Los correos se normalizan a minúsculas (trim + lowercase)
- Un negocio recibe reservas solo si su dueño tiene `emailVerifiedAt` (`AvailabilityService.acceptsBookings`)
- Los tokens de un solo uso (reset de contraseña, verificación de correo) se guardan solo como hash SHA-256
- Al crear una ruta nueva en el frontend, agregarla a `RESERVED_SLUGS` (`register.dto.ts`)
- Una reserva tiene uno o más servicios en `BookingItem` (orden en `position`) y los hace un solo profesional seguidos: el bloque dura la suma (`blockFor`). Usar `AvailabilityService.resolveServices` y `membersForServices`; máximo en `MAX_SERVICES_PER_BOOKING`
- Fotos: se guarda solo `imageKey` (ruta en el bucket) y la API responde `imageUrl` armada con `R2_PUBLIC_URL` (`StorageService.urlFor`). El tipo se valida por los bytes (`detectImageType`), nunca por el nombre o el Content-Type. Sin variables `R2_*` la subida responde 503

## Tests
- Jest corre en ESM porque NestJS 12 es solo ESM: configuración en `jest.config.ts`, `test/jest-int.json` y `tsconfig.spec.json`; los scripts usan `node --experimental-vm-modules`
- Los servicios se prueban instanciándolos con un `PrismaClient` real (ej. `time-blocks.service.int-spec.ts`)
- Todavía no se puede cargar `AppModule` ni `AuthController` en Jest: `@nestjs/throttler` es CommonJS y hace `require` de `@nestjs/common` (ESM); Jest lo soporta recién en Node 24.9+
- Pruebas e2e con Playwright en `frontend/e2e/` (`npm run e2e` en `frontend/`, con backend y frontend levantados y el seed corrido): `api-isolation.spec.ts` prueba todas las rutas del panel (401 sin sesión, 404 con otro negocio); el resto, los flujos en el navegador (reserva, cancelación con enlace, registro, configuración del negocio, horario cargando). El dueño demo inicia sesión una sola vez (`auth.setup.ts`) y las pruebas reutilizan la sesión con `loginAsDemo`: el login tiene un límite de 5 por minuto. Backend con `THROTTLE_LIMIT=1000` (límite global configurable; en producción queda en 60). Las pruebas que cambian el negocio demo lo dejan como estaba. Al crear una ruta nueva en el backend, agregarla a `PANEL_ROUTES` (con su caso de aislamiento) o a `PUBLIC_ROUTES`: la prueba falla si hay rutas sin clasificar
- Cada carpeta de `frontend/src/app` debe estar en `RESERVED_SLUGS`: lo revisa `auth-dto.spec.ts`

## Prisma y migraciones
- No editar migraciones ya aplicadas; crear nuevas con `npx prisma migrate dev --name ...`
- Detener el servidor antes de `prisma generate`/`migrate` (EPERM en Windows)
- Producción aplica migraciones con `prisma migrate deploy` al arrancar (Render)
- `/health/live` no debe tocar la base: UptimeRobot lo visita cada 5 min para que Render gratis no duerma el backend

## Seguridad
- NUNCA leer, mostrar ni commitear archivos `.env`, claves de Neon/R2/Resend, ni `age-key.txt`
- Los respaldos y dumps viven fuera del repo
- No ejecutar comandos destructivos ni contra producción sin confirmación explícita

## Flujo de trabajo
- Una rama por función (`feat/...`, `fix/...`, `docs/...`), PR, CI en verde (`backend`, `frontend`, `integration`, `e2e`) y merge
- Por ahora los PR se mergean apenas el CI está en verde, con el merge automático de GitHub (mergear a `main` despliega a producción). Cuando el proyecto tenga usuarios reales, el dueño pasará a mergear él mismo tras revisar
- Push y PR desde la carpeta local con la sesión de GitHub CLI del dueño (`gh auth login` + `gh auth setup-git`): `git push -u origin <rama>`, `gh pr create` y, enseguida, `gh pr merge <n> --auto --merge`. GitHub mergea solo cuando pasan los checks obligatorios y borra la rama remota (el repo tiene "Allow auto-merge" y "Automatically delete head branches"). Si se suben más commits al PR, el merge automático sigue activo. Si `gh` no está en el PATH, usar `C:\Program Files\GitHub CLI\gh.exe`. Nunca pedir ni manejar tokens: si la sesión vence, el dueño corre `gh auth login`
- `main` está protegida por un ruleset: solo se cambia por PR, exige `backend`, `frontend`, `integration` y `e2e` en verde y la rama al día con `main` (si quedó atrás: `gh pr update-branch <n>`). Si un check falla, el merge automático espera: arreglar en la misma rama y subir otro commit. Un job de CI nuevo que deba bloquear el merge se agrega también al ruleset
- Para volver a `main` tras un merge usar `git switch -C main origin/main`, nunca `git checkout main` con un `main` local desactualizado
- Tras mergear, borrar la rama y crear una nueva para el siguiente cambio
- Antes de commitear: `npx nest build` (backend) y `npx tsc --noEmit` + `npm run lint` + `npm run build` (frontend)
- En efectos de React no llamar `setState` de forma síncrona: el efecto llama a una función que solo hace el fetch y guarda el resultado en el `.then` (regla de `eslint-config-next`)
- Cambios de interfaz: antes de mergear, levantar backend y frontend con el seed e iniciar sesión con Playwright para revisarlos en pantalla (escritorio y celular)
- Commits pequeños con prefijos `feat:`, `fix:`, `docs:`, `chore:`, `test:`
- Tras cada cambio, anotar en `CODE_REVIEW.md` los archivos modificados en orden de lectura, agrupados por commit (hash + mensaje). Es una lista local (en `.gitignore`): el dueño lo lee de arriba hacia abajo y borra lo que ya revisó, así que las entradas nuevas van SIEMPRE al final y nunca se restauran las borradas

## Pendientes conocidos
- Recordatorios por correo 24 h antes
- Correo de contacto con dominio propio (Cloudflare Email Routing)
- WhatsApp, trabajadores con cuenta propia, campos personalizados, pagos