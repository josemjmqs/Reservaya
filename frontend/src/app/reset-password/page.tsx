'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button, Card, Input } from '@/components/ui';

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      router.push('/login?reset=1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <p className="mt-3 text-sm text-gray-600">
        El enlace no es válido.{' '}
        <Link href="/forgot-password" className="text-indigo-600 underline">
          Pide uno nuevo
        </Link>
        .
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
      <Input
        type="password"
        placeholder="Contraseña nueva (mínimo 8 caracteres)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={8}
        required
      />
      <Input
        type="password"
        placeholder="Repite la contraseña"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        minLength={8}
        required
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button disabled={loading}>
        {loading ? 'Guardando...' : 'Cambiar contraseña'}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Card className="p-6">
        <h1 className="text-xl font-semibold tracking-tight">
          Elige una contraseña nueva
        </h1>
        <Suspense fallback={null}>
          <ResetForm />
        </Suspense>
      </Card>
    </main>
  );
}