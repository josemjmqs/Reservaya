'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button, Card, Input } from '@/components/ui';
import type { Service, TeamMember } from '@/lib/types';

const fetchTeam = () =>
  Promise.all([api<TeamMember[]>('/members'), api<Service[]>('/services')]);

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editServices, setEditServices] = useState<string[]>([]);
  const [error, setError] = useState('');

  const apply = useCallback(([m, s]: [TeamMember[], Service[]]) => {
    setMembers(m);
    setServices(s.filter((x) => x.active));
  }, []);

  const load = useCallback(async () => {
    apply(await fetchTeam());
  }, [apply]);

  useEffect(() => {
    fetchTeam()
      .then(apply)
      .catch((e) => setError(e.message));
  }, [apply]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api('/members', {
        method: 'POST',
        body: JSON.stringify({ displayName: name }),
      });
      setName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    }
  }

  function startEdit(m: TeamMember) {
    setError('');
    setEditingId(m.id);
    setEditName(m.displayName);
    setEditServices(m.services.map((s) => s.serviceId));
  }

  function toggleService(id: string) {
    setEditServices((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  }

  async function save(id: string) {
    setError('');
    try {
      await api(`/members/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: editName,
          serviceIds: editServices,
        }),
      });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    }
  }

  async function toggleActive(m: TeamMember) {
    setError('');
    try {
      await api(`/members/${m.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !m.active }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Equipo</h1>
      <p className="mt-1 text-sm text-gray-600">
        Agrega profesionales, define qué servicios hace cada uno y su horario.
      </p>

      <Card className="my-4">
        <form onSubmit={create} className="flex gap-2">
          <Input
            placeholder="Nombre del profesional"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Button>Agregar</Button>
        </form>
      </Card>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
        {members.map((m) =>
          editingId === m.id ? (
            <li key={m.id} className="space-y-3 p-4">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <div>
                <p className="mb-1 text-sm font-medium text-gray-700">
                  Servicios que realiza
                </p>
                <div className="flex flex-wrap gap-3">
                  {services.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="accent-indigo-600"
                        checked={editServices.includes(s.id)}
                        onChange={() => toggleService(s.id)}
                      />
                      {s.name}
                    </label>
                  ))}
                  {services.length === 0 && (
                    <p className="text-sm text-gray-500">
                      Primero crea servicios.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button className="px-3 py-1" onClick={() => save(m.id)}>
                  Guardar
                </Button>
                <Button
                  variant="secondary"
                  className="px-3 py-1"
                  onClick={() => setEditingId(null)}
                >
                  Cancelar
                </Button>
              </div>
            </li>
          ) : (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div className={m.active ? '' : 'opacity-50'}>
                <p className="font-medium">
                  {m.displayName}
                  {m.role === 'OWNER' && (
                    <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                      Dueño
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-600">
                  {m.services.length} servicio(s)
                  {!m.active && ' · Inactivo'}
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/dashboard/hours?memberId=${m.id}`}>
                  <Button variant="secondary" className="px-3 py-1">
                    Horario
                  </Button>
                </Link>
                <Button
                  variant="secondary"
                  className="px-3 py-1"
                  onClick={() => startEdit(m)}
                >
                  Editar
                </Button>
                {m.role !== 'OWNER' && (
                  <Button
                    variant="secondary"
                    className="px-3 py-1"
                    onClick={() => toggleActive(m)}
                  >
                    {m.active ? 'Desactivar' : 'Activar'}
                  </Button>
                )}
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}