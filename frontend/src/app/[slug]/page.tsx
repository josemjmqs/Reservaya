"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button, Card, Input } from "@/components/ui";
import type { BookingResult, PublicBusiness } from "@/lib/types";
import { ServicePicker } from "@/components/ServicePicker";
import { formatTotal, publicDuration } from "@/lib/format";

const MAX_SERVICES = 5; // igual que MAX_SERVICES_PER_BOOKING en el backend

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
  // servicios elegidos, en el orden en que se marcaron (es el orden en que se hacen)
  const [serviceIds, setServiceIds] = useState<string[]>([]);
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

  const serviceKey = serviceIds.join(",");

  const fetchSlots = useCallback(
    (signal?: AbortSignal) =>
      api<{ slots: string[] }>(
        `/public/${slug}/availability?serviceIds=${serviceKey}&date=${date}${
          memberId ? `&memberId=${memberId}` : ""
        }`,
        { signal },
      ),
    [slug, serviceKey, date, memberId],
  );

  // Recarga las horas tras un error al reservar (ej. alguien tomó la hora)
  async function reloadSlots() {
    try {
      setSlots((await fetchSlots()).slots);
      setStartsAt("");
    } catch {
      // el error de la reserva es el que importa mostrar
    }
  }

  useEffect(() => {
    if (!serviceKey || !date) return;
    const controller = new AbortController();
    fetchSlots(controller.signal)
      .then((r) => {
        setSlots(r.slots);
        setStartsAt("");
        setError("");
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Error inesperado");
      });
    return () => controller.abort();
  }, [fetchSlots, serviceKey, date]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await api<BookingResult>(`/public/${slug}/bookings`, {
        method: "POST",
        body: JSON.stringify({
          serviceIds,
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
      await reloadSlots();
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (notFound)
    return <p className="p-6 text-gray-600">Negocio no encontrado.</p>;
  if (!business) return <p className="p-6 text-gray-600">Cargando...</p>;

  if (!business.acceptsBookings)
    return (
      <main className="mx-auto w-full max-w-md px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">{business.name}</h1>
        <p className="mt-2 text-gray-600">
          Este negocio todavía no recibe reservas online. Vuelve a intentarlo
          pronto.
        </p>
      </main>
    );

  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: business.timezone,
    });

  const selected = serviceIds
    .map((id) => business.services.find((s) => s.id === id))
    .filter((s) => s !== undefined);
  // Un mismo profesional hace todos los servicios elegidos
  const eligible = business.members.filter((m) =>
    serviceIds.every((id) => m.services.some((s) => s.serviceId === id)),
  );
  const noOneDoesAll = selected.length > 1 && eligible.length === 0;
  const totalMin = selected.reduce((sum, s) => sum + s.durationMin, 0);
  const totalPrice = selected.every((s) => s.price !== null)
    ? selected.reduce((sum, s) => sum + (s.price ?? 0), 0)
    : null;

  function toggleService(id: string) {
    setServiceIds((ids) =>
      ids.includes(id)
        ? ids.filter((x) => x !== id)
        : ids.length < MAX_SERVICES
          ? [...ids, id]
          : ids,
    );
    setMemberId("");
    setStartsAt("");
  }

  if (done) {
    const link = `${window.location.origin}/reserva/${done.manageToken}`;

    return (
      <main className="mx-auto w-full max-w-md px-6 py-12">
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
          <p className="mt-1 text-sm text-gray-500">
            {selected.map((s) => s.name).join(" + ")}
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
    <main className="mx-auto w-full max-w-md px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{business.name}</h1>
      <p className="mb-6 text-gray-600">Reserva tu hora online</p>

      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-gray-700">Servicios</h2>
        <p className="text-xs text-gray-500">
          {serviceIds.length >= MAX_SERVICES
            ? `Máximo ${MAX_SERVICES} por reserva`
            : "Puedes elegir más de uno"}
        </p>
      </div>
      <ServicePicker
        services={business.services}
        selectedIds={serviceIds}
        onToggle={toggleService}
        maxReached={serviceIds.length >= MAX_SERVICES}
      />

      {/* Barra fija abajo mientras se elige: muestra lo elegido aunque la
          lista de servicios sea larga y el resumen quede fuera de la pantalla */}
      {selected.length > 0 && (
        <div className="sticky bottom-0 z-10 -mx-6 mt-4 border-t border-gray-200 bg-white/95 px-6 py-3 backdrop-blur">
          {noOneDoesAll ? (
            <p className="text-sm text-amber-800">
              Ningún profesional hace todos estos servicios en una misma
              visita. Quita alguno o resérvalos por separado.
            </p>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">
                  {selected.map((s) => s.name).join(" + ")}
                </p>
                <p className="text-sm text-gray-600">
                  {selected.length === 1
                    ? publicDuration(selected[0].durationMin, selected[0].totalMin)
                    : `${selected.length} servicios seguidos · ${formatTotal(totalMin)}`}
                  {totalPrice !== null &&
                    ` · $${totalPrice.toLocaleString("es-CL")}`}
                </p>
              </div>
              <a
                href="#dia-y-hora"
                className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Ver horas
              </a>
            </div>
          )}
        </div>
      )}

      {selected.length > 0 && !noOneDoesAll && (
        <>
          <h2
            id="dia-y-hora"
            className="mb-2 mt-6 scroll-mt-6 text-sm font-medium text-gray-700"
          >
            Día y hora
          </h2>
          {selected.some((s) => s.totalMin && s.totalMin !== s.durationMin) && (
            <p className="mb-2 text-xs text-gray-500">
              Elige la hora en que llegarás al local.
            </p>
          )}
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
          <p className="text-xs text-gray-500">
            Al reservar aceptas que {business.name} use tus datos para gestionar
            tu reserva. Más información en la{" "}
            <Link href="/privacidad" className="underline">
              política de privacidad
            </Link>
            .
          </p>
        </form>
      )}
      {!startsAt && error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}
    </main>
  );
}
