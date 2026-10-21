"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useToken } from "@/lib/useToken";
import type { Service } from "@/lib/types";

const empty = { name: "", durationMin: 30, price: "" };

export default function ServicesPage() {
  const token = useToken();
  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setServices(await api<Service[]>("/services", {}, token));
  }, [token]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api(
        "/services",
        {
          method: "POST",
          body: JSON.stringify({
            name: form.name,
            durationMin: Number(form.durationMin),
            ...(form.price !== "" && { price: Number(form.price) }),
          }),
        },
        token,
      );
      setForm(empty);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    }
  }

  async function toggle(s: Service) {
    setError("");
    try {
      if (s.active) {
        await api(`/services/${s.id}`, { method: "DELETE" }, token);
      } else {
        await api(
          `/services/${s.id}`,
          { method: "PATCH", body: JSON.stringify({ active: true }) },
          token,
        );
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
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
        {services.map((s) => (
          <li key={s.id} className="flex items-center justify-between p-3">
            <div className={s.active ? "" : "opacity-50"}>
              <p className="font-medium">{s.name}</p>
              <p className="text-sm text-gray-600">
                {s.durationMin} min
                {s.price !== null && ` · $${s.price.toLocaleString("es-CL")}`}
                {!s.active && " · Desactivado"}
              </p>
            </div>
            <button
              onClick={() => toggle(s)}
              className="rounded border px-3 py-1 text-sm"
            >
              {s.active ? "Desactivar" : "Activar"}
            </button>
          </li>
        ))}
        {services.length === 0 && (
          <li className="p-3 text-sm text-gray-600">
            Aún no tienes servicios.
          </li>
        )}
      </ul>
    </main>
  );
}
