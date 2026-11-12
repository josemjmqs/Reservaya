"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button, Card, Input } from "@/components/ui";

function ResetNotice() {
  const reset = useSearchParams().get("reset");
  if (reset !== "1") return null;
  return (
    <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">
      Contraseña actualizada, ya puedes entrar.
    </p>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-10">
      <Card className="p-6">
        <h1 className="text-xl font-semibold tracking-tight">
          Iniciar sesión
        </h1>
        <Suspense fallback={null}>
          <ResetNotice />
        </Suspense>
        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
          <Input
            type="email"
            placeholder="Correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
          <Link
            href="/forgot-password"
            className="text-sm text-indigo-600 hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </form>
        <p className="mt-4 text-sm text-gray-600">
          ¿No tienes cuenta?{" "}
          <Link href="/register" className="text-indigo-600 hover:underline">
            Regístrate
          </Link>
        </p>
      </Card>
    </main>
  );
}
