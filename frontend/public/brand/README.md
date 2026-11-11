# Logo de Reservahoy

Versión actual (no definitiva): una "h" minúscula formada por un check, en blanco, dentro de un cuadrado redondeado índigo. Es el mismo ícono en el logo, la app y el favicon.

- Colores: índigo `#4F39F6` (el `indigo-600` de Tailwind que usa el panel), texto `#101828` (`gray-900`) y, en fondo oscuro, "hoy" en `#8B7CFF`.
- Fuente del texto: Geist Bold. En los SVG el texto ya está convertido a trazos.

## Archivos
- `reservahoy-simbolo.svg` / `reservahoy-simbolo-1024.png`: solo el símbolo.
- `reservahoy-logo.svg` / `reservahoy-logo-1600.png`: símbolo + "reservahoy" para fondos claros.
- `reservahoy-logo-fondo-oscuro.svg` / `reservahoy-logo-fondo-oscuro-1600.png`: para fondos oscuros.
- `reservahoy-icono-app.svg`: el ícono de la app.
- `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`: para el manifest de la app instalable (`claude/plan-notificaciones.md`). La versión maskable deja márgenes para que Android la recorte en círculo.

El favicon (`favicon.ico`, `icon.svg`) y el ícono de iPhone (`apple-icon.png`) viven en `src/app/`, donde Next.js los detecta solo.

## `alternativa-calendario/`
La opción anterior, con el símbolo en forma de calendario y la misma "h" con check adentro. Tiene los mismos nombres de archivo, incluidos `favicon.ico`, `icon.svg` y `apple-icon.png`, para probarla reemplazando los archivos.
