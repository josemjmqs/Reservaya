"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Button, Card, Input } from "@/components/ui";
import { formatTotal } from "@/lib/format";
import type { Service } from "@/lib/types";

const empty = {
  name: "",
  category: "",
  durationMin: 30,
  totalMin: "",
  price: "",
};

interface EditState {
  name: string;
  category: string;
  durationMin: number;
  totalMin: string;
  price: string;
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState>(empty);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setServices(await api<Service[]>("/services"));
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  const categories = useMemo(
    () => [
      ...new Set(
        services.map((s) => s.category).filter((c): c is string => !!c),
      ),
    ],
    [services],
  );

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/services", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          durationMin: Number(form.durationMin),
          ...(form.category.trim() !== "" && { category: form.category }),
          ...(form.totalMin !== "" && { totalMin: Number(form.totalMin) }),
          ...(form.price !== "" && { price: Number(form.price) }),
        }),
      });
      setForm(empty);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    }
  }

  function startEdit(s: Service) {
    setError("");
    setEditingId(s.id);
    setEdit({
      name: s.name,
      category: s.category ?? "",
      durationMin: s.durationMin,
      totalMin: s.totalMin === null ? "" : String(s.totalMin),
      price: s.price === null ? "" : String(s.price),
    });
  }

  async function saveEdit(id: string) {
    setError("");
    try {
      await api(`/services/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: edit.name,
          durationMin: Number(edit.durationMin),
          category: edit.category.trim() === "" ? null : edit.category,
          totalMin: edit.totalMin === "" ? null : Number(edit.totalMin),
          price: edit.price === "" ? null : Number(edit.price),
        }),
      });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    }
  }

  async function toggle(s: Service) {
    setError("");
    try {
      if (s.active) {
        await api(`/services/${s.id}`, { method: "DELETE" });
      } else {
        await api(`/services/${s.id}`, {
          method: "PATCH",
          body: JSON.stringify({ active: true }),
        });
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Servicios</h1>

      <datalist id="categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <Card className="my-4">
        <form onSubmit={create} className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Nombre del servicio"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="min-w-48 flex-1"
            required
          />
          <Input
            list="categories"
            placeholder="Categoría (ej. Cortes de pelo)"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-48"
          />
          <Input
            type="number"
            placeholder="Min. de atención"
            value={form.durationMin}
            onChange={(e) =>
              setForm({ ...form, durationMin: Number(e.target.value) })
            }
            className="w-36"
            required
          />
          <Input
            type="number"
            placeholder="Duración total (opcional)"
            value={form.totalMin}
            onChange={(e) => setForm({ ...form, totalMin: e.target.value })}
            className="w-52"
          />
          <Input
            type="number"
            placeholder="Precio (CLP)"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="w-32"
          />
          <Button>Agregar</Button>
        </form>
      </Card>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
        {services.map((s) =>
          editingId === s.id ? (
            <li key={s.id} className="flex flex-wrap items-center gap-2 p-4">
              <Input
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                className="min-w-48 flex-1"
              />
              <Input
                list="categories"
                placeholder="Categoría (vacío = ninguna)"
                value={edit.category}
                onChange={(e) => setEdit({ ...edit, category: e.target.value })}
                className="w-48"
              />
              <Input
                type="number"
                placeholder="Min. de atención"
                value={edit.durationMin}
                onChange={(e) =>
                  setEdit({ ...edit, durationMin: Number(e.target.value) })
                }
                className="w-36"
              />
              <Input
                type="number"
                placeholder="Duración total (vacío = ninguna)"
                value={edit.totalMin}
                onChange={(e) => setEdit({ ...edit, totalMin: e.target.value })}
                className="w-52"
              />
              <Input
                type="number"
                placeholder="Precio (vacío = sin precio)"
                value={edit.price}
                onChange={(e) => setEdit({ ...edit, price: e.target.value })}
                className="w-40"
              />
              <Button className="px-3 py-1" onClick={() => saveEdit(s.id)}>
                Guardar
              </Button>
              <Button
                variant="secondary"
                className="px-3 py-1"
                onClick={() => setEditingId(null)}
              >
                Cancelar
              </Button>
            </li>
          ) : (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 p-4"
            >
              <div className={s.active ? "" : "opacity-50"}>
                <p className="font-medium">
                  {s.name}
                  {s.category && (
                    <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-600">
                      {s.category}
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-600">
                  {s.durationMin} min de atención
                  {s.totalMin && ` · total ${formatTotal(s.totalMin)}`}
                  {s.price !== null && ` · $${s.price.toLocaleString("es-CL")}`}
                  {!s.active && " · Desactivado"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="px-3 py-1"
                  onClick={() => startEdit(s)}
                >
                  Editar
                </Button>
                <Button
                  variant="secondary"
                  className="px-3 py-1"
                  onClick={() => toggle(s)}
                >
                  {s.active ? "Desactivar" : "Activar"}
                </Button>
              </div>
            </li>
          ),
        )}
        {services.length === 0 && (
          <li className="p-6 text-center text-sm text-gray-500">
            Aún no tienes servicios.
          </li>
        )}
      </ul>
    </div>
  );
}
