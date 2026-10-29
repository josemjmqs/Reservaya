# Reservaya

Plataforma de reservas online para pequeños negocios (talleres, peluquerías, consultas). Cada negocio tiene su página pública donde sus clientes reservan una hora **sin crear cuenta**, y un panel donde el dueño administra servicios, horarios y agenda.

**Demo:** https://reservaya-gray.vercel.app/taller-demo
**Panel del negocio:** https://reservaya-gray.vercel.app/login

> El backend corre en el plan gratuito de Render: tras un rato sin uso, la primera carga puede tardar 30-60 segundos en despertar.

## Capturas

TODO: agregar 3 capturas en `docs/` y enlazarlas aquí

- Página pública de reserva
- Agenda del negocio
- Horario de atención

## Funcionalidades

**Cliente (sin cuenta)**

- Elige servicio, día y hora entre los espacios realmente libres
- Reserva con nombre, correo y teléfono
- Ve y cancela su reserva con un enlace privado

**Negocio**

- Registro y login (JWT)
- Gestión de servicios (duración, precio, activar/desactivar)
- Horario semanal de atención
- Agenda diaria con cambio de estado (completada, no se presentó, cancelada)

## Stack

| Capa            | Tecnología                                        |
| --------------- | ------------------------------------------------- |
| Frontend        | Next.js (App Router), TypeScript, Tailwind CSS    |
| Backend         | NestJS, TypeScript, Passport JWT, class-validator |
| Base de datos   | PostgreSQL 16 + Prisma                            |
| Infraestructura | Docker Compose (local), Vercel, Render, Neon      |
| Testing         | Jest                                              |

## Arquitectura

```
Navegador ──► Next.js (Vercel) ──► API NestJS (Render) ──► PostgreSQL (Neon)
```

## Decisiones técnicas

**Sin doble reserva, garantizado por la base de datos.** Validar en el código no basta cuando dos personas reservan a la vez. Una _exclusion constraint_ de PostgreSQL (`btree_gist` + rangos de tiempo) impide que un mismo profesional tenga dos reservas activas solapadas. Lo probé lanzando peticiones concurrentes: una gana y la otra recibe un 409. Las reservas canceladas liberan la hora.

**Multi-tenancy deducido del token.** El `businessId` nunca viene del cliente: se obtiene de la membresía del usuario autenticado. Un negocio no puede ver ni modificar datos de otro, y los recursos ajenos responden 404 (no 403) para no revelar que existen. Verificado con pruebas entre dos cuentas.

**Cálculo de disponibilidad como función pura.** `computeSlots` no depende de Nest ni de la base de datos, por eso se prueba en aislamiento con Jest (horarios, solapes, horas pasadas, servicios que no caben antes del cierre y zona horaria).

**Zonas horarias.** Todo se guarda en UTC y se convierte con luxon según la zona del negocio (`America/Santiago`), evitando errores por el cambio de horario de verano.

**Seguridad.** Contraseñas con bcrypt, validación de DTOs con whitelist, rate limiting (más estricto en login y registro), slugs reservados, CORS restringido y respuestas públicas que no exponen datos de otros clientes.

## Correrlo en local

Requisitos: Node 22 y Docker Desktop.

```bash
git clone https://github.com/josemjmqs/Reservaya.git
cd Reservaya
```

### 1. Base de datos (PostgreSQL en Docker)

```bash
cp .env.example .env
docker compose up -d
```

Edita `.env` si quieres cambiar la contraseña (usa solo letras y números: los símbolos como `@`, `#` o `/` rompen la URL de conexión). La base queda en el puerto **5433**, para no chocar con un PostgreSQL instalado en tu equipo.

### 2. Backend (http://localhost:3000)

```bash
cd backend
cp .env.example .env
```

En `backend/.env`:

- `DATABASE_URL`: usa **la misma contraseña y el mismo puerto (5433)** que el `.env` de la raíz.
- `JWT_SECRET`: cualquier texto largo.

```bash
npm install
npx prisma migrate dev
npm run start:dev
```

Comprueba que funciona: http://localhost:3000/health debe responder `{"status":"ok","database":"up"}`.

### 3. Frontend (http://localhost:3001)

En otra terminal:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Abre http://localhost:3001/register, crea una cuenta y ya puedes crear servicios y horarios. Tu página pública quedará en `http://localhost:3001/<tu-slug>`.

### Tests

```bash
cd backend
npm test
```

### Problemas comunes

| Síntoma                                 | Causa y solución                                                                                                                                                           |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `P1000` (autenticación)                 | La contraseña de `backend/.env` no coincide con la de `.env`. Si cambiaste la del `.env` raíz después de crear la base: `docker compose down -v` y `docker compose up -d`. |
| `P1001` (no alcanza la base)            | Docker no está corriendo, o el puerto de `DATABASE_URL` no es 5433.                                                                                                        |
| `docker compose up` falla por el puerto | Otro programa usa el 5433: cambia `POSTGRES_PORT` en `.env` y el puerto en `DATABASE_URL`.                                                                                 |

## Estructura

```
backend/    API NestJS (auth, services, working-hours, availability, bookings, agenda)
frontend/   Next.js (login, dashboard, página pública, gestión de reserva)
docker-compose.yml
```

## Mejoras pendientes

- Correo de confirmación y recordatorios
- Múltiples profesionales por negocio
- Campos personalizados por negocio
- Pagos de abono
- Cookies httpOnly en lugar de localStorage para el token

## Autor

José Díaz · [GitHub](https://github.com/josemjmqs) · www.linkedin.com/in/josé-ignacio-díaz-hormazábal-9b515143b
