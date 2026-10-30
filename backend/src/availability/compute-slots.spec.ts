import { computeSlots } from './compute-slots';

const base = {
  date: '2026-11-02',
  timezone: 'America/Santiago',
  opensAt: '09:00',
  closesAt: '12:00',
  durationMin: 60,
  busy: [],
  now: new Date('2026-10-01T00:00:00Z'),
};

describe('computeSlots', () => {
  it('genera todos los espacios de un día libre', () => {
    expect(computeSlots(base)).toHaveLength(3); // 9, 10, 11
  });

  it('descarta espacios que se solapan con una reserva', () => {
    // En noviembre Santiago es UTC-3: 10:00 local = 13:00 UTC
    const slots = computeSlots({
      ...base,
      busy: [
        {
          startsAt: new Date('2026-11-02T13:00:00Z'),
          endsAt: new Date('2026-11-02T14:00:00Z'),
        },
      ],
    });
    expect(slots).toHaveLength(2);
  });

  it('una reserva que termina justo al inicio no bloquea', () => {
    const slots = computeSlots({
      ...base,
      busy: [
        {
          startsAt: new Date('2026-11-02T12:00:00Z'), // 09:00 local
          endsAt: new Date('2026-11-02T13:00:00Z'), // 10:00 local
        },
      ],
    });
    expect(slots).toHaveLength(2); // solo se pierde el de las 9
  });

  it('no ofrece horas pasadas', () => {
    const slots = computeSlots({
      ...base,
      now: new Date('2026-11-02T13:30:00Z'), // 10:30 local
    });
    expect(slots).toHaveLength(1); // solo 11:00
  });

  it('no ofrece un servicio que no cabe antes del cierre', () => {
    const slots = computeSlots({ ...base, durationMin: 90, stepMin: 60 });
    // 9:00-10:30, 10:00-11:30; 11:00-12:30 ya no cabe
    expect(slots).toHaveLength(2);
  });

  it('respeta la zona horaria: 09:00 local es 12:00 UTC en noviembre', () => {
    const [first] = computeSlots(base);
    expect(first.toISOString()).toBe('2026-11-02T12:00:00.000Z');
  });
});

describe('computeSlots y horario de verano', () => {
  const common = {
    timezone: 'America/Santiago',
    opensAt: '09:00',
    closesAt: '12:00',
    durationMin: 60,
    busy: [],
    now: new Date('2026-01-01T00:00:00Z'),
  };

  const WINTER_DATE = '2026-07-06'; // UTC-4
  const SUMMER_DATE = '2026-11-02'; // UTC-3

  it('en invierno 09:00 local equivale a 13:00 UTC', () => {
    const [first] = computeSlots({ ...common, date: WINTER_DATE });
    expect(first.toISOString()).toBe('2026-07-06T13:00:00.000Z');
  });

  it('en verano 09:00 local equivale a 12:00 UTC', () => {
    const [first] = computeSlots({ ...common, date: SUMMER_DATE });
    expect(first.toISOString()).toBe('2026-11-02T12:00:00.000Z');
  });

  it('la hora local es la misma (09:00) en ambas estaciones', () => {
    const local = (d: Date) =>
      d.toLocaleTimeString('en-GB', {
        timeZone: 'America/Santiago',
        hour: '2-digit',
        minute: '2-digit',
      });
    const w = computeSlots({ ...common, date: WINTER_DATE });
    const s = computeSlots({ ...common, date: SUMMER_DATE });
    expect(local(w[0])).toBe('09:00');
    expect(local(s[0])).toBe('09:00');
  });

  it('la hora local no se corre alrededor del cambio de horario', () => {
    const casos: [string, string][] = [
      ['2026-04-03', '2026-04-03T12:00:00.000Z'], // antes del cambio a invierno
      ['2026-04-06', '2026-04-06T13:00:00.000Z'], // después
      ['2026-09-04', '2026-09-04T13:00:00.000Z'], // antes del cambio a verano
      ['2026-09-07', '2026-09-07T12:00:00.000Z'], // después
    ];
    for (const [date, esperado] of casos) {
      const [first] = computeSlots({ ...common, date });
      expect(first.toISOString()).toBe(esperado);
    }
  });
});