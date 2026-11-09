import { exceedsDays, isAllDay, resolveBlockRange } from './block-range';

const tz = 'America/Santiago';

describe('resolveBlockRange', () => {
  it('un día completo va de medianoche a medianoche local', () => {
    // En diciembre Santiago es UTC-3
    const r = resolveBlockRange({
      timezone: tz,
      startDate: '2026-12-25',
      endDate: '2026-12-25',
      allDay: true,
    });
    expect(r?.startsAt.toISOString()).toBe('2026-12-25T03:00:00.000Z');
    expect(r?.endsAt.toISOString()).toBe('2026-12-26T03:00:00.000Z');
  });

  it('varios días completos incluyen el último día', () => {
    const r = resolveBlockRange({
      timezone: tz,
      startDate: '2027-02-01',
      endDate: '2027-02-14',
      allDay: true,
    });
    expect(r?.startsAt.toISOString()).toBe('2027-02-01T03:00:00.000Z');
    expect(r?.endsAt.toISOString()).toBe('2027-02-15T03:00:00.000Z');
  });

  it('un rango horario usa la hora local del negocio', () => {
    // En julio Santiago es UTC-4: 13:00 local = 17:00 UTC
    const r = resolveBlockRange({
      timezone: tz,
      startDate: '2027-07-05',
      endDate: '2027-07-05',
      allDay: false,
      startTime: '13:00',
      endTime: '15:30',
    });
    expect(r?.startsAt.toISOString()).toBe('2027-07-05T17:00:00.000Z');
    expect(r?.endsAt.toISOString()).toBe('2027-07-05T19:30:00.000Z');
  });

  it('rechaza un término anterior o igual al inicio', () => {
    const base = {
      timezone: tz,
      startDate: '2026-12-10',
      endDate: '2026-12-10',
      allDay: false,
    };
    expect(
      resolveBlockRange({ ...base, startTime: '15:00', endTime: '14:00' }),
    ).toBeNull();
    expect(
      resolveBlockRange({ ...base, startTime: '15:00', endTime: '15:00' }),
    ).toBeNull();
    expect(
      resolveBlockRange({
        timezone: tz,
        startDate: '2026-12-10',
        endDate: '2026-12-09',
        allDay: true,
      }),
    ).toBeNull();
  });

  it('rechaza un rango horario sin horas', () => {
    expect(
      resolveBlockRange({
        timezone: tz,
        startDate: '2026-12-10',
        endDate: '2026-12-10',
        allDay: false,
      }),
    ).toBeNull();
  });

  it('rechaza fechas inválidas', () => {
    expect(
      resolveBlockRange({
        timezone: tz,
        startDate: '2026-02-30',
        endDate: '2026-03-01',
        allDay: true,
      }),
    ).toBeNull();
  });

  it('cubre el día del cambio de horario sin perder ni sumar horas', () => {
    // El 5 de septiembre de 2027 Chile adelanta la hora a medianoche (no existe 00:00)
    const r = resolveBlockRange({
      timezone: tz,
      startDate: '2027-09-05',
      endDate: '2027-09-05',
      allDay: true,
    });
    expect(r).not.toBeNull();
    const hours = (r!.endsAt.getTime() - r!.startsAt.getTime()) / 3600000;
    expect(hours).toBe(23);
  });
});

describe('isAllDay', () => {
  it('reconoce un bloqueo de día completo', () => {
    const r = resolveBlockRange({
      timezone: tz,
      startDate: '2026-12-24',
      endDate: '2026-12-25',
      allDay: true,
    })!;
    expect(isAllDay(r, tz)).toBe(true);
  });

  it('un rango horario no es de día completo', () => {
    const r = resolveBlockRange({
      timezone: tz,
      startDate: '2026-12-24',
      endDate: '2026-12-24',
      allDay: false,
      startTime: '09:00',
      endTime: '13:00',
    })!;
    expect(isAllDay(r, tz)).toBe(false);
  });
});

describe('exceedsDays', () => {
  const allDay = (startDate: string, endDate: string) =>
    resolveBlockRange({ timezone: tz, startDate, endDate, allDay: true })!;

  it('un día de 25 h (fin del horario de verano) cuenta como 1 día', () => {
    const r = allDay('2027-04-03', '2027-04-03');
    expect((r.endsAt.getTime() - r.startsAt.getTime()) / 3600000).toBe(25);
    expect(exceedsDays(r, tz, 1)).toBe(false);
  });

  it('dos días completos superan el límite de 1 día', () => {
    expect(exceedsDays(allDay('2027-04-03', '2027-04-04'), tz, 1)).toBe(true);
  });

  it('366 días de calendario están dentro del límite y 367 no', () => {
    expect(exceedsDays(allDay('2027-01-01', '2028-01-01'), tz, 366)).toBe(
      false,
    );
    expect(exceedsDays(allDay('2027-01-01', '2028-01-02'), tz, 366)).toBe(true);
  });
});
