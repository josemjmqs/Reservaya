'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button, Card, Input } from '@/components/ui';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Card className="p-6">
        <h1 className="text-xl font-semibold tracking-tight">
          Recuperar contraseña
        </h1>
        {sent ? (
          <p className="mt-3 text-sm text-gray-600">
            Si el correo está registrado, te enviamos un enlace para elegir una
            contraseña nueva. Revisa también la carpeta de spam. El enlace vale
            1 hora.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
            <p className="text-sm text-gray-600">
              Escribe el correo de tu cuenta y te enviaremos un enlace.
            </p>
            <Input
              type="email"
              placeholder="Correo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar enlace'}
            </Button>
          </form>
        )}
        <Link
          href="/login"
          className="mt-4 inline-block text-sm text-indigo-600 hover:underline"
        >
          ← Volver a iniciar sesión
        </Link>
      </Card>
    </main>
  );
}