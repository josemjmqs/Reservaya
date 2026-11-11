// Símbolo de Reservahoy: una "h" minúscula formada por un check, en blanco,
// dentro de un cuadrado redondeado índigo (archivos fuente en public/brand/)
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <rect width="100" height="100" rx="24" fill="#4F39F6" />
      <g
        transform="translate(-14.8 -20.88) scale(1.35)"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="10"
        strokeLinejoin="round"
      >
        <path d="M27 60 L40 73 L53 32" strokeLinecap="round" />
        <path
          d="M46.4 53 C49.5 46.5 54.5 43 60.5 43 C67.5 43 71 48 69.2 56"
          strokeLinecap="butt"
        />
        <path d="M69.2 56 L65 73" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="text-[22px] font-bold tracking-tight text-gray-900">
        reserva<span className="text-indigo-600">hoy</span>
      </span>
    </span>
  );
}
