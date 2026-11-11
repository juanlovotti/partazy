# u12: Ayuda, legales y contacto (en curso)

- **Hecho: Ayuda + formulario de contacto** en React (`src/react/pantallas/Ayuda.tsx`), detrás del interruptor `ayuda` (apagado en partazy.com).
  - Con el interruptor prendido, `abrirAyuda()` de la app vieja solo avisa y muestra la pantalla (si React ya la montó; si no, sigue la versión vieja).
- **Validación:**
  - `tests/test_react_ayuda.js` cubre los mismos casos que `test_contacto.js` sobre la versión React, más los interruptores.
  - `src/react/pantallas/Ayuda.test.tsx` (Vitest) tiene 4 pruebas.
  - Capturas de la versión vieja contra React, con 4 desplazamientos y la build de producción: 0 píxeles distintos.
  - Hubo revisión de paridad (agente vanillajs-parity-reviewer).
- **Falta:** Privacidad, Términos y Normas, con una fuente de textos compartida con el generador.
- **Volver atrás:** interruptor apagado (es el estado actual en producción).

## Revisión de paridad (agente vanillajs-parity-reviewer, 11/11)
- **high (arreglado):** en tablet y compu se perdía la columna centrada, porque las reglas `.screen > *` no alcanzaban al contenedor display:contents. Se sumó `.screen > [data-react] > *` en app.css (líneas 40, 697 y 729) y `#pantalla-ayuda > [data-react] > *` (769). Las capturas a 390, 768 y 1280 px dan 0 píxeles distintos.
- **medium (arreglados):**
  - Si Ayuda está abierta cuando llega React, el montaje espera a que la persona salga (no se pierde lo escrito).
  - Si React falla al dibujar, vuelve la versión vieja (`onUncaughtError`).
  - Las preguntas arrancan cerradas cada vez que se abre.
  - Al enviar se leen los campos del formulario, por el autocompletado.
- **low (aceptados):**
  - El mail de contacto sale de `MAIL_CONTACTO` (hoy es el mismo valor que estaba fijo en el HTML).
  - La precarga del nombre y las preguntas aparecen también si se llega sin pasar por `abrirAyuda`: es una mejora menor.
- **low (arreglado):** `renderAyuda`, `prepararContacto` y `enviarConsulta` no hacen nada si React ya dibuja la pantalla.
- **Pruebas sumadas:**
  - Volver sin historial lleva a Perfil.
  - Las preguntas arrancan cerradas.
  - En `src/react/arranque.test.tsx`: espera mientras la pantalla está abierta, y vuelta a la versión vieja si React falla.
- **Para probar a mano** (no se puede desde acá): Safari de iPhone, red lenta, autocompletado del celu, y Google Translate en EN/PT con la pantalla en React (se espera que falle; ver u11).
