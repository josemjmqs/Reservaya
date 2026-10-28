"use client";

import { use, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ManagedBooking } from "@/lib/types";

const LABELS = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
  NO_SHOW: "No se presentó",
} as const;

export default function ManageBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [booking, setBooking] = useState<ManagedBooking | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<ManagedBooking>(`/public/bookings/${token}`)
      .then(setBooking)
      .catch(() => setNotFound(true));
  }, [token]);

  async function cancel() {
    if (!confirm("¿Seguro que quieres cancelar esta reserva?")) return;
    setError("");
    setLoading(true);
    try {
      await api(`/public/bookings/${token}/cancel`, { method: "POST" });
      setBooking((b) => (b ? { ...b, status: "CANCELLED" } : b));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  if (notFound) return <p className="p-6">Reserva no encontrada.</p>;
  if (!booking) return <p className="p-6">Cargando...</p>;

  const tz = booking.business.timezone;
  const day = new Date(booking.startsAt).toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: tz,
  });
  const time = new Date(booking.startsAt).toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  });
  const canCancel =
    (booking.status === "CONFIRMED" || booking.status === "PENDING") &&
    new Date(booking.startsAt).getTime() > Date.now();

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold">{booking.business.name}</h1>
      <div className="my-4 rounded border p-4">
        <p className="font-medium">{booking.service.name}</p>
        <p className="capitalize">
          {day}, {time}
        </p>
        <p className="mt-2 text-sm text-gray-600">
          Estado: {LABELS[booking.status]}
        </p>
      </div>

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      {canCancel && (
        <button
          onClick={cancel}
          disabled={loading}
          className="rounded border border-red-600 px-4 py-2 text-red-600 disabled:opacity-50"
        >
          {loading ? "Cancelando..." : "Cancelar reserva"}
        </button>
      )}
    </main>
  );
}
