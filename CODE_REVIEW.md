# Code review

Archivos modificados en cada rama, en el orden recomendado para leerlos. Las ramas más recientes van primero.

## feat/email-verification — Verificación de correo

### `f9b4a51` feat: email verification API and booking gate for unverified businesses
1. `backend/prisma/schema.prisma`: campo `User.emailVerifiedAt` y modelo `EmailVerificationToken`
2. `backend/prisma/migrations/20261109233000_add_email_verification/migration.sql`: crea la tabla y marca como verificadas las cuentas existentes
3. `backend/src/auth/auth.service.ts`: `register` (crea el token y envía el correo), `verifyEmail`, `resendVerification` y `me` (devuelve `emailVerifiedAt`)
4. `backend/src/notifications/notifications.service.ts`: `emailVerification()`, el correo con el enlace
5. `backend/src/auth/dto/password-reset.dto.ts`: `VerifyEmailDto`
6. `backend/src/auth/auth.controller.ts`: `POST /auth/verify-email` y `POST /auth/resend-verification`
7. `backend/src/availability/availability.service.ts`: `acceptsBookings()`; `getBusiness` lo devuelve
8. `backend/src/bookings/bookings.service.ts`: `create` responde 403 si el dueño no verificó su correo
9. `backend/src/auth/dto/register.dto.ts`: slugs reservados nuevos (`verify-email`, `forgot-password`, `reset-password`, `privacidad`, `terminos`)

### `c0b4c0b` test: email verification against PostgreSQL
1. `backend/src/auth/email-verification.int-spec.ts`: cada `it` describe una regla; sirve de resumen de la función

### `cd81a85` feat: verify-email page and dashboard banner
1. `frontend/src/lib/types.ts`: `acceptsBookings` en `PublicBusiness`
2. `frontend/src/app/verify-email/page.tsx`: página a la que lleva el enlace del correo
3. `frontend/src/app/dashboard/layout.tsx`: `VerifyEmailBanner`, el aviso con el botón de reenviar
4. `frontend/src/app/[slug]/page.tsx`: mensaje "todavía no recibe reservas"

### `976e901` docs: document email verification
1. `README.md`
2. `CLAUDE.md`
