# u01: Vite arma el sitio en dist/

- **Qué cambió:**
  - `public/index.html` pasó a `index.html`, en la raíz.
  - Se agregaron `vite.config.mjs` y los scripts `dev` y `build`.
  - firebase.json: el sitio `partazy` publica `dist/` y `assets/**` lleva caché de un año. `partazy-5555d` quedó igual.
  - El generador de páginas y `tests/cargar-html.js` leen `index.html` desde la raíz.
- **Validación:**
  - `dist/` contiene todo lo de `public/` idéntico, y `dist/index.html` es idéntico a `index.html`.
  - 49 archivos de prueba OK, más `tests/test_vite.js`.
- **Volver atrás:** revertir el commit. Como el sitio vuelve a publicar `public/`, también hay que volver a poner ahí `index.html`.
- **Particularidades:** ninguna.
