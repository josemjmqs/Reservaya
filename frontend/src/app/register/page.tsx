"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    businessName: "",
    slug: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/auth/register", {
        method: "POST",
        body: JSON.stringify(form),
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  const fields: [keyof typeof form, string, string][] = [
    ["name", "Tu nombre", "text"],
    ["email", "Correo", "email"],
    ["password", "Contraseña (mínimo 8 caracteres)", "password"],
    ["businessName", "Nombre del negocio", "text"],
    ["slug", "Link de tu negocio (ej: taller-perez)", "text"],
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Crea tu negocio</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {fields.map(([field, placeholder, type]) => (
          <div key={field} className="flex flex-col gap-1">
            <input
              type={type}
              placeholder={placeholder}
              value={form[field]}
              onChange={(e) =>
                set(
                  field,
                  // The slug only accepts lowercase letters, digits and hyphens.
                  field === "slug"
                    ? e.target.value.toLowerCase().replace(/\s/g, "-")
                    : e.target.value,
                )
              }
              // Mobile keyboards capitalize the first letter by default.
              autoCapitalize={field === "slug" ? "none" : undefined}
              autoCorrect={field === "slug" ? "off" : undefined}
              spellCheck={field === "slug" ? false : undefined}
              aria-describedby={
                field === "slug" ? "slug-hint slug-link slug-rules" : undefined
              }
              className="rounded border p-2"
              required
            />
            {field === "slug" && (
              <>
                <p id="slug-hint" className="text-xs text-gray-500">
                  Así queda el link de tu negocio:
                </p>
                <p
                  id="slug-link"
                  className="break-all rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700"
                >
                  reservahoy.cl/{form.slug || "tu-negocio"}
                </p>
                <p id="slug-rules" className="text-xs text-gray-500">
                  Solo minúsculas, números y guiones.
                </p>
              </>
            )}
          </div>
        ))}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          disabled={loading}
          className="rounded bg-black p-2 text-white disabled:opacity-50"
        >
          {loading ? "Creando..." : "Crear cuenta"}
        </button>
        <p className="text-xs text-gray-500">
          Al crear tu cuenta aceptas los{" "}
          <Link href="/terminos" className="underline">
            términos
          </Link>{" "}
          y la{" "}
          <Link href="/privacidad" className="underline">
            política de privacidad
          </Link>
          .
        </p>
      </form>
      <p className="text-sm">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="underline">
          Inicia sesión
        </Link>
      </p>
    </main>
  );
}
