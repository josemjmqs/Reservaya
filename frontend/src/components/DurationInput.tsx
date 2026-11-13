"use client";

import { useState } from "react";
import { Input } from "@/components/ui";

const UNITS = [
  { id: "min", label: "min", factor: 1 },
  { id: "h", label: "horas", factor: 60 },
  { id: "d", label: "días", factor: 1440 },
] as const;

type UnitId = (typeof UNITS)[number]["id"];

// La mayor unidad en que el valor es exacto, como lo muestra formatTotal
// (lib/format.ts): 2880 -> días, 120 -> horas, 90 -> min. Vacío parte en min
function unitFor(minutes: string): UnitId {
  const n = Number(minutes);
  if (minutes === "" || !n) return "min";
  if (n % 1440 === 0) return "d";
  if (n >= 60 && n % 60 === 0) return "h";
  return "min";
}

// Duración en minutos, días u horas (números enteros). `value` y `onChange`
// siempre trabajan en minutos ("" = vacío), así el formulario no cambia
export function DurationInput({
  value,
  onChange,
  minMinutes,
  maxMinutes,
}: {
  value: string;
  onChange: (minutes: string) => void;
  minMinutes: number;
  maxMinutes: number;
}) {
  const [unitId, setUnitId] = useState<UnitId>(() => unitFor(value));
  const unit = UNITS.find((u) => u.id === unitId)!;
  const amount = value === "" ? "" : String(Number(value) / unit.factor);

  const toMinutes = (raw: string, factor: number) =>
    raw === "" ? "" : String(Number(raw) * factor);

  return (
    <div className="flex gap-2">
      <Input
        type="number"
        step={1}
        min={Math.ceil(minMinutes / unit.factor)}
        max={Math.floor(maxMinutes / unit.factor)}
        value={amount}
        onChange={(e) => onChange(toMinutes(e.target.value, unit.factor))}
        className="min-w-0 flex-1"
      />
      <select
        aria-label="Unidad"
        value={unitId}
        // se mantiene el número escrito y cambia lo que significa: 2 min -> 2 horas
        onChange={(e) => {
          const next = UNITS.find((u) => u.id === e.target.value)!;
          setUnitId(next.id);
          onChange(toMinutes(amount, next.factor));
        }}
        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
      >
        {UNITS.map((u) => (
          <option key={u.id} value={u.id}>
            {u.label}
          </option>
        ))}
      </select>
    </div>
  );
}
