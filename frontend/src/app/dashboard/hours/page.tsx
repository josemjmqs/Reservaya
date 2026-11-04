'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button, Input } from '@/components/ui';
import type { WorkingHour } from '@/lib/types';

const DAYS = [
  { weekday: 1, label: 'Lunes' },
  { weekday: 2, label: 'Martes' },
  { weekday: 3, label: 'Miércoles' },
  { weekday: 4, label: 'Jueves' },
  { weekday: 5, label: 'Viernes' },
  { weekday: 6, label: 'Sábado' },
  { weekday: 0, label: 'Domingo' },
];

interface DayState {
  enabled: boolean;
  opensAt: string;
  closesAt: string;
}

const defaultDay: DayState = {
  enabled: false,
  opensAt: '09:00',
  closesAt: '18:00',
};

export default function HoursPage() {
  const [days, setDays] = useState<Record<number, DayState>>(
    Object.fromEntries(DAYS.map((d) => [d.weekday, defaultDay])),
  );
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<WorkingHour[]>('/working-hours')
      .then((rows) => {
        setDays((prev) => {
          const next = { ...prev };
          for (const r of rows) {
            next[r.weekday] = {
              enabled: true,
              opensAt: r.opensAt,
              closesAt: r.closesAt,
            };
          }
          return next;
        });
      })
      .catch((e) => setError(e.message));
  }, []);

  function update(weekday: number, patch: Partial<DayState>) {
    setSaved(false);
    setDays((d) => ({ ...d, [weekday]: { ...d[weekday], ...patch } }));
  }

  async function save() {
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      const payload = DAYS.filter((d) => days[d.weekday].enabled).map((d) => ({
        weekday: d.weekday,
        opensAt: days[d.weekday].opensAt,
        closesAt: days[d.weekday].closesAt,
      }));
      await api(
        '/working-hours',
        { method: 'PUT', body: JSON.stringify({ days: payload }) }
      );
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">
        Horario de atención
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        Marca los días en que atiendes y define el horario de cada uno.
      </p>

      <ul className="my-4 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
        {DAYS.map(({ weekday, label }) => {
          const day = days[weekday];
          return (
            <li
              key={weekday}
              className="flex flex-wrap items-center gap-3 p-4"
            >
              <label className="flex w-36 cursor-pointer items-center gap-3 font-medium">
                <input
                  type="checkbox"
                  checked={day.enabled}
                  onChange={(e) =>
                    update(weekday, { enabled: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300 accent-indigo-600"
                />
                {label}
              </label>
              {day.enabled ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={day.opensAt}
                    onChange={(e) =>
                      update(weekday, { opensAt: e.target.value })
                    }
                    className="w-auto"
                  />
                  <span className="text-sm text-gray-500">a</span>
                  <Input
                    type="time"
                    value={day.closesAt}
                    onChange={(e) =>
                      update(weekday, { closesAt: e.target.value })
                    }
                    className="w-auto"
                  />
                </div>
              ) : (
                <span className="text-sm text-gray-400">Cerrado</span>
              )}
            </li>
          );
        })}
      </ul>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {saved && <p className="mb-3 text-sm text-green-700">Horario guardado.</p>}

      <Button onClick={save} disabled={saving}>
        {saving ? 'Guardando...' : 'Guardar horario'}
      </Button>
    </div>
  );
}