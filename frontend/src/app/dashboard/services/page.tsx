'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useToken } from '@/lib/useToken';
import type { Service } from '@/lib/types';

const empty = { name: '', durationMin: 30, price: '' };

interface EditState {
  name: string;
  durationMin: number;
  price: string;
}

export default function ServicesPage() {
  const token = useToken();
  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState>(empty);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setServices(await api<Service[]>('/services', {}, token));
  }, [token]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api(
        '/services',
        {
          method: 'POST',
          body: JSON.stringify({
            name: form.name,
            durationMin: Number(form.durationMin),
            ...(form.price !== '' && { price: Number(form.price) }),
          }),
        },
        token,
      );
      setForm(empty);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    }
  }

  function startEdit(s: Service) {
    setError('');
    setEditingId(s.id);
    setEdit({
      name: s.name,
      durationMin: s.durationMin,
      price: s.price === null ? '' : String(s.price),
    });
  }

  async function saveEdit(id: string) {
    setError('');
    try {
      await api(
        `/services/${id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: edit.name,
            durationMin: Number(edit.durationMin),
            ...(edit.price !== '' && { price: Number(edit.price) }),
          }),
        },
        token,
      );
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    }
  }

  async function toggle(s: Service) {
    setError('');
    try {
      if (s.active) {
        await api(`/services/${s.id}`, { method: 'DELETE' }, token);
      } else {
        await api(
          `/services/${s.id}`,
          { method: 'PATCH', body: JSON.stringify({ active: true }) },
          token,
        );
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/dashboard" className="text-sm underline">
        ← Volver
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Servicios</h1>

      <form onSubmit={create} className="my-4 flex flex-wrap gap-2">
        <input
          placeholder="Nombre"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="flex-1 rounded border p-2"
          required
        />
        <input
          type="number"
          placeholder="Minutos"
          value={form.durationMin}
          onChange={(e) =>
            setForm({ ...form, durationMin: Number(e.target.value) })
          }
          className="w-24 rounded border p-2"
          required
        />
        <input
          type="number"
          placeholder="Precio (CLP)"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          className="w-32 rounded border p-2"
        />
        <button className="rounded bg-black px-4 text-white">Agregar</button>
      </form>

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <ul className="divide-y rounded border">
        {services.map((s) =>
          editingId === s.id ? (
            <li key={s.id} className="flex flex-wrap items-center gap-2 p-3">
              <input
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                className="flex-1 rounded border p-2"
              />
              <input
                type="number"
                value={edit.durationMin}
                onChange={(e) =>
                  setEdit({ ...edit, durationMin: Number(e.target.value) })
                }
                className="w-24 rounded border p-2"
              />
              <input
                type="number"
                placeholder="Precio"
                value={edit.price}
                onChange={(e) => setEdit({ ...edit, price: e.target.value })}
                className="w-32 rounded border p-2"
              />
              <button
                onClick={() => saveEdit(s.id)}
                className="rounded bg-black px-3 py-1 text-sm text-white"
              >
                Guardar
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="rounded border px-3 py-1 text-sm"
              >
                Cancelar
              </button>
            </li>
          ) : (
            <li key={s.id} className="flex items-center justify-between p-3">
              <div className={s.active ? '' : 'opacity-50'}>
                <p className="font-medium">{s.name}</p>
                <p className="text-sm text-gray-600">
                  {s.durationMin} min
                  {s.price !== null && ` · $${s.price.toLocaleString('es-CL')}`}
                  {!s.active && ' · Desactivado'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(s)}
                  className="rounded border px-3 py-1 text-sm"
                >
                  Editar
                </button>
                <button
                  onClick={() => toggle(s)}
                  className="rounded border px-3 py-1 text-sm"
                >
                  {s.active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </li>
          ),
        )}
        {services.length === 0 && (
          <li className="p-3 text-sm text-gray-600">
            Aún no tienes servicios.
          </li>
        )}
      </ul>
    </main>
  );
}