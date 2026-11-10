"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import { formatTotal } from "@/lib/format";
import type { Service } from "@/lib/types";

const DESCRIPTION_MAX = 300; // igual que SERVICE_DESCRIPTION_MAX en el backend

const empty = {
  name: "",
  category: "",
  description: "",
  durationMin: 30,
  totalMin: "",
  price: "",
};

type ServiceForm = typeof empty;

const fetchServices = () => api<Service[]>("/services");

// Campos de un servicio, iguales al crear y al editar
function ServiceFields({
  value,
  onChange,
  editing = false,
}: {
  value: ServiceForm;
  onChange: (value: ServiceForm) => void;
  editing?: boolean;
}) {
  const set = (patch: Partial<ServiceForm>) => onChange({ ...value, ...patch });
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Field label="Nombre" className="sm:col-span-2">
        <Input
          value={value.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Ej. Corte de pelo"
          required
        />
      </Field>
      <Field label="Categoría" hint={editing ? "Vacío = sin categoría" : undefined}>
        <Input
          list="categories"
          value={value.category}
          onChange={(e) => set({ category: e.target.value })}
          placeholder="Ej. Hombres"
        />
      </Field>
      <Field label="Tiempo de atención (min)" hint="Bloquea la agenda">
        <Input
          type="number"
          min={5}
          max={480}
          value={value.durationMin}
          onChange={(e) => set({ durationMin: Number(e.target.value) })}
          required
        />
      </Field>
      <Field label="Duración total del servicio (min)" hint="Opcional, solo informativa">
        <Input
          type="number"
          min={5}
          value={value.totalMin}
          onChange={(e) => set({ totalMin: e.target.value })}
        />
      </Field>
      <Field label="Precio (CLP)" hint="Opcional">
        <Input
          type="number"
          min={0}
          value={value.price}
          onChange={(e) => set({ price: e.target.value })}
        />
      </Field>
      <Field
        label="Información adicional"
        hint={`Opcional: qué incluye, qué traer, recomendaciones · ${value.description.length}/${DESCRIPTION_MAX}`}
        className="sm:col-span-3"
      >
        <Textarea
          value={value.description}
          onChange={(e) => set({ description: e.target.value })}
          maxLength={DESCRIPTION_MAX}
          rows={2}
        />
      </Field>
    </div>
  );
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<ServiceForm>(empty);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setServices(await fetchServices());
  }, []);

  useEffect(() => {
    fetchServices()
      .then(setServices)
      .catch((e) => setError(e.message));
  }, []);

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
          ...(form.description.trim() !== "" && {
            description: form.description,
          }),
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
      description: s.description ?? "",
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
          description: edit.description,
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
        <form onSubmit={create} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-900">Nuevo servicio</h2>
          <ServiceFields value={form} onChange={setForm} />
          <div>
            <Button>Agregar</Button>
          </div>
        </form>
      </Card>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
        {services.map((s) =>
          editingId === s.id ? (
            <li key={s.id} className="flex flex-col gap-3 bg-gray-50 p-4">
              <ServiceFields value={edit} onChange={setEdit} editing />
              <div className="flex gap-2">
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
              </div>
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
                {s.description && (
                  <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-gray-500">
                    {s.description}
                  </p>
                )}
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
