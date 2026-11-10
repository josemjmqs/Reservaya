# Reservahoy

Plataforma de reservas online para pequeños negocios. Cada negocio tiene una página pública (`/[slug]`) donde sus clientes reservan sin cuenta, y un panel para administrar servicios, equipo, horarios y agenda.

## Stack
- Backend: NestJS 12 (CommonJS), TypeScript, Prisma 6.19 (NO usar Prisma 7), PostgreSQL 16
- Frontend: Next.js (App Router, `src/`), TypeScript, Tailwind v4 (`@tailwindcss/postcss`)
- Node 22. Tests: Jest en modo ESM (unitarios `*.spec.ts`, integración `*.int-spec.ts` contra PostgreSQL)
- Infra: Vercel (frontend), Render (API), Neon (DB), Cloudflare (DNS, R2 para respaldos y para fotos de servicios), Resend (correo)

## Estructura
- `backend/`: API (auth, services, members, working-hours, availability, bookings, agenda, notifications)
- `frontend/`: Next.js. El navegador llama a `/api/*` (rewrite hacia el backend con `API_URL`), así la cookie de sesión es first-party
- `docker-compose.yml`: PostgreSQL local en el puerto 5433

## Comandos
- Todo `npm`/`npx` se ejecuta DENTRO de `backend/` o `frontend/`; en la raíz solo `docker compose` y `git`
- Backend: `npm run start:dev`, `npx nest build`, `npm test`, `npm run test:integration`
- Frontend: `npm run dev` (puerto 3001), `npx tsc --noEmit`, `npm run lint`, `npm run build`
- Base local: `docker compose up -d`; consola: `docker compose exec db psql -U reservaya -d reservaya`

## Reglas del proyecto
- El `businessId` SIEMPRE se obtiene de la membresía del usuario autenticado, nunca del cliente. Recursos de otro negocio responden 404
- La restricción `booking_no_overlap` (exclusion constraint de PostgreSQL) es la garantía final contra dobles reservas; solape y deadlock se traducen a 409
- Todas las fechas se guardan en UTC y se convierten con luxon según la zona del negocio (`America/Santiago`)
- Código y nombres en inglés; textos visibles al usuario en español
- Sesión: JWT en cookie `httpOnly` (también se acepta header Bearer para pruebas)
- Correos: nunca deben romper el flujo principal (el envío captura sus errores)
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

## Prisma y migraciones
- No editar migraciones ya aplicadas; crear nuevas con `npx prisma migrate dev --name ...`
- Detener el servidor antes de `prisma generate`/`migrate` (EPERM en Windows)
- Producción aplica migraciones con `prisma migrate deploy` al arrancar (Render)

## Seguridad
- NUNCA leer, mostrar ni commitear archivos `.env`, claves de Neon/R2/Resend, ni `age-key.txt`
- Los respaldos y dumps viven fuera del repo
- No ejecutar comandos destructivos ni contra producción sin confirmación explícita

## Flujo de trabajo
- Una rama por función (`feat/...`, `fix/...`, `docs/...`), PR, CI en verde (`backend`, `frontend`, `integration`) y merge
- Por ahora Claude mergea los PR apenas el CI está en verde (mergear a `main` despliega a producción). Cuando el proyecto tenga usuarios reales, el dueño pasará a mergear él mismo tras revisar
- Los push y PR se hacen desde la sesión en la nube (el computador del dueño no expone credenciales de GitHub): `git bundle` en la carpeta local, push desde un clon en la nube y PR con `gh api` (REST; GraphQL no está disponible)
- Para volver a `main` tras un merge usar `git switch -C main origin/main`, nunca `git checkout main` con un `main` local desactualizado
- Tras mergear, borrar la rama y crear una nueva para el siguiente cambio
- Antes de commitear: `npx nest build` (backend) y `npx tsc --noEmit` + `npm run lint` + `npm run build` (frontend)
- En efectos de React no llamar `setState` de forma síncrona: el efecto llama a una función que solo hace el fetch y guarda el resultado en el `.then` (regla de `eslint-config-next`)
- Commits pequeños con prefijos `feat:`, `fix:`, `docs:`, `chore:`, `test:`
- Tras cada cambio, anotar en `CODE_REVIEW.md` los archivos modificados en orden de lectura, agrupados por commit (hash + mensaje). Es una lista local (en `.gitignore`): el dueño lo lee de arriba hacia abajo y borra lo que ya revisó, así que las entradas nuevas van SIEMPRE al final y nunca se restauran las borradas

## Pendientes conocidos
- Recordatorios por correo 24 h antes
- Correo de contacto con dominio propio (Cloudflare Email Routing)
- WhatsApp, trabajadores con cuenta propia, campos personalizados, pagos