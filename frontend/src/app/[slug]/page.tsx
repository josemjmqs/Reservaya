"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button, Card, Input } from "@/components/ui";
import type { BookingResult, PublicBusiness } from "@/lib/types";
import { publicDuration } from "@/lib/format";

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
  const [memberId, setMemberId] = useState("");
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

  const loadSlots = useCallback(
    async (signal?: AbortSignal): Promise<string | null> => {
      if (!serviceId || !date) return null;
      try {
        const r = await api<{ slots: string[] }>(
          `/public/${slug}/availability?serviceId=${serviceId}&date=${date}${
            memberId ? `&memberId=${memberId}` : ""
          }`,
          { signal },
        );
        if (signal?.aborted) return null;
        setSlots(r.slots);
        setStartsAt("");
        return null;
      } catch (err) {
        if (signal?.aborted) return null;
        return err instanceof Error ? err.message : "Error inesperado";
      }
    },
    [slug, serviceId, date, memberId],
  );

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
          ...(memberId && { memberId }),
          name: form.name,
          email: form.email,
          ...(form.phone && { phone: form.phone }),
        }),
      });
      setDone(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      await loadSlots();
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (notFound)
    return <p className="p-6 text-gray-600">Negocio no encontrado.</p>;
  if (!business) return <p className="p-6 text-gray-600">Cargando...</p>;

  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: business.timezone,
    });

  const eligible = business.members.filter((m) =>
    m.services.some((s) => s.serviceId === serviceId),
  );

  const hasCategories = business.services.some((s) => s.category);
  const groups = Object.entries(
    business.services.reduce<Record<string, typeof business.services>>(
      (acc, s) => {
        (acc[s.category ?? "Otros"] ??= []).push(s);
        return acc;
      },
      {},
    ),
  );

  if (done) {
    const link = `${window.location.origin}/reserva/${done.manageToken}`;

    return (
      <main className="mx-auto max-w-md px-6 py-12">
        <Card className="p-6 text-center">
          <p className="text-3xl">✓</p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">
            ¡Reserva confirmada!
          </h1>
          <p className="mt-2 text-gray-600">
            {new Date(done.startsAt).toLocaleDateString("es-CL", {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: business.timezone,
            })}{" "}
            a las {fmt(done.startsAt)} en {business.name}.
          </p>

          <div className="mt-5 rounded-lg bg-gray-50 p-3 text-left">
            <p className="text-sm font-medium text-gray-700">
              Guarda este enlace para ver o cancelar tu reserva
            </p>
            <p className="mt-1 break-all text-xs text-gray-500">{link}</p>
            <div className="mt-3 flex gap-2">
              <Link
                href={`/reserva/${done.manageToken}`}
                className="text-sm font-medium text-indigo-600 hover:underline"
              >
                Abrir mi reserva
              </Link>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(link)}
                className="text-sm font-medium text-gray-600 hover:underline"
              >
                Copiar enlace
              </button>
            </div>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{business.name}</h1>
      <p className="mb-6 text-gray-600">Reserva tu hora online</p>

      <h2 className="mb-2 text-sm font-medium text-gray-700">Servicio</h2>
      <div className="flex flex-col gap-2">
        {groups.map(([name, items]) => (
          <div key={name} className="flex flex-col gap-2">
            {hasCategories && (
              <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {name}
              </h3>
            )}
            {items.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setServiceId(s.id);
                  setMemberId("");
                }}
                className={`rounded-lg border p-3 text-left transition ${
                  serviceId === s.id
                    ? "border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <span className="font-medium">{s.name}</span>
                <span className="block text-sm text-gray-600">
                  {publicDuration(s.durationMin, s.totalMin)}
                  {s.price !== null && ` · $${s.price.toLocaleString("es-CL")}`}
                </span>
              </button>
            ))}
          </div>
        ))}
        {business.services.length === 0 && (
          <p className="text-sm text-gray-600">Sin servicios disponibles.</p>
        )}
      </div>

      {eligible.length > 1 && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-medium text-gray-700">
            Profesional
          </h2>
          <div className="flex flex-wrap gap-2">
            {[{ id: "", displayName: "Sin preferencia" }, ...eligible].map(
              (m) => (
                <button
                  key={m.id || "any"}
                  type="button"
                  onClick={() => setMemberId(m.id)}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                    memberId === m.id
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-gray-200 bg-white hover:border-indigo-300"
                  }`}
                >
                  {m.displayName}
                </button>
              ),
            )}
          </div>
        </>
      )}

      {serviceId && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-medium text-gray-700">
            Día y hora
          </h2>
          {(() => {
            const s = business.services.find((x) => x.id === serviceId);
            return s?.totalMin && s.totalMin !== s.durationMin ? (
              <p className="mb-2 text-xs text-gray-500">
                Elige la hora en que llegarás al local.
              </p>
            ) : null;
          })()}
          <Input
            type="date"
            value={date}
            min={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            className="mb-3 w-auto"
          />
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStartsAt(s)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  startsAt === s
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-gray-200 bg-white hover:border-indigo-300"
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
        <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
          <h2 className="text-sm font-medium text-gray-700">Tus datos</h2>
          <Input
            placeholder="Nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            type="email"
            placeholder="Correo"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <Input
            placeholder="Teléfono (opcional)"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button disabled={loading}>
            {loading ? "Reservando..." : "Confirmar reserva"}
          </Button>
        </form>
      )}
      {!startsAt && error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}
    </main>
  );
}
