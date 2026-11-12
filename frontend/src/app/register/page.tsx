"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button, Card, Input } from "@/components/ui";

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
    ["slug", "Link de tu negocio", "text"],
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-10">
      <Card className="p-6">
        <h1 className="text-xl font-semibold tracking-tight">
          Crea tu negocio
        </h1>
        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
          {fields.map(([field, placeholder, type]) => (
            <div key={field} className="flex flex-col gap-1">
              <Input
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
                  field === "slug" ? "slug-rules slug-link" : undefined
                }
                required
              />
              {field === "slug" && (
                <>
                  <p id="slug-rules" className="text-xs text-gray-500">
                    Solo minúsculas, números y guiones.
                  </p>
                  {/* The owner's link, live; a sample one while the field is empty */}
                  <p
                    id="slug-link"
                    className="break-all rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700"
                  >
                    reservahoy.cl/{form.slug || "tu-negocio"}
                  </p>
                </>
              )}
            </div>
          ))}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button disabled={loading}>
            {loading ? "Creando..." : "Crear cuenta"}
          </Button>
          <p className="text-xs text-gray-500">
            Al crear tu cuenta aceptas los{" "}
            <Link href="/terminos" className="text-indigo-600 hover:underline">
              términos
            </Link>{" "}
            y la{" "}
            <Link href="/privacidad" className="text-indigo-600 hover:underline">
              política de privacidad
            </Link>
            .
          </p>
        </form>
        <p className="mt-4 text-sm text-gray-600">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-indigo-600 hover:underline">
            Inicia sesión
          </Link>
        </p>
      </Card>
    </main>
  );
}
