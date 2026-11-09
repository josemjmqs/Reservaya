import type { PrismaClient } from '@prisma/client';
import { computeSlots } from './compute-slots';

export interface MemberSlotsInput {
  memberId: string;
  businessId: string;
  timezone: string;
  date: string; // fecha local del negocio
  weekday: number; // 0 = domingo ... 6 = sábado
  dayStart: Date;
  dayEnd: Date;
  durationMin: number;
}

type Db = Pick<PrismaClient, 'workingHours' | 'booking' | 'timeBlock'>;

// Horas libres de un profesional: su horario menos reservas activas y bloqueos.
// No depende de Nest, así se prueba directo contra PostgreSQL.
export async function findMemberSlots(
  db: Db,
  input: MemberSlotsInput,
): Promise<string[]> {
  const { memberId, businessId, weekday, dayStart, dayEnd } = input;

  const hours = await db.workingHours.findFirst({
    where: { memberId, weekday },
  });
  if (!hours) return [];

  const [bookings, blocks] = await Promise.all([
    db.booking.findMany({
      where: {
        memberId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
      },
    }),
    // Bloqueos de todo el negocio (sin profesional) o de este profesional
    db.timeBlock.findMany({
      where: {
        businessId,
        OR: [{ memberId: null }, { memberId }],
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
      },
    }),
  ]);

  return computeSlots({
    date: input.date,
    timezone: input.timezone,
    opensAt: hours.opensAt,
    closesAt: hours.closesAt,
    durationMin: input.durationMin,
    busy: [...bookings, ...blocks],
  }).map((s) => s.toISOString());
}
