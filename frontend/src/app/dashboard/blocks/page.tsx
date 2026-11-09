'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button, Card, Input } from '@/components/ui';
import type { TeamMember, TimeBlock, TimeBlockList } from '@/lib/types';

function today() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Describe el período en la zona horaria del negocio
function describe(block: TimeBlock, timeZone: string) {
  const start = new Date(block.startsAt);
  // El fin es exclusivo: un día completo termina a medianoche del día siguiente
  const end = new Date(
    new Date(block.endsAt).getTime() - (block.allDay ? 1 : 0),
  );
  const key = (d: Date) => d.toLocaleDateString('en-CA', { timeZone });
  const sameDay = key(start) === key(end);

  const longDay = (d: Date) =>
    d.toLocaleDateString('es-CL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone,
    });
  const shortDay = (d: Date) =>
    d.toLocaleDateString('es-CL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone,
    });
  const time = (d: Date) =>
    d.toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone,
    });

  if (block.allDay) {
    return sameDay
      ? `${longDay(start)} · Todo el día`
      : `${shortDay(start)} al ${shortDay(end)} · Todo el día`;
  }
  return sameDay
    ? `${longDay(start)} · ${time(start)} a ${time(end)}`
    : `${shortDay(start)} ${time(start)} al ${shortDay(end)} ${time(end)}`;
}

export default function BlocksPage() {
  const [data, setData] = useState<TimeBlockList | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [memberId, setMemberId] = useState(''); // '' = todo el negocio
  const [allDay, setAllDay] = useState(true);
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [startTime, setStartTime] = useState('13:00');
  const [endTime, setEndTime] = useState('15:00');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setData(await api<TimeBlockList>('/time-blocks'));
  }, []);

  useEffect(() => {
    api<TimeBlockList>('/time-blocks')
      .then(setData)
      .catch((e) => setError(e.message));
    api<TeamMember[]>('/members')
      .then((list) => setMembers(list.filter((m) => m.active)))
      .catch(() => {});
  }, []);

  function changeStart(value: string) {
    setStartDate(value);
    if (endDate < value) setEndDate(value);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    setSaving(true);
    try {
      const created = await api<TimeBlock & { conflicts: number }>(
        '/time-blocks',
        {
          method: 'POST',
          body: JSON.stringify({
            startDate,
            endDate,
            allDay,
            ...(!allDay && { startTime, endTime }),
            ...(memberId && { memberId }),
            ...(reason.trim() && { reason: reason.trim() }),
          }),
        },
      );
      setReason('');
      if (created.conflicts > 0) {
        setNotice(
          created.conflicts === 1
            ? 'Ojo: ya hay 1 reserva en ese período. No se cancela sola; revísala en la Agenda.'
            : `Ojo: ya hay ${created.conflicts} reservas en ese período. No se cancelan solas; revísalas en la Agenda.`,
        );
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setError('');
    setNotice('');
    try {
      await api(`/time-blocks/${id}`, { method: 'DELETE' });
      setConfirmId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Bloqueos</h1>
      <p className="mt-1 text-sm text-gray-600">
        Cierra días u horas por vacaciones, feriados o trámites. En esos
        períodos no se ofrecen horas en tu página pública.
      </p>

      <Card className="my-4">
        <form onSubmit={create} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">
                Aplica a
              </span>
              <select
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">Todo el negocio</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">
                Motivo (opcional)
              </span>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={100}
                placeholder="Vacaciones, feriado, trámite..."
              />
            </label>
          </div>

          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 accent-indigo-600"
            />
            Día completo
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">
                Desde
              </span>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => changeStart(e.target.value)}
                  required
                />
                {!allDay && (
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-auto"
                    required
                  />
                )}
              </div>
            </div>
            <div className="text-sm">
              <span className="mb-1 block font-medium text-gray-700">
                Hasta
              </span>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
                {!allDay && (
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-auto"
                    required
                  />
                )}
              </div>
            </div>
          </div>

          <Button disabled={saving}>
            {saving ? 'Guardando...' : 'Bloquear'}
          </Button>
        </form>
      </Card>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {notice && (
        <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
          {notice}
        </p>
      )}

      {data && data.blocks.length === 0 && (
        <p className="text-sm text-gray-500">
          No tienes bloqueos vigentes ni próximos.
        </p>
      )}

      {data && data.blocks.length > 0 && (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
          {data.blocks.map((b) => (
            <li
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div>
                <p className="font-medium first-letter:uppercase">
                  {describe(b, data.timezone)}
                </p>
                <p className="text-sm text-gray-600">
                  {b.member ? b.member.displayName : 'Todo el negocio'}
                  {b.reason && ` · ${b.reason}`}
                </p>
              </div>
              {confirmId === b.id ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">¿Eliminar?</span>
                  <Button
                    variant="danger"
                    className="px-3 py-1"
                    onClick={() => remove(b.id)}
                  >
                    Sí, eliminar
                  </Button>
                  <Button
                    variant="secondary"
                    className="px-3 py-1"
                    onClick={() => setConfirmId(null)}
                  >
                    No
                  </Button>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  className="px-3 py-1"
                  onClick={() => setConfirmId(b.id)}
                >
                  Eliminar
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
