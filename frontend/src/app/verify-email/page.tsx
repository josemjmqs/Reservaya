'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card } from '@/components/ui';

function VerifyResult() {
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<'loading' | 'ok' | 'error'>(
    token ? 'loading' : 'error',
  );
  const [error, setError] = useState('El enlace no es válido.');
  const sent = useRef(false);

  useEffect(() => {
    // evita el doble envío del modo estricto de React en desarrollo
    if (!token || sent.current) return;
    sent.current = true;
    api('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then(() => setState('ok'))
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Error inesperado');
        setState('error');
      });
  }, [token]);

  if (state === 'loading')
    return <p className="mt-3 text-sm text-gray-600">Confirmando...</p>;

  if (state === 'ok')
    return (
      <>
        <p className="mt-3 text-sm text-gray-600">
          Listo, tu correo quedó confirmado y tu página pública ya recibe
          reservas.
        </p>
        <Link
          href="/dashboard/agenda"
          className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline"
        >
          Ir a mi panel →
        </Link>
      </>
    );

  return (
    <p className="mt-3 text-sm text-gray-600">
      {error} Puedes pedir uno nuevo desde{' '}
      <Link href="/dashboard/agenda" className="text-indigo-600 underline">
        tu panel
      </Link>
      .
    </p>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Card className="p-6">
        <h1 className="text-xl font-semibold tracking-tight">
          Confirmación de correo
        </h1>
        <Suspense fallback={null}>
          <VerifyResult />
        </Suspense>
      </Card>
    </main>
  );
}
