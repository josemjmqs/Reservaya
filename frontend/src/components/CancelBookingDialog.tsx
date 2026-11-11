"use client";

import { useEffect, useRef, useState } from "react";
import type { AgendaBooking } from "@/lib/types";
import { Button, Textarea } from "./ui";

// Confirmación antes de que el negocio cancele una reserva: cancelar le avisa
// al cliente por correo y libera la hora, así que no debe pasar con un toque
// accidental. Usa <dialog> nativo (foco atrapado, Esc para cerrar, fondo).
export function CancelBookingDialog({
  booking,
  when,
  onClose,
  onConfirm,
}: {
  booking: AgendaBooking | null;
  when: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (booking && !dialog.open) dialog.showModal();
    if (!booking && dialog.open) dialog.close();
  }, [booking]);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm(reason);
      setReason("");
    } finally {
      setBusy(false);
    }
  }

  function close() {
    if (busy) return;
    setReason("");
    onClose();
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="cancel-title"
      onCancel={(e) => {
        e.preventDefault(); // Esc: se cierra por el mismo camino que "Volver"
        close();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl p-0 shadow-xl backdrop:bg-black/40"
    >
      {booking && (
        <div className="p-5">
          <h2 id="cancel-title" className="text-lg font-semibold">
            ¿Cancelar esta reserva?
          </h2>
          <p className="mt-2 text-sm text-gray-900">
            <strong>{booking.customer.name}</strong> ·{" "}
            {booking.services.map((s) => s.name).join(" + ")}
          </p>
          <p className="text-sm text-gray-600">
            {when.charAt(0).toUpperCase() + when.slice(1)}
          </p>
          <p className="mt-3 text-sm text-gray-600">
            Le enviaremos un correo a <strong>{booking.customer.email}</strong>{" "}
            avisándole que la cancelaste, y la hora quedará libre para otros
            clientes. No se puede deshacer.
          </p>
          <label className="mt-4 block text-sm font-medium text-gray-700">
            Motivo (opcional)
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="Ej.: tuvimos un imprevisto. Se incluye en el correo."
              className="mt-1"
            />
          </label>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={close} disabled={busy}>
              Volver
            </Button>
            <Button
              onClick={confirm}
              disabled={busy}
              className="bg-red-600 hover:bg-red-700"
            >
              {busy ? "Cancelando..." : "Sí, cancelar"}
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}
