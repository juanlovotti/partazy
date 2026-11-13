# u25: Crear y editar (en curso). Hecho: Crear por pasos en React

- **Hecho (12/11): Crear por pasos** (`src/react/pantallas/CrearPasos.tsx`, lógica en `src/react/crear/`), detrás del interruptor `crear`, apagado en partazy.com.
  - Diseño nuevo elegido por Juan en Superdesign (variante B, "conversacional"), no paridad. Proyecto "Partazy | Crear evento y tarjetas"; ids en `.superdesign/resume.json`.
  - 7 pasos: tipo, nombre y foto, cuándo, dónde, entrada, lugares y detalles, revisar y publicar (con la casilla de las normas).
  - Pantalla propia `#pantalla-crear-pasos`; `ir('crear')` la abre si está prendida y ya cargó. **Editar sigue en el formulario de siempre.**
  - Publica con `publicarConDatos()` de la app vieja (las mismas reglas que el formulario de siempre). Ver decisiones del 12/11.
- **Validación:**
  - `tests/test_crear_react.js`: 44 comprobaciones con la app completa (ver `docs/PRUEBAS.md`).
  - `src/react/crear/borrador.test.ts` (16) y `src/react/pantallas/CrearPasos.test.tsx` (5) en Vitest.
  - Todas las pruebas de siempre pasan con la lógica de publicar separada (`test_crear_pasos`, `test_pago_p2p`, `test_editar`, `test_editpriv`, `test_tipos`, `test_privada`...).
  - Chromium real a 390 y 1280 px: capturas de los 7 pasos, publicación de punta a punta, 0 errores de JavaScript y 0 problemas de axe-core (WCAG 2.1 AA + buenas prácticas) en cada paso.
  - Revisión de paridad de la lógica de publicar (agente vanillajs-parity-reviewer): 1 alta y 2 medias arregladas, 2 diferencias aceptadas (ver decisiones).
- **Falta:**
  - Que Juan lo pruebe en el link de prueba con `?react=crear` y dé el OK para prenderlo en partazy.com (`PUBLICADAS`).
  - Editar en React (hoy usa el formulario de siempre), y después borrar el formulario de siempre de Crear.
  - Confirmar el nombre "Seminario" para "Charla / Seminario".
- **Volver atrás:** interruptor apagado (es el estado actual en producción). La lógica de publicar separada sí está en la app de siempre; si algo fallara, se vuelve con el historial de Hosting.
- **Para probar a mano** (no se puede desde acá): el mapa grande (Leaflet) y las sugerencias de lugares con internet real, la foto con el filtro real, Safari de iPhone, y Google Translate en EN/PT con la pantalla en React (se espera que falle; ver u11).
