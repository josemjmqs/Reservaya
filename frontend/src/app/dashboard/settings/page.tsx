"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, Field, Input } from "@/components/ui";
import { api } from "@/lib/api";
import type { BusinessInfo, Settings } from "@/lib/types";

// Nombre y teléfono del negocio: los ven los clientes en la página pública,
// en su reserva y en los correos
function BusinessSection() {
  const [form, setForm] = useState<{ name: string; phone: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<BusinessInfo>("/business")
      .then((b) => setForm({ name: b.name, phone: b.phone ?? "" }))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Error inesperado"),
      );
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const b = await api<BusinessInfo>("/business", {
        method: "PATCH",
        body: JSON.stringify({ name: form.name, phone: form.phone }),
      });
      setForm({ name: b.name, phone: b.phone ?? "" });
      setSaved(true);
      window.dispatchEvent(new Event("business-updated"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <h2 className="mb-2 mt-6 text-sm font-medium text-gray-900">
        Datos del negocio
      </h2>
      <form
        onSubmit={save}
        className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      >
        {form ? (
          <>
            <Field label="Nombre del negocio">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                minLength={2}
                maxLength={80}
              />
            </Field>
            <Field
              label="Teléfono"
              hint="Lo ven tus clientes en tu página, en su reserva y en los correos. Déjalo vacío para no mostrarlo."
            >
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+56 9 1234 5678"
                maxLength={20}
              />
            </Field>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </Button>
              {saved && (
                <span role="status" className="text-sm text-green-700">
                  Guardado.
                </span>
              )}
            </div>
          </>
        ) : (
          !error && <p className="text-sm text-gray-500">Cargando...</p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Settings>("/settings")
      .then(setSettings)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Error inesperado"),
      );
  }, []);

  async function toggleNewBookingEmail() {
    if (!settings) return;
    setSaving(true);
    setError("");
    try {
      setSettings(
        await api<Settings>("/settings", {
          method: "PATCH",
          body: JSON.stringify({ newBookingEmail: !settings.newBookingEmail }),
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Ajustes</h1>

      <BusinessSection />

      <h2 className="mb-2 mt-6 text-sm font-medium text-gray-900">
        Notificaciones
      </h2>
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        {settings ? (
          <div className="flex items-start justify-between gap-4">
            <div>
              <p id="new-booking-email" className="font-medium">
                Correo cuando entra una reserva
              </p>
              <p className="mt-0.5 text-sm text-gray-600">
                Te escribimos a <strong>{settings.email}</strong> cada vez que
                un cliente reserva desde tu página, con el servicio, la hora y
                sus datos de contacto.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.newBookingEmail}
              aria-labelledby="new-booking-email"
              disabled={saving}
              onClick={toggleNewBookingEmail}
              className={`relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
                settings.newBookingEmail ? "bg-indigo-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
                  settings.newBookingEmail ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        ) : (
          !error && <p className="text-sm text-gray-500">Cargando...</p>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
