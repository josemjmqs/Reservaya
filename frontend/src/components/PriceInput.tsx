"use client";

import { useLayoutEffect, useRef } from "react";
import { Input } from "@/components/ui";

// Hasta $999.999.999: cabe holgado en el Int del backend
const MAX_DIGITS = 9;

// "15000" -> "$15.000"; vacío queda vacío
export function formatCLPInput(digits: string): string {
  return digits === "" ? "" : `$${Number(digits).toLocaleString("es-CL")}`;
}

// Posición en el texto formateado justo después del dígito número `count`
function caretAfterDigits(formatted: string, count: number): number {
  if (count === 0) return formatted.startsWith("$") ? 1 : 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]) && ++seen === count) return i + 1;
  }
  return formatted.length;
}

// Input de precio en pesos chilenos: muestra "$15.000" mientras se escribe,
// pero `value` y `onChange` trabajan solo con dígitos ("15000")
export function PriceInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (digits: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  // cuántos dígitos quedan antes del cursor tras el cambio
  const pendingCaret = useRef<number | null>(null);
  const formatted = formatCLPInput(value);

  useLayoutEffect(() => {
    const input = ref.current;
    if (pendingCaret.current === null || !input || document.activeElement !== input) return;
    const pos = caretAfterDigits(formatted, pendingCaret.current);
    input.setSelectionRange(pos, pos);
    pendingCaret.current = null;
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const caret = e.target.selectionStart ?? raw.length;
    let before = raw.slice(0, caret).replace(/\D/g, "");
    const after = raw.slice(caret).replace(/\D/g, "");
    // Si se borró solo un punto o el "$", borrar el dígito que estaba antes
    if (before + after === value && raw.length < formatted.length && before !== "") {
      before = before.slice(0, -1);
    }
    const joined = before + after;
    const digits = joined.replace(/^0+(?=\d)/, "");
    if (digits.length > MAX_DIGITS) {
      // se ignora lo que exceda el máximo
      pendingCaret.current = value.length;
      onChange(value);
      return;
    }
    const removedZeros = joined.length - digits.length;
    pendingCaret.current = Math.max(0, before.length - removedZeros);
    onChange(digits);
  }

  return (
    <Input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="$0"
      value={formatted}
      onChange={handleChange}
    />
  );
}
