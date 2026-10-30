import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DateTime } from 'luxon';
import { Resend } from 'resend';

export interface BookingEmailData {
  to: string;
  customerName: string;
  businessName: string;
  serviceName: string;
  startsAt: Date;
  timezone: string;
  manageToken: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(config: ConfigService) {
    const key = config.get<string>('RESEND_API_KEY');
    this.resend = key ? new Resend(key) : null;
    this.from = config.get<string>('MAIL_FROM') ?? 'Reservaya <onboarding@resend.dev>';
    this.frontendUrl = config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';
  }

  // Nunca lanza: un fallo de correo no debe romper la reserva
  async bookingConfirmed(data: BookingEmailData): Promise<void> {
    if (!this.resend) {
      this.logger.warn('RESEND_API_KEY no configurada: correo omitido');
      return;
    }
    const when = DateTime.fromJSDate(data.startsAt, { zone: data.timezone })
      .setLocale('es')
      .toFormat("cccc d 'de' LLLL 'a las' HH:mm");
    const link = `${this.frontendUrl}/reserva/${data.manageToken}`;

    try {
      const { error } = await this.resend.emails.send({
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
      if (error) this.logger.error(`Resend: ${error.message}`);
    } catch (e) {
      this.logger.error('Error enviando correo', e as Error);
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}