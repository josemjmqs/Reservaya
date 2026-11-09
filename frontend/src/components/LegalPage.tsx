import Link from 'next/link';

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/" className="text-sm text-indigo-600 hover:underline">
        ← Reservahoy
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-gray-500">Última actualización: {updated}</p>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-gray-700 [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-gray-900 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </main>
  );
}