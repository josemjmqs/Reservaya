import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { DateTime } from 'luxon';
import { Resend } from 'resend';

type EmailOptions = Parameters<Resend['emails']['send']>[0];
interface SendError {
  name: string;
  message: string;
  statusCode: number | null;
}

// Fallas pasajeras de Resend (saturación, error interno o sin conexión): vale la
// pena reintentar. Las definitivas (clave inválida, dirección mal escrita, cuota
// del día agotada) fallarían igual, así que no se reintentan
const TRANSIENT = new Set([
  'rate_limit_exceeded',
  'application_error',
  'internal_server_error',
  'concurrent_idempotent_requests',
]);
export const isTransient = (e: SendError) =>
  TRANSIENT.has(e.name) || (e.statusCode !== null && e.statusCode >= 500);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface BookingEmailData {
  to: string;
  customerName: string;
  businessName: string;
  serviceName: string;
  startsAt: Date;
  timezone: string;
  manageToken: string;
}

export interface CancelledByBusinessEmailData {
  to: string;
  customerName: string;
  businessName: string;
  businessSlug: string;
  businessPhone: string | null;
  serviceName: string;
  startsAt: Date;
  timezone: string;
  reason: string | null;
}

export interface NewBookingEmailData {
  to: string;
  recipientName: string;
  businessName: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  serviceName: string;
  memberName: string;
  notes: string | null;
  startsAt: Date;
  timezone: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly frontendUrl: string;
  // Espera antes de cada reintento: 3 intentos en total
  private readonly retryDelaysMs = [2000, 5000];

  constructor(config: ConfigService) {
    const key = config.get<string>('RESEND_API_KEY');
    this.resend = key ? new Resend(key) : null;
    this.from =
      config.get<string>('MAIL_FROM') ??
      'Reservahoy <reservas@mail.reservahoy.cl>';
    this.frontendUrl =
      config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';
  }

  // Envía con reintentos ante fallas pasajeras. Nunca lanza: un correo que no
  // sale queda en el log, pero no rompe la reserva ni el registro
  private async send(label: string, email: EmailOptions): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        `RESEND_API_KEY no configurada: correo "${label}" omitido`,
      );
      return;
    }
    // La misma clave en todos los intentos: si un intento sí llegó a Resend
    // aunque la respuesta se perdió, Resend no manda el correo dos veces
    const idempotencyKey = randomUUID();

    for (let attempt = 0; ; attempt++) {
      let error: SendError | null;
      try {
        ({ error } = await this.resend.emails.send(email, { idempotencyKey }));
      } catch (e) {
        error = {
          name: 'application_error',
          message: (e as Error).message,
          statusCode: null,
        };
      }
      if (!error) return;

      if (!isTransient(error) || attempt >= this.retryDelaysMs.length) {
        this.logger.error(
          `Correo "${label}" no enviado tras ${attempt + 1} intento(s): ${error.name}: ${error.message}`,
        );
        return;
      }
      this.logger.warn(
        `Correo "${label}" falló (${error.name}); reintento en ${this.retryDelaysMs[attempt] / 1000} s`,
      );
      await sleep(this.retryDelaysMs[attempt]);
    }
  }

  // Nunca lanza: un fallo de correo no debe romper la reserva
  async bookingConfirmed(data: BookingEmailData): Promise<void> {
    const when = DateTime.fromJSDate(data.startsAt, { zone: data.timezone })
      .setLocale('es')
      .toFormat("cccc d 'de' LLLL 'a las' HH:mm");
    const link = `${this.frontendUrl}/reserva/${data.manageToken}`;

    await this.send('confirmación de reserva', {
      from: this.from,
      to: data.to,
      subject: `Reserva confirmada en ${data.businessName}`,
      html: `
          <p>Hola ${escapeHtml(data.customerName)},</p>
          <p>Tu reserva de <strong>${escapeHtml(data.serviceName)}</strong> en
          <strong>${escapeHtml(data.businessName)}</strong> quedó confirmada para
          el <strong>${when}</strong>.</p>
          <p>Si necesitas verla o cancelarla: <a href="${link}">administrar mi reserva</a>.</p>
        `,
    });
  }

  // El negocio canceló la reserva desde su agenda. Nunca lanza
  async bookingCancelledByBusiness(
    data: CancelledByBusinessEmailData,
  ): Promise<void> {
    const start = DateTime.fromJSDate(data.startsAt, {
      zone: data.timezone,
    }).setLocale('es');
    const when = start.toFormat("cccc d 'de' LLLL 'a las' HH:mm");
    const rebook = `${this.frontendUrl}/${data.businessSlug}`;

    await this.send('cancelación por el negocio', {
      from: this.from,
      to: data.to,
      subject: `Tu reserva en ${data.businessName} fue cancelada`,
      html: `
          <p>Hola ${escapeHtml(data.customerName)},</p>
          <p><strong>${escapeHtml(data.businessName)}</strong> canceló tu reserva de
          <strong>${escapeHtml(data.serviceName)}</strong> del <strong>${when}</strong>.</p>
          ${data.reason ? `<p>Motivo: ${escapeHtml(data.reason)}</p>` : ''}
          <p><a href="${rebook}">Reservar otra hora</a></p>
          ${
            data.businessPhone
              ? `<p>Si tienes dudas, puedes llamar al ${escapeHtml(data.businessPhone)}.</p>`
              : ''
          }
        `,
    });
  }

  // Aviso al dueño (o a quien tenga activada la opción en Ajustes). Nunca lanza
  async newBookingForStaff(data: NewBookingEmailData): Promise<void> {
    const start = DateTime.fromJSDate(data.startsAt, {
      zone: data.timezone,
    }).setLocale('es');
    const when = start.toFormat("cccc d 'de' LLLL 'a las' HH:mm");
    const agenda = `${this.frontendUrl}/dashboard/agenda?date=${start.toISODate()}`;
    const settings = `${this.frontendUrl}/dashboard/settings`;
    const contact = [data.customerEmail, data.customerPhone]
      .filter(Boolean)
      .map((c) => escapeHtml(c!))
      .join(' · ');

    await this.send('reserva nueva al negocio', {
      from: this.from,
      to: data.to,
      subject: `Nueva reserva: ${data.customerName}, ${start.toFormat("ccc d 'de' LLL, HH:mm")}`,
      html: `
          <p>Hola ${escapeHtml(data.recipientName)},</p>
          <p>Tienes una reserva nueva en <strong>${escapeHtml(data.businessName)}</strong>:</p>
          <ul>
            <li><strong>${escapeHtml(data.serviceName)}</strong></li>
            <li>${when}, con ${escapeHtml(data.memberName)}</li>
            <li>${escapeHtml(data.customerName)} · ${contact}</li>
            ${data.notes ? `<li>Nota: ${escapeHtml(data.notes)}</li>` : ''}
          </ul>
          <p><a href="${agenda}">Ver en la agenda</a></p>
          <p style="color:#6b7280;font-size:12px">Recibes este correo porque tienes activados los avisos de reservas nuevas.
          Puedes desactivarlos en <a href="${settings}">Ajustes</a>.</p>
        `,
    });
  }

  async emailVerification(
    to: string,
    name: string,
    token: string,
  ): Promise<void> {
    const link = `${this.frontendUrl}/verify-email?token=${token}`;
    await this.send('verificación de correo', {
      from: this.from,
      to,
      subject: 'Confirma tu correo en Reservahoy',
      html: `<p>Hola ${escapeHtml(name)},</p>
        <p>Confirma tu correo para que tu página pública empiece a recibir reservas (el enlace vale 24 horas):</p>
        <p><a href="${link}">Confirmar mi correo</a></p>
        <p>Si no creaste una cuenta en Reservahoy, ignora este mensaje.</p>`,
    });
  }

  async passwordReset(to: string, name: string, token: string): Promise<void> {
    const link = `${this.frontendUrl}/reset-password?token=${token}`;
    await this.send('restablecer contraseña', {
      from: this.from,
      to,
      subject: 'Restablece tu contraseña',
      html: `<p>Hola ${escapeHtml(name)},</p>
        <p>Para elegir una contraseña nueva usa este enlace (vale 1 hora):</p>
        <p><a href="${link}">Restablecer contraseña</a></p>
        <p>Si no lo pediste, ignora este mensaje.</p>`,
    });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
