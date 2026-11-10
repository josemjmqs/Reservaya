'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button, Input } from '@/components/ui';
import type { TeamMember, WorkingHour } from '@/lib/types';

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

const defaultDay: DayState = {
  enabled: false,
  opensAt: '09:00',
  closesAt: '18:00',
};

const emptyWeek = () =>
  Object.fromEntries(DAYS.map((d) => [d.weekday, defaultDay])) as Record<
    number,
    DayState
  >;

function HoursContent() {
  const memberId = useSearchParams().get('memberId');
  const [memberName, setMemberName] = useState('');
  const [days, setDays] = useState<Record<number, DayState>>(emptyWeek());
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  // Profesional cuyo horario ya llegó del servidor. Hasta entonces la semana
  // está vacía: guardar en ese momento borraría el horario real
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loaded = loadedFor === (memberId ?? '');

  useEffect(() => {
    const url = memberId
      ? `/working-hours?memberId=${memberId}`
      : '/working-hours';

    api<WorkingHour[]>(url)
      .then((rows) => {
        setError('');
        setSaved(false);
        const next = emptyWeek();
        for (const r of rows) {
          next[r.weekday] = {
            enabled: true,
            opensAt: r.opensAt,
            closesAt: r.closesAt,
          };
        }
        setDays(next);
        setLoadedFor(memberId ?? '');
      })
      .catch((e) => setError(e.message));

    // Nombre del profesional para el título
    api<TeamMember[]>('/members')
      .then((list) => {
        const m = memberId
          ? list.find((x) => x.id === memberId)
          : list.find((x) => x.role === 'OWNER');
        setMemberName(m?.displayName ?? '');
      })
      .catch(() => {});
  }, [memberId]);

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
      await api('/working-hours', {
        method: 'PUT',
        body: JSON.stringify({ ...(memberId && { memberId }), days: payload }),
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {memberId && (
        <Link
          href="/dashboard/team"
          className="text-sm text-indigo-600 hover:underline"
        >
          ← Volver al equipo
        </Link>
      )}
      <h1 className="mt-1 text-xl font-semibold tracking-tight">
        Horario de atención{memberName && ` · ${memberName}`}
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        Marca los días en que atiende y define el horario de cada uno.
      </p>

      {!loaded && !error && (
        <p className="my-4 text-sm text-gray-500">Cargando horario...</p>
      )}
      <ul
        hidden={!loaded}
        className="my-4 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm"
      >
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
      {saved && (
        <p className="mb-3 text-sm text-green-700">Horario guardado.</p>
      )}

      <Button onClick={save} disabled={saving || !loaded}>
        {saving ? 'Guardando...' : 'Guardar horario'}
      </Button>
    </div>
  );
}

export default function HoursPage() {
  return (
    <Suspense fallback={null}>
      <HoursContent />
    </Suspense>
  );
}