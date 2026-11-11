# u02: app.js como módulo ES empaquetado + puente global

- **Qué cambió:**
  - `public/js/app.js` pasó a `src/app.js` y `public/css/app.css` a `src/app.css`. Vite los empaqueta minificados y con hash.
  - `herramientas/vite-puente-global.mjs` publica en `window` las 625 declaraciones de primer nivel (con get/set).
  - Las pruebas cargan `tests/.paquete/app.js` (IIFE en modo estricto, armado con el mismo puente).
  - Targets de navegador: desde iOS 14. Se conserva `-webkit-backdrop-filter`.
- **Validación:**
  - 50 archivos de prueba OK.
  - Capturas de 10 pantallas, versión clásica contra empaquetada, en Chromium con la misma base falsa: 0 píxeles distintos y 0 errores de JS.
  - No hay choques de nombres con `window` (revisado en Chromium y jsdom).
- **Peso:** primera visita desde Hosting ≈221 → ≈175 KB gzip.
- **Volver atrás:** revertir el commit.
- **Particularidades:** el código ahora corre en modo estricto. La suite completa pasa así.
