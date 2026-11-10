"use client";

import { useState } from "react";
import { publicDuration } from "@/lib/format";
import type { PublicBusiness } from "@/lib/types";

type PublicService = PublicBusiness["services"][number];

const NO_CATEGORY = "Otros";

// Agrupa por categoría respetando el orden en que llegan los servicios
function groupByCategory(services: PublicService[]) {
  const groups = new Map<string, PublicService[]>();
  for (const s of services) {
    const name = s.category ?? NO_CATEGORY;
    groups.set(name, [...(groups.get(name) ?? []), s]);
  }
  return [...groups.entries()];
}

export function ServicePicker({
  services,
  selectedId,
  onSelect,
}: {
  services: PublicService[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const groups = groupByCategory(services);
  // Con una sola categoría (o ninguna) no tiene sentido pedir un clic extra
  const collapsible = groups.length > 1;
  const [open, setOpen] = useState<string | null>(null);

  if (services.length === 0)
    return <p className="text-sm text-gray-600">Sin servicios disponibles.</p>;

  if (!collapsible)
    return (
      <div className="flex flex-col gap-2">
        {services.map((s) => (
          <ServiceButton
            key={s.id}
            service={s}
            selected={selectedId === s.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    );

  return (
    <div className="flex flex-col gap-2">
      {groups.map(([name, items]) => {
        const isOpen = open === name;
        const selected = items.find((s) => s.id === selectedId);
        const panelId = `category-${name.replace(/\W+/g, "-")}`;
        return (
          <div
            key={name}
            className="overflow-hidden rounded-lg border border-gray-200 bg-white"
          >
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpen(isOpen ? null : name)}
              className="flex w-full items-center justify-between gap-3 p-3 text-left transition hover:bg-gray-50"
            >
              <span>
                <span className="font-medium">{name}</span>
                <span className="block text-sm text-gray-600">
                  {selected && !isOpen
                    ? `Elegido: ${selected.name}`
                    : `${items.length} ${items.length === 1 ? "servicio" : "servicios"}`}
                </span>
              </span>
              <svg
                aria-hidden
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            {isOpen && (
              <div
                id={panelId}
                className="flex flex-col gap-2 border-t border-gray-100 bg-gray-50 p-2"
              >
                {items.map((s) => (
                  <ServiceButton
                    key={s.id}
                    service={s}
                    selected={selectedId === s.id}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ServiceButton({
  service: s,
  selected,
  onSelect,
}: {
  service: PublicService;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(s.id)}
      aria-expanded={s.description || s.imageUrl ? selected : undefined}
      className={`rounded-lg border p-3 text-left transition ${
        selected
          ? "border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <span className="font-medium">{s.name}</span>
      <span className="block text-sm text-gray-600">
        {publicDuration(s.durationMin, s.totalMin)}
        {s.price !== null && ` · $${s.price.toLocaleString("es-CL")}`}
      </span>
      {selected && (s.imageUrl || s.description) && (
        <span className="mt-2 flex flex-col gap-2 border-t border-indigo-100 pt-2">
          {s.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- la foto ya viene reducida; no usamos el optimizador de Vercel
            <img
              src={s.imageUrl}
              alt={s.name}
              className="aspect-[4/3] w-full rounded-md object-cover"
            />
          )}
          {s.description && (
            <span className="whitespace-pre-line text-sm text-gray-700">
              {s.description}
            </span>
          )}
        </span>
      )}
    </button>
  );
}
