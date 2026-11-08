# Reservaya

![CI](https://github.com/josemjmqs/Reservaya/actions/workflows/ci.yml/badge.svg)

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
- Elige servicio, profesional y día entre las horas realmente libres
- Servicios agrupados por categoría (ej. Hombres, Mujeres) y con la duración que corresponde a cada uno
- "Sin preferencia": el sistema asigna al azar un profesional que tenga la hora libre
- Reserva con nombre, correo y teléfono, y recibe una confirmación por correo
- Ve y cancela su reserva con un enlace privado, sin crear cuenta

**Negocio**
- Registro e inicio de sesión (sesión con cookie `httpOnly`)
- Gestión de servicios: categoría, tiempo de atención, duración total estimada, precio opcional, edición y activar/desactivar
- Equipo: profesionales con los servicios que realizan y su propio horario semanal
- Agenda diaria con filtro por profesional, estados de la reserva (completada, no se presentó, cancelada) y actualización automática
- Página pública propia (`/tu-negocio`) lista para compartir

**Calidad y seguridad**
- Sin dobles reservas, garantizado por una restricción de PostgreSQL y probado con peticiones concurrentes
- Aislamiento entre negocios verificado
- Límites de peticiones por IP y de reservas por correo
- Respaldos diarios cifrados

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

**Sin doble reserva, garantizado por la base de datos.** Validar en el código no basta cuando dos personas reservan a la vez. Una _exclusion constraint_ de PostgreSQL (`btree_gist` + rangos de tiempo) impide que un mismo profesional tenga dos reservas activas solapadas. Lo probé con peticiones concurrentes en el CI: una gana y las demás reciben un 409. Las reservas canceladas liberan la hora.

**Multi-tenancy deducido del token.** El `businessId` nunca viene del cliente: se obtiene de la membresía del usuario autenticado. Un negocio no puede ver ni modificar datos de otro, y los recursos ajenos responden 404 (no 403) para no revelar que existen. Verificado con pruebas entre dos cuentas.

**Cálculo de disponibilidad como función pura.** `computeSlots` no depende de Nest ni de la base de datos, por eso se prueba en aislamiento con Jest (horarios, solapes, horas pasadas, servicios que no caben antes del cierre y zona horaria).

**Zonas horarias.** Todo se guarda en UTC y se convierte con luxon según la zona del negocio (`America/Santiago`), evitando errores por el cambio de horario de verano.

**Seguridad.** Contraseñas con bcrypt, validación de DTOs con whitelist, rate limiting (más estricto en login y registro), slugs reservados, CORS restringido y respuestas públicas que no exponen datos de otros clientes.

**Sesión con cookie `httpOnly`.** El JWT viaja en una cookie `HttpOnly; Secure; SameSite=Lax`, inaccesible desde JavaScript, lo que mitiga el robo de token por XSS. Para que la cookie sea first-party, el frontend proxea `/api/*` hacia el backend con un rewrite de Next.js, evitando los problemas de cookies entre dominios.

**Tests de integración contra PostgreSQL real.** La garantía anti-doble reserva se prueba en el CI con una base PostgreSQL 16 (servicio de GitHub Actions), incluyendo 10 peticiones simultáneas a la misma hora donde solo una prevalece.

**Tiempo de atención vs. duración total.** Cada servicio tiene `durationMin` (el tiempo que el profesional está ocupado, que bloquea la agenda y alimenta la restricción anti-solape) y `totalMin` opcional (duración total del trabajo, solo informativa). Así un taller puede recibir varios vehículos el mismo día aunque una reparación tarde un día completo, mientras que un corte de pelo bloquea la hora entera.

**Equipo con servicios y horarios propios.** Cada negocio puede tener varios profesionales, cada uno con los servicios que realiza y su propio horario semanal. Los profesionales no necesitan cuenta: los administra el dueño, y toda consulta se resuelve desde la membresía del usuario autenticado, así que un negocio nunca puede ver ni modificar profesionales de otro.

**"Sin preferencia" asigna al azar entre quienes tienen la hora libre.** Si el cliente no elige profesional, el sistema mezcla a los candidatos que hacen el servicio y asigna al primero con esa hora disponible, lo que reparte la carga a la larga sin favorecer a quien se creó primero. La hora que se ofrece es la unión de las horas libres de todos.

**Concurrencia con varios profesionales.** La restricción anti-solape es por profesional, así que dos clientes pueden tomar la misma hora con profesionales distintos, pero nunca con el mismo. Lo cubren tests de integración contra PostgreSQL real, incluyendo 6 clientes simultáneos sobre 2 profesionales (solo 2 ganan). Los solapes y los deadlocks que PostgreSQL resuelve abortando una transacción se traducen a un 409 claro, y ninguna reserva queda duplicada.

**Correo transaccional con dominio verificado.** Los correos salen de un subdominio dedicado (`mail.`) con DKIM y SPF verificados y DMARC en modo monitoreo, lo que mejora la entrega y aísla su reputación. El envío nunca bloquea la reserva, y un límite por correo (3 por hora) junto al rate limit por IP evita que el formulario se use para enviar correo a terceros.

**Respaldos cifrados y verificados.** Un workflow diario de GitHub Actions hace `pg_dump`, cifra el archivo con `age` y lo sube a un bucket privado de Cloudflare R2 con retención de 30 días. La restauración se probó de punta a punta en una base limpia.

## Operación

- **Infraestructura:** frontend en Vercel, API en Render, PostgreSQL en Neon, DNS en Cloudflare.
- **Respaldos:** diarios (06:17 UTC), cifrados con `age`, en Cloudflare R2, retención de 30 días. La clave privada se guarda fuera del repositorio y de GitHub.
- **Restaurar un respaldo:**
  1. Descargar el archivo `.dump.age` desde R2.
  2. Descifrar: `age -d -i clave.txt -o respaldo.dump archivo.dump.age`
  3. Restaurar: `pg_restore --no-owner -d <base> respaldo.dump`
- **Correo:** Resend, dominio `mail.` con DKIM verificado.
- **Despliegue:** automático al hacer merge a `main` (Render y Vercel).

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

**Producto**

- Notificaciones por WhatsApp (Cloud API de Meta) como segundo canal, aprovechando el `NotificationsService`.
- Recordatorios automáticos antes de la hora reservada.
- Bloqueos de tiempo (vacaciones, feriados) con pantalla de administración.
- Campos personalizados por negocio (por ejemplo, patente en un taller).
- Pago de abono al reservar.
- Política de anticipación mínima para cancelar.
- Trabajadores con cuenta propia (hoy solo el dueño inicia sesión).
- Reparto por carga en vez de azar.

**Técnicas**

- Leer la zona horaria del negocio en la agenda en vez de fijarla en el frontend.
- Probar BookingsService de punta a punta con @nestjs/testing (requiere configurar Jest para ESM)
- Test de `computeSlots` para los días de cambio de horario de verano en Chile.
- Tabla de transiciones permitidas entre estados de una reserva.
- Migrar a Prisma 7 cuando el ecosistema esté estable.
- Modelar capacidad real (varios boxes o puestos simultáneos) con múltiples profesionales por negocio.
- Con ‘Sin preferencia’, el profesional se elige al azar entre los que tienen la hora libre; la restricción de PostgreSQL evita dobles reservas si dos clientes compiten por el mismo.

**Limitaciones conocidas del demo**

- El backend corre en el plan gratuito de Render: tras un rato sin uso, la primera carga puede tardar 30-60 segundos.   

## Autor

José Díaz · [GitHub](https://github.com/josemjmqs) · www.linkedin.com/in/josé-ignacio-díaz-hormazábal-9b515143b
