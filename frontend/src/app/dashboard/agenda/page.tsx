"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, Input } from "@/components/ui";
import type {
  AgendaBooking,
  BookingStatus,
  SettableStatus,
  TeamMember,
} from "@/lib/types";

const TZ = "America/Santiago";

const LABELS: Record<BookingStatus, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
  NO_SHOW: "No se presentó",
};

const BADGE: Record<BookingStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
  CONFIRMED: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  COMPLETED: "bg-green-50 text-green-700 ring-green-200",
  CANCELLED: "bg-gray-100 text-gray-600 ring-gray-200",
  NO_SHOW: "bg-red-50 text-red-700 ring-red-200",
};

function iso(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const fetchAgenda = (date: string, memberId: string) =>
  api<AgendaBooking[]>(
    `/agenda?from=${date}&to=${date}${memberId ? `&memberId=${memberId}` : ""}`,
  );

export default function AgendaPage() {
  const [date, setDate] = useState(iso(new Date()));
  const [bookings, setBookings] = useState<AgendaBooking[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [memberId, setMemberId] = useState(""); // "" = todos
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setBookings(await fetchAgenda(date, memberId));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  }, [date, memberId]);

  useEffect(() => {
    api<TeamMember[]>("/members")
      .then((list) => setMembers(list.filter((m) => m.active)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // al cambiar de día, ignora la respuesta del día anterior si llega tarde
    let stale = false;
    fetchAgenda(date, memberId)
      .then((list) => {
        if (stale) return;
        setBookings(list);
        setError("");
      })
      .catch((e) => {
        if (!stale) setError(e instanceof Error ? e.message : "Error inesperado");
      });
    return () => {
      stale = true;
    };
  }, [date, memberId]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") load();
    };

    const id = setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);

  function shift(days: number) {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + days);
    setDate(iso(d));
  }

  async function setStatus(id: string, status: SettableStatus) {
    setError("");
    try {
      await api(`/agenda/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
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

  const dayLabel = new Date(`${date}T12:00:00`).toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Agenda</h1>

      <div className="my-4 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => shift(-1)}>
          ←
        </Button>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-auto"
        />
        <Button variant="secondary" onClick={() => shift(1)}>
          →
        </Button>
        <Button variant="secondary" onClick={() => setDate(iso(new Date()))}>
          Hoy
        </Button>
        {members.length > 1 && (
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Todos los profesionales</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
        )}
        <Button variant="secondary" onClick={load}>
          Actualizar
        </Button>
      </div>

      <p className="mb-3 text-sm capitalize text-gray-600">{dayLabel}</p>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
        {bookings.map((b) => (
          <li key={b.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {time(b.startsAt)} – {time(b.endsAt)}
                  <span className="font-normal text-gray-600">
                    {" "}
                    · {b.services.map((s) => s.name).join(" + ")}
                  </span>
                </p>
                <p className="mt-0.5 text-sm text-gray-600">
                  {b.customer.name} · {b.customer.email}
                  {b.customer.phone && ` · ${b.customer.phone}`}
                </p>
                {members.length > 1 && (
                  <p className="mt-0.5 text-xs text-gray-500">
                    Con {b.member.displayName}
                  </p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${BADGE[b.status]}`}
              >
                {LABELS[b.status]}
              </span>
            </div>

            {(b.status === "CONFIRMED" || b.status === "PENDING") && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  className="px-3 py-1"
                  onClick={() => setStatus(b.id, "COMPLETED")}
                >
                  Completada
                </Button>
                <Button
                  variant="secondary"
                  className="px-3 py-1"
                  onClick={() => setStatus(b.id, "NO_SHOW")}
                >
                  No se presentó
                </Button>
                <Button
                  variant="danger"
                  className="px-3 py-1"
                  onClick={() => setStatus(b.id, "CANCELLED")}
                >
                  Cancelar
                </Button>
              </div>
            )}
          </li>
        ))}
        {bookings.length === 0 && (
          <li className="p-6 text-center text-sm text-gray-500">
            Sin reservas este día.
          </li>
        )}
      </ul>
    </div>
  );
}
