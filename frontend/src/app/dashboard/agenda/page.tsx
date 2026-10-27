"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useToken } from "@/lib/useToken";
import type { AgendaBooking, SettableStatus } from "@/lib/types";

const TZ = "America/Santiago";
const LABELS: Record<AgendaBooking["status"], string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
  NO_SHOW: "No se presentó",
};

function iso(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function AgendaPage() {
  const token = useToken();
  const [date, setDate] = useState(iso(new Date()));
  const [bookings, setBookings] = useState<AgendaBooking[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setBookings(
        await api<AgendaBooking[]>(
          `/agenda?from=${date}&to=${date}`,
          {},
          token,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  }, [token, date]);

  useEffect(() => {
    setError("");
    load();
  }, [load]);

  function shift(days: number) {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + days);
    setDate(iso(d));
  }

  async function setStatus(id: string, status: SettableStatus) {
    setError("");
    try {
      await api(
        `/agenda/${id}/status`,
        { method: "PATCH", body: JSON.stringify({ status }) },
        token,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  }

  const time = (s: string) =>
    new Date(s).toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: TZ,
    });

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/dashboard" className="text-sm underline">
        ← Volver
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Agenda</h1>

      <div className="my-4 flex items-center gap-2">
        <button onClick={() => shift(-1)} className="rounded border px-3 py-1">
          ←
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded border p-1"
        />
        <button onClick={() => shift(1)} className="rounded border px-3 py-1">
          →
        </button>
      </div>

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <ul className="divide-y rounded border">
        {bookings.map((b) => (
          <li key={b.id} className="p-3">
            <div className="flex items-center justify-between">
              <p className="font-medium">
                {time(b.startsAt)} – {time(b.endsAt)} · {b.service.name}
              </p>
              <span className="text-sm text-gray-600">{LABELS[b.status]}</span>
            </div>
            <p className="text-sm text-gray-600">
              {b.customer.name} · {b.customer.email}
              {b.customer.phone && ` · ${b.customer.phone}`}
            </p>
            {(b.status === "CONFIRMED" || b.status === "PENDING") && (
              <div className="mt-2 flex gap-2 text-sm">
                <button
                  onClick={() => setStatus(b.id, "COMPLETED")}
                  className="rounded border px-2 py-1"
                >
                  Completada
                </button>
                <button
                  onClick={() => setStatus(b.id, "NO_SHOW")}
                  className="rounded border px-2 py-1"
                >
                  No se presentó
                </button>
                <button
                  onClick={() => setStatus(b.id, "CANCELLED")}
                  className="rounded border px-2 py-1"
                >
                  Cancelar
                </button>
              </div>
            )}
          </li>
        ))}
        {bookings.length === 0 && (
          <li className="p-3 text-sm text-gray-600">Sin reservas este día.</li>
        )}
      </ul>
    </main>
  );
}
