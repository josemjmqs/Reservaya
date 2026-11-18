"use client";

// TEMPORAL (no se mergea): imita el panel en el celular para probar en Chrome
// Android cómo fijar la barra de abajo sin que quede cortada. Muestra las
// medidas reales de la pantalla y cambia de variante con ?v=a|b|c|d

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const VARIANTS = {
  a: "Como está hoy: la página se desplaza y la barra es fija abajo",
  b: "Como el PR #91: solo se desplaza el contenido (h-dvh)",
  c: "Como hoy + viewport-fit=cover y relleno del borde del teléfono",
  d: "Contenedor fijo arriba con el alto visible medido (visualViewport)",
} as const;
type Variant = keyof typeof VARIANTS;

const NAV_H = 56;

type Metrics = Record<string, number | string>;

function measure(nav: HTMLElement | null): Metrics {
  const probe = (css: string) => {
    const el = document.createElement("div");
    el.style.cssText = `position:absolute;visibility:hidden;top:0;left:0;width:1px;${css}`;
    document.body.appendChild(el);
    const h = el.offsetHeight;
    el.remove();
    return h;
  };
  const vv = window.visualViewport;
  const navBottom = nav ? Math.round(nav.getBoundingClientRect().bottom) : 0;
  const visible = vv ? Math.round(vv.height) : window.innerHeight;
  return {
    "barra cortada (px)": navBottom - visible,
    "abajo de la barra": navBottom,
    "visualViewport.height": visible,
    innerHeight: window.innerHeight,
    "html.clientHeight": document.documentElement.clientHeight,
    "html.scrollHeight": document.documentElement.scrollHeight,
    scrollY: Math.round(window.scrollY),
    "100vh": probe("height:100vh"),
    "100dvh": probe("height:100dvh"),
    "100svh": probe("height:100svh"),
    "100lvh": probe("height:100lvh"),
    "safe-area abajo": probe("height:0;padding-bottom:env(safe-area-inset-bottom)"),
    "screen.height": window.screen.height,
    dpr: window.devicePixelRatio,
  };
}

function Content({ variant }: { variant: Variant }) {
  return (
    <>
      <header className="border-b border-gray-200 bg-white px-4 py-3">
        <p className="font-semibold">Prueba de la barra de abajo</p>
        <p className="text-xs text-gray-600">
          Variante {variant.toUpperCase()}: {VARIANTS[variant]}
        </p>
        <div className="mt-2 flex gap-2">
          {(Object.keys(VARIANTS) as Variant[]).map((v) => (
            <a
              key={v}
              // Recarga completa: cada variante parte de cero (viewport, estilos)
              href={`/prueba-celular?v=${v}`}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                v === variant
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-gray-300 bg-white"
              }`}
            >
              {v.toUpperCase()}
            </a>
          ))}
        </div>
      </header>
      <main className="px-4 pt-4 pb-6">
        <p className="mb-3 text-sm text-gray-700">
          Desplázate hacia abajo y luego un poco hacia arriba. La barra está
          completa si se ve la línea roja de abajo y &quot;barra cortada&quot;
          es 0 o menos.
        </p>
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {Array.from({ length: 40 }, (_, i) => (
            <li key={i} className="p-4 text-sm">
              Fila {i + 1}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-gray-500">Fin del contenido</p>
      </main>
    </>
  );
}

function Nav({
  navRef,
  className,
  style,
}: {
  navRef: (el: HTMLElement | null) => void;
  className: string;
  style?: React.CSSProperties;
}) {
  return (
    <nav
      ref={navRef}
      className={`z-20 border-t border-gray-200 bg-white ${className}`}
      style={style}
    >
      <div
        className="grid grid-cols-4 text-center text-[11px] font-medium text-gray-600"
        style={{ height: NAV_H - 4 }}
      >
        {["Agenda", "Horario", "Bloqueos", "Ajustes"].map((t) => (
          <span key={t} className="flex items-center justify-center">
            {t}
          </span>
        ))}
      </div>
      {/* Si esta línea se ve, la barra está completa */}
      <div className="h-1 bg-red-600" />
    </nav>
  );
}

function Test() {
  const raw = useSearchParams().get("v");
  const variant: Variant = raw && raw in VARIANTS ? (raw as Variant) : "a";
  const [nav, setNav] = useState<HTMLElement | null>(null);
  const [metrics, setMetrics] = useState<Metrics>({});
  const [visibleH, setVisibleH] = useState<number | null>(null);
  const [open, setOpen] = useState(true);

  // c: el contenido llega hasta el borde del teléfono (el panel no lo tiene)
  useEffect(() => {
    if (variant !== "c") return;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (meta) meta.content = "width=device-width, initial-scale=1, viewport-fit=cover";
  }, [variant]);

  // d: la página misma no se desplaza (Chrome deja quieta su barra de
  // direcciones) y el contenedor mide lo visible
  useEffect(() => {
    if (variant !== "d") return;
    const root = document.documentElement;
    root.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      root.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, [variant]);

  useEffect(() => {
    const update = () => {
      setMetrics(measure(nav));
      setVisibleH(window.visualViewport?.height ?? window.innerHeight);
    };
    const id = requestAnimationFrame(update);
    const tick = setInterval(update, 500);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(id);
      clearInterval(tick);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [nav]);

  const panel = (
    <div className="fixed right-1 top-1 z-50 max-w-[60%] rounded bg-black/80 p-2 font-mono text-[10px] leading-tight text-white">
      <button className="mb-1 underline" onClick={() => setOpen(!open)}>
        {open ? "ocultar medidas" : "medidas"}
      </button>
      {open &&
        Object.entries(metrics).map(([k, v]) => (
          <div key={k}>
            {k}: <b>{v}</b>
          </div>
        ))}
    </div>
  );

  if (variant === "b") {
    return (
      <div className="h-dvh overflow-hidden">
        <div className="overflow-y-auto" style={{ height: `calc(100% - ${NAV_H}px)` }}>
          <Content variant={variant} />
        </div>
        <Nav navRef={setNav} className="fixed inset-x-0 bottom-0" />
        {panel}
      </div>
    );
  }

  if (variant === "d") {
    return (
      <div
        className="fixed inset-x-0 top-0 flex flex-col"
        style={{ height: visibleH ?? "100svh" }}
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Content variant={variant} />
        </div>
        <Nav navRef={setNav} className="shrink-0" />
        {panel}
      </div>
    );
  }

  // a y c
  return (
    <div>
      <div style={{ paddingBottom: NAV_H }}>
        <Content variant={variant} />
      </div>
      <Nav
        navRef={setNav}
        className="fixed inset-x-0 bottom-0"
        style={variant === "c" ? { paddingBottom: "env(safe-area-inset-bottom)" } : undefined}
      />
      {panel}
    </div>
  );
}

export default function PruebaCelularPage() {
  return (
    <Suspense fallback={null}>
      <Test />
    </Suspense>
  );
}
