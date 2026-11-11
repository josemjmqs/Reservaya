'use client';

import { useSyncExternalStore } from 'react';

// El número se arma en el navegador para que no quede escrito en el HTML:
// así no lo encuentran los bots simples que recorren páginas buscando teléfonos
const PARTS = ['0597', '7460', '9', '56'];
const MESSAGE = 'Hola José, quiero saber más de Reservahoy';

const subscribe = () => () => {};

function useIsClient() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

function phone() {
  const [country, mobile, a, b] = [...PARTS].reverse();
  return {
    digits: `${country}${mobile}${a}${b}`,
    display: `+${country} ${mobile} ${a} ${b}`,
  };
}

export function WhatsAppLink({
  className,
  children,
  withMessage = false,
}: {
  className?: string;
  children: React.ReactNode;
  withMessage?: boolean;
}) {
  const isClient = useIsClient();
  if (!isClient) {
    return <span className={className}>{children}</span>;
  }
  const { digits } = phone();
  const text = withMessage ? `?text=${encodeURIComponent(MESSAGE)}` : '';
  return (
    <a
      href={`https://wa.me/${digits}${text}`}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}

export function WhatsAppNumber({ className }: { className?: string }) {
  const isClient = useIsClient();
  return isClient ? <span className={className}>{phone().display}</span> : null;
}
