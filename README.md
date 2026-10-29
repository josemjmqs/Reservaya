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

| Capa | Tecnología |
|---|---|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS |
| Backend | NestJS, TypeScript, Passport JWT, class-validator |
| Base de datos | PostgreSQL 16 + Prisma |
| Infraestructura | Docker Compose (local), Vercel, Render, Neon |
| Testing | Jest |

## Arquitectura

```
Navegador ──► Next.js (Vercel) ──► API NestJS (Render) ──► PostgreSQL (Neon)
```

## Decisiones técnicas

**Sin doble reserva, garantizado por la base de datos.** Validar en el código no basta cuando dos personas reservan a la vez. Una *exclusion constraint* de PostgreSQL (`btree_gist` + rangos de tiempo) impide que un mismo profesional tenga dos reservas activas solapadas. Lo probé lanzando peticiones concurrentes: una gana y la otra recibe un 409. Las reservas canceladas liberan la hora.

**Multi-tenancy deducido del token.** El `businessId` nunca viene del cliente: se obtiene de la membresía del usuario autenticado. Un negocio no puede ver ni modificar datos de otro, y los recursos ajenos responden 404 (no 403) para no revelar que existen. Verificado con pruebas entre dos cuentas.

**Cálculo de disponibilidad como función pura.** `computeSlots` no depende de Nest ni de la base de datos, por eso se prueba en aislamiento con Jest (horarios, solapes, horas pasadas, servicios que no caben antes del cierre y zona horaria).

**Zonas horarias.** Todo se guarda en UTC y se convierte con luxon según la zona del negocio (`America/Santiago`), evitando errores por el cambio de horario de verano.

**Seguridad.** Contraseñas con bcrypt, validación de DTOs con whitelist, rate limiting (más estricto en login y registro), slugs reservados, CORS restringido y respuestas públicas que no exponen datos de otros clientes.

## Correrlo en local

Requisitos: Node 22, Docker.

```bash
git clone https://github.com/josemjmqs/Reservaya.git
cd Reservaya

# 1. Base de datos
cp .env.example .env
docker compose up -d

# 2. Backend (http://localhost:3000)
cd backend
cp .env.example .env      # completa DATABASE_URL y JWT_SECRET
npm install
npx prisma migrate dev
npm run start:dev

# 3. Frontend (http://localhost:3001)
cd ../frontend
cp .env.example .env.local
npm install
npm run dev
```

Tests del backend: `npm test` dentro de `backend`.

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