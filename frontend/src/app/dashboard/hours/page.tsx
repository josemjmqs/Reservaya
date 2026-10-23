'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useToken } from '@/lib/useToken';
import type { WorkingHour } from '@/lib/types';

// Orden de la semana para mostrar: lunes primero (weekday 0 = domingo)
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

const defaultDay: DayState = { enabled: false, opensAt: '09:00', closesAt: '18:00' };

export default function HoursPage() {
  const token = useToken();
  const [days, setDays] = useState<Record<number, DayState>>(
    Object.fromEntries(DAYS.map((d) => [d.weekday, defaultDay])),
  );
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    api<WorkingHour[]>('/working-hours', {}, token)
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
  }, [token]);

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
        { method: 'PUT', body: JSON.stringify({ days: payload }) },
        token,
      );
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/dashboard" className="text-sm underline">
        ← Volver
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Horario de atención</h1>

      <ul className="my-4 divide-y rounded border">
        {DAYS.map(({ weekday, label }) => {
          const day = days[weekday];
          return (
            <li key={weekday} className="flex items-center gap-3 p-3">
              <label className="flex w-36 items-center gap-2">
                <input
                  type="checkbox"
                  checked={day.enabled}
                  onChange={(e) => update(weekday, { enabled: e.target.checked })}
                />
                {label}
              </label>
              {day.enabled ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={day.opensAt}
                    onChange={(e) => update(weekday, { opensAt: e.target.value })}
                    className="rounded border p-1"
                  />
                  <span>a</span>
                  <input
                    type="time"
                    value={day.closesAt}
                    onChange={(e) => update(weekday, { closesAt: e.target.value })}
                    className="rounded border p-1"
                  />
                </div>
              ) : (
                <span className="text-sm text-gray-500">Cerrado</span>
              )}
            </li>
          );
        })}
      </ul>

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {saved && <p className="mb-2 text-sm text-green-700">Horario guardado.</p>}

      <button
        onClick={save}
        disabled={saving}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {saving ? 'Guardando...' : 'Guardar horario'}
      </button>
    </main>
  );
}