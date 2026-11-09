import { DateTime } from 'luxon';

export interface BlockRangeInput {
  timezone: string; // "America/Santiago"
  startDate: string; // "2026-12-24", fecha local del negocio
  endDate: string; // "2026-12-25", inclusiva cuando es día completo
  allDay: boolean;
  startTime?: string; // "13:00", solo si no es día completo
  endTime?: string; // "15:00"
}

export interface BlockRange {
  startsAt: Date;
  endsAt: Date;
}

// Convierte fechas y horas locales del negocio a un intervalo UTC [inicio, fin).
// Un bloqueo de día completo va desde el inicio del primer día hasta el
// inicio del día siguiente al último. Devuelve null si el rango no es válido.
export function resolveBlockRange(input: BlockRangeInput): BlockRange | null {
  const { timezone, startDate, endDate, allDay, startTime, endTime } = input;

  let start: DateTime;
  let end: DateTime;

  if (allDay) {
    start = DateTime.fromISO(startDate, { zone: timezone }).startOf('day');
    end = DateTime.fromISO(endDate, { zone: timezone })
      .plus({ days: 1 })
      .startOf('day');
  } else {
    if (!startTime || !endTime) return null;
    start = DateTime.fromISO(`${startDate}T${startTime}`, { zone: timezone });
    end = DateTime.fromISO(`${endDate}T${endTime}`, { zone: timezone });
  }

  if (!start.isValid || !end.isValid || end <= start) return null;
  return { startsAt: start.toJSDate(), endsAt: end.toJSDate() };
}

// Un bloqueo es de día completo si empieza y termina a medianoche local
export function isAllDay(range: BlockRange, timezone: string): boolean {
  const s = DateTime.fromJSDate(range.startsAt, { zone: timezone });
  const e = DateTime.fromJSDate(range.endsAt, { zone: timezone });
  return +s === +s.startOf('day') && +e === +e.startOf('day');
}
