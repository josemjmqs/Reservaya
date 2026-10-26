"use client";

import { use, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { BookingResult, PublicBusiness } from "@/lib/types";

function todayISO() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function PublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [business, setBusiness] = useState<PublicBusiness | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [slots, setSlots] = useState<string[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<BookingResult | null>(null);

  useEffect(() => {
    api<PublicBusiness>(`/public/${slug}`)
      .then(setBusiness)
      .catch(() => setNotFound(true));
  }, [slug]);

  // Carga los horarios libres. Devuelve el error (si lo hay) en vez de lanzarlo.
  // Carga los horarios libres. Si la petición se cancela, no toca el estado.
  const loadSlots = useCallback(
    async (signal?: AbortSignal): Promise<string | null> => {
      if (!serviceId || !date) return null;
      try {
        const r = await api<{ slots: string[] }>(
          `/public/${slug}/availability?serviceId=${serviceId}&date=${date}`,
          { signal },
        );
        if (signal?.aborted) return null;
        setSlots(r.slots);
        setStartsAt("");
        return null;
      } catch (err) {
        if (signal?.aborted) return null; // cancelada a propósito, no es un error
        return err instanceof Error ? err.message : "Error inesperado";
      }
    },
    [slug, serviceId, date],
  );

  // Al elegir servicio o fecha: cancela la petición anterior
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    loadSlots(controller.signal).then((msg) => {
      if (msg && !controller.signal.aborted) setError(msg);
    });
    return () => controller.abort();
  }, [loadSlots]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await api<BookingResult>(`/public/${slug}/bookings`, {
        method: "POST",
        body: JSON.stringify({
          serviceId,
          startsAt,
          name: form.name,
          email: form.email,
          ...(form.phone && { phone: form.phone }),
        }),
      });
      setDone(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      // refresca los horarios por si alguien tomó la hora;
      // si el refresco falla, se mantiene el error original de la reserva
      await loadSlots();
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (notFound) return <p className="p-6">Negocio no encontrado.</p>;
  if (!business) return <p className="p-6">Cargando...</p>;

  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: business.timezone,
    });

  if (done) {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="text-2xl font-bold">¡Reserva confirmada!</h1>
        <p className="mt-2">
          {new Date(done.startsAt).toLocaleDateString("es-CL", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: business.timezone,
          })}{" "}
          a las {fmt(done.startsAt)} en {business.name}.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold">{business.name}</h1>
      <p className="mb-4 text-gray-600">Reserva tu hora online</p>

      <h2 className="font-semibold">1. Servicio</h2>
      <div className="my-2 flex flex-col gap-2">
        {business.services.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setServiceId(s.id)}
            className={`rounded border p-3 text-left ${
              serviceId === s.id ? "border-black bg-gray-100" : ""
            }`}
          >
            <span className="font-medium">{s.name}</span>
            <span className="block text-sm text-gray-600">
              {s.durationMin} min
              {s.price !== null && ` · $${s.price.toLocaleString("es-CL")}`}
            </span>
          </button>
        ))}
        {business.services.length === 0 && (
          <p className="text-sm text-gray-600">Sin servicios disponibles.</p>
        )}
      </div>

      {serviceId && (
        <>
          <h2 className="mt-4 font-semibold">2. Día y hora</h2>
          <input
            type="date"
            value={date}
            min={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            className="my-2 rounded border p-2"
          />
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStartsAt(s)}
                className={`rounded border px-3 py-1 ${
                  startsAt === s ? "bg-black text-white" : ""
                }`}
              >
                {fmt(s)}
              </button>
            ))}
            {slots.length === 0 && (
              <p className="text-sm text-gray-600">
                No hay horas disponibles ese día.
              </p>
            )}
          </div>
        </>
      )}

      {startsAt && (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
          <h2 className="font-semibold">3. Tus datos</h2>
          <input
            placeholder="Nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded border p-2"
            required
          />
          <input
            type="email"
            placeholder="Correo"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded border p-2"
            required
          />
          <input
            placeholder="Teléfono (opcional)"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="rounded border p-2"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            disabled={loading}
            className="rounded bg-black p-2 text-white disabled:opacity-50"
          >
            {loading ? "Reservando..." : "Confirmar reserva"}
          </button>
        </form>
      )}
      {!startsAt && error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </main>
  );
}
