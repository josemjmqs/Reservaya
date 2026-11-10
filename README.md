# Reservahoy

![CI](https://github.com/josemjmqs/Reservaya/actions/workflows/ci.yml/badge.svg)

Plataforma de reservas online para pequeños negocios (talleres, peluquerías, consultas). Cada negocio tiene su página pública donde sus clientes reservan una hora **sin crear cuenta**, y un panel donde el dueño administra servicios, horarios y agenda.

**Demo:** https://reservahoy.cl/taller-demo
**Panel del negocio:** https://reservahoy.cl/login

> El backend corre en el plan gratuito de Render: tras un rato sin uso, la primera carga puede tardar 30-60 segundos en despertar.

## Capturas

TODO: agregar 3 capturas en `docs/` y enlazarlas aquí

- Página pública de reserva
- Agenda del negocio
- Horario de atención

## Funcionalidades

**Cliente (sin cuenta)**
- Elige uno o varios servicios (hasta 5, se hacen seguidos con un mismo profesional), profesional y día entre las horas realmente libres
- Servicios agrupados por categoría (ej. Hombres, Mujeres): se muestran solo las categorías y al tocar una se despliegan sus servicios, con la duración que corresponde a cada uno
- Al elegir un servicio ve su foto y su información adicional (qué incluye, qué traer, recomendaciones)
- "Sin preferencia": el sistema asigna al azar un profesional que tenga la hora libre
- Reserva con nombre, correo y teléfono, y recibe una confirmación por correo
- Ve y cancela su reserva con un enlace privado, sin crear cuenta

**Negocio**
- Registro e inicio de sesión (sesión con cookie `httpOnly`)
- Verificación del correo al registrarse: la página pública recibe reservas recién cuando el dueño confirma su correo
- Gestión de servicios: categoría, tiempo de atención, duración total estimada, precio opcional, información adicional (hasta 300 caracteres), foto, edición y activar/desactivar
- Equipo: profesionales con los servicios que realizan y su propio horario semanal
- Agenda diaria con filtro por profesional, estados de la reserva (completada, no se presentó, cancelada) y actualización automática; si hoy no hay reservas, muestra la próxima
- Correo al dueño por cada reserva nueva (servicio, hora, profesional y datos del cliente, con enlace a ese día de la agenda), activable y desactivable en Ajustes
- Bloqueos de tiempo (vacaciones, feriados, trámites) por días completos o rangos de horas, para todo el negocio o un profesional; avisa si ya hay reservas en ese período
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

**Jest en modo ESM.** NestJS 12 se publica solo como ESM, así que Jest corre con `ts-jest` en modo ESM (`--experimental-vm-modules` y `tsconfig.spec.json`). Así los servicios de Nest se prueban directamente contra PostgreSQL, sin mocks.

**Tests de integración contra PostgreSQL real.** La garantía anti-doble reserva se prueba en el CI con una base PostgreSQL 16 (servicio de GitHub Actions), incluyendo 10 peticiones simultáneas a la misma hora donde solo una prevalece.

**Tiempo de atención vs. duración total.** Cada servicio tiene `durationMin` (el tiempo que el profesional está ocupado, que bloquea la agenda y alimenta la restricción anti-solape) y `totalMin` opcional (duración total del trabajo, solo informativa). Así un taller puede recibir varios vehículos el mismo día aunque una reparación tarde un día completo, mientras que un corte de pelo bloquea la hora entera.

**Equipo con servicios y horarios propios.** Cada negocio puede tener varios profesionales, cada uno con los servicios que realiza y su propio horario semanal. Los profesionales no necesitan cuenta: los administra el dueño, y toda consulta se resuelve desde la membresía del usuario autenticado, así que un negocio nunca puede ver ni modificar profesionales de otro.

**"Sin preferencia" asigna al azar entre quienes tienen la hora libre.** Si el cliente no elige profesional, el sistema mezcla a los candidatos que hacen el servicio y asigna al primero con esa hora disponible, lo que reparte la carga a la larga sin favorecer a quien se creó primero. La hora que se ofrece es la unión de las horas libres de todos.

**Varios servicios en una misma reserva.** Una reserva es un solo bloque de tiempo con un profesional que hace todos los servicios elegidos, uno tras otro; los servicios quedan en una tabla aparte (`BookingItem`) con su orden. Así la restricción anti-solape sigue protegiendo el bloque completo sin cambios. El bloque dura la suma de los servicios y las horas se ofrecen cada "servicio más corto" (Corte 30 min + Barba 20 min se ofrece cada 20 min), para no dejar huecos sin usar. Solo se ofrecen los profesionales que hacen todos los servicios elegidos. La migración pasó el servicio de cada reserva existente a la tabla nueva antes de borrar la columna antigua.

**Concurrencia con varios profesionales.** La restricción anti-solape es por profesional, así que dos clientes pueden tomar la misma hora con profesionales distintos, pero nunca con el mismo. Lo cubren tests de integración contra PostgreSQL real, incluyendo 6 clientes simultáneos sobre 2 profesionales (solo 2 ganan). Los solapes y los deadlocks que PostgreSQL resuelve abortando una transacción se traducen a un 409 claro, y ninguna reserva queda duplicada.

**Correo transaccional con dominio verificado.** Los correos salen de un subdominio dedicado (`mail.`) con DKIM y SPF verificados y DMARC en modo monitoreo, lo que mejora la entrega y aísla su reputación. El envío nunca bloquea la reserva, y un límite por correo (3 por hora) junto al rate limit por IP evita que el formulario se use para enviar correo a terceros.

**Verificación de correo antes de recibir reservas.** Al registrarse se envía un enlace de un solo uso (vale 24 horas; en la base solo se guarda su hash SHA-256). El panel funciona desde el primer momento, pero la página pública no acepta reservas hasta que el dueño confirma su correo: así una cuenta creada con un correo ajeno no puede usar la plataforma para enviar correos a terceros. El reenvío está limitado a 3 por hora y las cuentas anteriores a esta función quedaron verificadas en la migración.

**Fotos reducidas en el navegador y guardadas en R2.** Antes de subirla, el navegador lleva la foto a 1200 px y la convierte a WebP: una foto de celular de 3-5 MB queda en unos 150 KB, sube rápido incluso con datos móviles y no hace falta procesar imágenes en el servidor (Render gratis tiene poca memoria). El backend no confía en el nombre ni en el tipo que declara el navegador: identifica el formato por los primeros bytes del archivo y solo acepta JPG, PNG o WebP (un SVG podría llevar código). Las fotos van a un bucket público de Cloudflare R2, que no cobra por descargas; cada subida usa una ruta nueva, así que la caché puede guardarlas para siempre, y la foto reemplazada se borra del bucket.

**Respaldos cifrados y verificados.** Un workflow diario de GitHub Actions hace `pg_dump`, cifra el archivo con `age` y lo sube a un bucket privado de Cloudflare R2 con retención de 30 días. La restauración se probó de punta a punta en una base limpia.

## Operación

- **Infraestructura:** frontend en Vercel, API en Render, PostgreSQL en Neon, DNS en Cloudflare.
- **Backend siempre despierto:** Render gratis apaga el servicio tras 15 minutos sin tráfico. Un monitor de UptimeRobot visita `/health/live` cada 5 minutos (no consulta la base, así Neon puede dormir) y avisa por correo si el backend cae.
- **Dominio:** `reservahoy.cl` es el principal; `www.` y `app.` redirigen a él (308, conservando la ruta). `FRONTEND_URL` en Render debe ser `https://reservahoy.cl`, porque arma los enlaces de los correos.
- **Respaldos:** diarios (06:17 UTC), cifrados con `age`, en Cloudflare R2, retención de 30 días. La clave privada se guarda fuera del repositorio y de GitHub.
- **Restaurar un respaldo:**
  1. Descargar el archivo `.dump.age` desde R2.
  2. Descifrar: `age -d -i clave.txt -o respaldo.dump archivo.dump.age`
  3. Restaurar: `pg_restore --no-owner -d <base> respaldo.dump`
- **Correo:** Resend, dominio `mail.` con DKIM verificado.
- **Fotos:** bucket público de Cloudflare R2 con dominio propio; variables `R2_*` en Render (ver `backend/.env.example`). Sin ellas la subida de fotos queda desactivada.
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

### 4. Datos de prueba (opcional)

Para no partir de cero, crea un negocio demo con equipo, servicios, horarios y reservas alrededor de hoy (ayer, los próximos días y una cancelada):

```bash
cd backend
npx prisma db seed                # hoy queda sin reservas
SEED_TODAY=1 npx prisma db seed   # también agrega reservas para hoy (en PowerShell: $env:SEED_TODAY=1; npx prisma db seed)
```

Entra en http://localhost:3001/login con `demo@reservahoy.local` / `demo1234`. La página pública queda en http://localhost:3001/demo-peluqueria. Puedes correrlo las veces que quieras: borra y vuelve a crear solo el negocio demo, y se niega a correr si `DATABASE_URL` no apunta a una base local.

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
backend/    API NestJS (auth, services, members, working-hours, time-blocks, availability, bookings, agenda)
frontend/   Next.js (login, dashboard, página pública, gestión de reserva)
docker-compose.yml
```

## Mejoras pendientes

**Producto**

- Notificaciones por WhatsApp (Cloud API de Meta) como segundo canal, aprovechando el `NotificationsService`.
- Recordatorios automáticos antes de la hora reservada.
- Campos personalizados por negocio (por ejemplo, patente en un taller).
- Pago de abono al reservar.
- Política de anticipación mínima para cancelar.
- Trabajadores con cuenta propia (hoy solo el dueño inicia sesión).
- Reparto por carga en vez de azar.
- Correo de contacto con dominio propio (Cloudflare Email Routing)

**Técnicas**

- Leer la zona horaria del negocio en la agenda en vez de fijarla en el frontend.
- Tests e2e de la app completa: `@nestjs/throttler` sigue en CommonJS y Jest solo carga ESM desde CommonJS en Node 24.9+.
- Test de `computeSlots` para los días de cambio de horario de verano en Chile.
- Tabla de transiciones permitidas entre estados de una reserva.
- Migrar a Prisma 7 cuando el ecosistema esté estable.
- Modelar capacidad real (varios boxes o puestos simultáneos) con múltiples profesionales por negocio.
- Con ‘Sin preferencia’, el profesional se elige al azar entre los que tienen la hora libre; la restricción de PostgreSQL evita dobles reservas si dos clientes compiten por el mismo.

**Limitaciones conocidas del demo**

- El backend corre en el plan gratuito de Render: tras un rato sin uso, la primera carga puede tardar 30-60 segundos.   

## Autor

José Díaz · [GitHub](https://github.com/josemjmqs) · www.linkedin.com/in/josé-ignacio-díaz-hormazábal-9b515143b
