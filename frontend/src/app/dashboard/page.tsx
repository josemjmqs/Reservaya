'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface Me {
  name: string;
  email: string;
  members: { role: string; business: { name: string; slug: string } }[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/login');
      return;
    }
    api<Me>('/auth/me', {}, token)
      .then(setMe)
      .catch(() => {
        localStorage.removeItem('token');
        router.replace('/login');
      });
  }, [router]);

  if (!me) return <p className="p-6">Cargando...</p>;

  const business = me.members[0]?.business;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold">Hola, {me.name}</h1>
      <p className="text-gray-600">Negocio: {business?.name}</p>
      <button
        onClick={() => {
          localStorage.removeItem('token');
          router.push('/login');
        }}
        className="mt-4 rounded border px-3 py-1 text-sm"
      >
        Cerrar sesión
      </button>
    </main>
  );
}