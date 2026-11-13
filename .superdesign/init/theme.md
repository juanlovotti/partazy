# Theme — Partazy

## Resumen de tokens (usar esto primero)
- Stack: Vite 8 + JavaScript sin framework (app.js) con pantallas React 19 detrás de interruptores. CSS propio en `src/app.css` (sin Tailwind activo).
- Fondo de la app: `--negro #02070A` (Midnight Black). Fondo detrás del teléfono: `--fondo #010305`.
- Superficies: `--negro-2 #0A1116` (campos, tarjetas), `--negro-3 #121B22`, `--negro-4 #1A252D`. Líneas: `--gris-linea #1F2C35`.
- Texto: `--blanco #FFFFFF` y `--hueso #EDF1F4` (crema, texto claro), `--gris #8E9BA5` (secundario).
- Principal: `--rojo #FC734D` (Cantaloupe Orange; el nombre "rojo" es histórico). Hover/fuerte `#D9583A`, oscuro `#3A1A12`, durazno `#FFA98C`.
- Secundario: `--azul` / `--verde` `#0297DE` (Electric Blue: verificado, "sí", insignias).
- Estados: `--ok #3FB950`, `--amarillo #E8B411`, `--peligro #FF4D4D` (solo errores/cancelado).
- Tipografías: `--font-display` Barlow Condensed (títulos en MAYÚSCULAS, 700-800), `--font-body` Inter (texto), `--font-mono` JetBrains Mono (etiquetas chicas en mayúsculas con letter-spacing), Unbounded 800 solo en el logo.
- Radios: tarjetas `--radius-card 18px`, campos 12px, botones y chips `--radius-pill 999px`, celdas de tipo 14px.
- Sombras: `--sombra 0 6px 20px rgba(0,0,0,.38), 0 1px 2px rgba(0,0,0,.3)`; `--sombra-alta 0 14px 34px rgba(0,0,0,.5), 0 2px 6px rgba(0,0,0,.35)`. Botón principal con brillo naranja `0 6px 18px rgba(252,115,77,.28)`.
- Movimiento: `--ease cubic-bezier(.2,.7,.2,1)`, `--t-rapida .18s`. Respeta prefers-reduced-motion.
- Foco: `:focus-visible` contorno 2px naranja, offset 2px.
- Tamaños mínimos: botones y chips 44px de alto; letra mínima 12px.
- Breakpoints: celular hasta 599px (contenedor `.phone` max 420px); 600, 900 (barra lateral de 256px en compu) y 1400.

## Fuente cruda
### :root (src/app.css)
```css
  :root{
    /* Color principal (naranja). Las variables conservan el nombre "rojo" para no romper estilos existentes */
    --rojo:#FC734D; --rojo-fuerte:#D9583A; --rojo-oscuro:#3A1A12;
    --peligro:#FF4D4D;   /* solo para avisos: cancelado, errores, "no" */
    --negro:#02070A; --negro-2:#0A1116; --negro-3:#121B22; --negro-4:#1A252D;
    --fondo:#010305; --sombra:0 6px 20px rgba(0,0,0,.38), 0 1px 2px rgba(0,0,0,.3); --sombra-alta:0 14px 34px rgba(0,0,0,.5), 0 2px 6px rgba(0,0,0,.35);
    --ease:cubic-bezier(.2,.7,.2,1); --t-rapida:.18s var(--ease);
    --blanco:#FFFFFF; --hueso:#EDF1F4; --gris:#8E9BA5; --gris-linea:#1F2C35;
    --verde:#0297DE; --amarillo:#E8B411; --azul:#0297DE; --ok:#3FB950;   /* --verde quedó como nombre histórico: ahora es el azul de la marca */
    --radius-card:18px; --radius-pill:999px;
    --font-display:'Barlow Condensed', 'Arial Narrow', sans-serif;
    --font-body:'Inter', sans-serif;
    --font-mono:'JetBrains Mono', monospace;
  }

```
### Fuentes (index.html)
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#02070A">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Unbounded:wght@700;800&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
```
