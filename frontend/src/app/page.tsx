import Link from 'next/link';
import { Button } from '@/components/ui';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6">
      <p className="text-sm font-medium text-indigo-600">Reservaya</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight text-gray-900">
        Reservas online para tu negocio
      </h1>
      <p className="mt-4 text-lg text-gray-600">
        Tus clientes eligen servicio, día y hora desde un enlace, sin crear
        cuenta. Tú ves tu agenda al instante y se acabaron los cruces de
        horario.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/register">
          <Button>Crear mi negocio</Button>
        </Link>
        <Link href="/taller-demo">
          <Button variant="secondary">Ver demo</Button>
        </Link>
        <Link href="/login">
          <Button variant="secondary">Iniciar sesión</Button>
        </Link>
      </div>
    </main>
  );
}