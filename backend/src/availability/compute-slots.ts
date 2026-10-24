import { DateTime } from 'luxon';

export interface Interval {
  startsAt: Date;
  endsAt: Date;
}

export interface ComputeSlotsInput {
  date: string; // "2026-11-02", fecha local del negocio
  timezone: string; // "America/Santiago"
  opensAt: string; // "09:00"
  closesAt: string; // "18:00"
  durationMin: number;
  busy: Interval[]; // reservas activas + bloqueos
  stepMin?: number; // cada cuánto se ofrece una hora (por defecto, la duración)
  now?: Date; // para no ofrecer horas pasadas
}

export function computeSlots(input: ComputeSlotsInput): Date[] {
  const {
    date,
    timezone,
    opensAt,
    closesAt,
    durationMin,
    busy,
    stepMin = durationMin,
    now = new Date(),
  } = input;

  const [oh, om] = opensAt.split(':').map(Number);
  const [ch, cm] = closesAt.split(':').map(Number);

  // Se construye en la zona del negocio y luego se pasa a UTC
  const open = DateTime.fromISO(date, { zone: timezone }).set({
    hour: oh,
    minute: om,
  });
  const closeMs = DateTime.fromISO(date, { zone: timezone })
    .set({ hour: ch, minute: cm })
    .toMillis();

  const slots: Date[] = [];
  let start = open;

  while (start.plus({ minutes: durationMin }).toMillis() <= closeMs) {
    const s = start.toMillis();
    const e = start.plus({ minutes: durationMin }).toMillis();

    const isFuture = s > now.getTime();
    const overlaps = busy.some(
      (b) => s < b.endsAt.getTime() && e > b.startsAt.getTime(),
    );

    if (isFuture && !overlaps) slots.push(start.toJSDate());
    start = start.plus({ minutes: stepMin });
  }
  return slots;
}
