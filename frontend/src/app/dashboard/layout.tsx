"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui";

interface Me {
  name: string;
  email: string;
  emailVerifiedAt: string | null;
  members: { business: { name: string; slug: string } }[];
}

const TABS = [
  { href: "/dashboard/agenda", label: "Agenda" },
  { href: "/dashboard/services", label: "Servicios" },
  { href: '/dashboard/team', label: 'Equipo' },
  { href: "/dashboard/hours", label: "Horario" },
  { href: "/dashboard/blocks", label: "Bloqueos" },
  { href: "/dashboard/settings", label: "Ajustes" },
];

function VerifyEmailBanner({ email }: { email: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function resend() {
    setStatus("sending");
    setError("");
    try {
      const r = await api<{ alreadyVerified: boolean }>(
        "/auth/resend-verification",
        { method: "POST" },
      );
      if (r.alreadyVerified) window.location.reload();
      else setStatus("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setStatus("idle");
    }
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-6 py-3 text-sm text-amber-900">
        <p>
          Confirma tu correo (<strong>{email}</strong>) para que tu página
          pública empiece a recibir reservas.
        </p>
        {status === "sent" ? (
          <span className="font-medium">Te enviamos un correo nuevo</span>
        ) : (
          <button
            type="button"
            onClick={resend}
            disabled={status === "sending"}
            className="font-medium underline hover:no-underline disabled:opacity-50"
          >
            {status === "sending" ? "Enviando..." : "Reenviar correo"}
          </button>
        )}
        {error && <p className="w-full text-red-700">{error}</p>}
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    const loadMe = () =>
      api<Me>("/auth/me")
        .then(setMe)
        .catch(() => router.replace("/login"));
    loadMe();
    // Ajustes avisa cuando cambia el nombre del negocio, para el encabezado
    window.addEventListener("business-updated", loadMe);
    return () => window.removeEventListener("business-updated", loadMe);
  }, [router]);

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
  }

  if (!me) return <p className="p-6 text-gray-600">Cargando...</p>;

  const business = me.members[0]?.business;

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <div>
            <p className="font-semibold tracking-tight">{business?.name}</p>
            <Link
              href={`/${business?.slug}`}
              target="_blank"
              className="text-xs text-indigo-600 hover:underline"
            >
              Ver mi página pública ↗
            </Link>
          </div>
          <Button variant="secondary" onClick={logout}>
            Cerrar sesión
          </Button>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-6 overflow-x-auto px-6">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`shrink-0 border-b-2 py-2 text-sm font-medium transition ${
                pathname === t.href
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </header>
      {!me.emailVerifiedAt && <VerifyEmailBanner email={me.email} />}
      <div className="mx-auto max-w-3xl px-6 py-6">{children}</div>
    </div>
  );
}
