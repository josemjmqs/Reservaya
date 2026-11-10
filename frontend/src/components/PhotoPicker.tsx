"use client";

import { useRef } from "react";

// Vista previa + botones para elegir, cambiar o quitar una foto.
// No es un <label>: tiene varios botones dentro
export function PhotoPicker({
  imageUrl,
  busy = false,
  onPick,
  onRemove,
}: {
  imageUrl: string | null;
  busy?: boolean;
  onPick: (file: File) => void;
  onRemove?: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-700">Foto</span>
      <div className="flex items-center gap-3">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- la foto ya viene reducida; no usamos el optimizador de Vercel
          <img
            src={imageUrl}
            alt="Foto del servicio"
            className="h-20 w-28 shrink-0 rounded-lg border border-gray-200 bg-gray-50 object-contain"
          />
        ) : (
          <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-300 text-xs text-gray-400">
            Sin foto
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            {busy ? "Subiendo..." : imageUrl ? "Cambiar foto" : "Subir foto"}
          </button>
          {imageUrl && onRemove && (
            <button
              type="button"
              disabled={busy}
              onClick={onRemove}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              Quitar
            </button>
          )}
        </div>
      </div>
      <span className="text-xs text-gray-500">
        Opcional. JPG, PNG o WebP; se ajusta de tamaño automáticamente
      </span>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // permite volver a elegir el mismo archivo
          if (file) onPick(file);
        }}
      />
    </div>
  );
}
