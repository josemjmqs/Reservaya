'use client';

import { use, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button, Card } from '@/components/ui';
import { formatTotal } from '@/lib/format';
import type { BookingStatus, ManagedBooking } from '@/lib/types';

const LABELS: Record<BookingStatus, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No se presentó',
};

const BADGE: Record<BookingStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700 ring-amber-200',
  CONFIRMED: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  COMPLETED: 'bg-green-50 text-green-700 ring-green-200',
  CANCELLED: 'bg-gray-100 text-gray-600 ring-gray-200',
  NO_SHOW: 'bg-red-50 text-red-700 ring-red-200',
};

export default function ManageBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [booking, setBooking] = useState<ManagedBooking | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // hora de carga de la página: la regla de pureza no permite Date.now() en el render
  const [now] = useState(() => Date.now());

  useEffect(() => {
    api<ManagedBooking>(`/public/bookings/${token}`)
      .then(setBooking)
      .catch(() => setNotFound(true));
  }, [token]);

  async function cancel() {
    if (!confirm('¿Seguro que quieres cancelar esta reserva?')) return;
    setError('');
    setLoading(true);
    try {
      await api(`/public/bookings/${token}/cancel`, { method: 'POST' });
      setBooking((b) => (b ? { ...b, status: 'CANCELLED' } : b));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }

  if (notFound)
    return (
      <main className="mx-auto max-w-md px-6 py-12">
        <Card className="p-6 text-center">
          <p className="font-medium">Reserva no encontrada</p>
          <p className="mt-1 text-sm text-gray-600">
            Revisa que el enlace esté completo.
          </p>
        </Card>
      </main>
    );
  if (!booking) return <p className="p-6 text-gray-600">Cargando...</p>;

  const tz = booking.business.timezone;
  const day = new Date(booking.startsAt).toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: tz,
  });
  const time = new Date(booking.startsAt).toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  });
  const canCancel =
    (booking.status === 'CONFIRMED' || booking.status === 'PENDING') &&
    new Date(booking.startsAt).getTime() > now;

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <p className="text-sm font-medium text-indigo-600">
        {booking.business.name}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        Tu reserva
      </h1>

      <Card className="mt-5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium">{booking.service.name}</p>
            <p className="text-sm text-gray-600">
              {formatTotal(booking.service.durationMin)}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${BADGE[booking.status]}`}
          >
            {LABELS[booking.status]}
          </span>
        </div>

        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="capitalize">{day}</p>
          <p className="text-2xl font-semibold tracking-tight">{time}</p>
        </div>

        {booking.business.phone && (
          <p className="mt-4 text-sm text-gray-600">
            Contacto: {booking.business.phone}
          </p>
        )}
      </Card>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {canCancel && (
        <Button
          variant="danger"
          onClick={cancel}
          disabled={loading}
          className="mt-4 w-full"
        >
          {loading ? 'Cancelando...' : 'Cancelar reserva'}
        </Button>
      )}
    </main>
  );
}