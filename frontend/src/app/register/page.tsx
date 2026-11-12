"use client";

import { useEffect, useRef, useState } from "react";
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
  const [slugInfoOpen, setSlugInfoOpen] = useState(false);
  const slugInfoButtonRef = useRef<HTMLButtonElement>(null);
  const slugInfoRef = useRef<HTMLParagraphElement>(null);

  // The slug info popover closes with Escape or a tap anywhere but the button
  // or the popover, including the field itself, so it never hides the live link.
  useEffect(() => {
    if (!slugInfoOpen) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (
        !slugInfoButtonRef.current?.contains(target) &&
        !slugInfoRef.current?.contains(target)
      ) {
        setSlugInfoOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSlugInfoOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [slugInfoOpen]);

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
              <div className="relative">
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
                  aria-describedby={field === "slug" ? "slug-link" : undefined}
                  // Room for the info button inside the field.
                  className={field === "slug" ? "pr-10" : undefined}
                  required
                />
                {field === "slug" && (
                  <>
                    <button
                      ref={slugInfoButtonRef}
                      type="button"
                      onClick={() => setSlugInfoOpen((open) => !open)}
                      aria-label="Información sobre el link"
                      aria-expanded={slugInfoOpen}
                      aria-controls="slug-info"
                      className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-gray-400 hover:text-indigo-600 focus:text-indigo-600 focus:outline-none"
                    >
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                        className="h-5 w-5"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                    {slugInfoOpen && (
                      <p
                        ref={slugInfoRef}
                        id="slug-info"
                        role="note"
                        className="absolute inset-x-0 top-full z-10 mt-1 rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-600 shadow-md"
                      >
                        Crea el link de tu negocio, solo minúsculas, números y
                        guiones. Ejemplo:{" "}
                        <span className="whitespace-nowrap font-medium text-gray-800">
                          reservahoy.cl/tu-negocio
                        </span>
                      </p>
                    )}
                  </>
                )}
              </div>
              {field === "slug" && (
                <>
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
            <Link
              href="/privacidad"
              className="text-indigo-600 hover:underline"
            >
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
