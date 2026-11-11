# Decisiones de la migración

Registro que solo crece: cada decisión con fecha, por qué y qué se descartó.

## 2026-11-10: Punto de partida
- La migración arranca desde la app tal como quedó el 10/11/2026: pago con comprobante (P2P), pasar la entrada a un amigo y la revisión de diseño del Inicio.
- Ese mismo día, esos cambios todavía no estaban publicados ni en GitHub (28 archivos sin commit en la compu de Juan, y partazy.com con la versión anterior). **No se toca código de la app hasta que Juan publique y haga el commit.** El inventario y el plan se hicieron sobre una copia idéntica en la nube.

## 2026-11-10: Estrategia principal: rebanada vertical (React montado pantalla por pantalla dentro de la app actual)
- **Por qué:**
  - Es una app en vivo (partazy.com), con gente usándola en la etapa de Fundadores, y se siguen agregando funciones mientras tanto.
  - Toda la app vive en una sola dirección (`/`), con rutas `#/...` dentro de la misma página. No hay forma de mandar unas direcciones a una app y otras a otra, que es lo que pide la higuera estranguladora ("strangler fig").
  - Cada pantalla ya es un contenedor propio (`<div class="screen" id="pantalla-...">`) que la app muestra u oculta con `ir()`. Eso permite que React se haga cargo de una pantalla por vez, mientras el resto sigue igual.
- **Cómo se cumple la "versión React en paralelo" que pidió Juan:** cada pantalla migrada tiene un interruptor. Con el interruptor apagado se ve la pantalla vieja; prendido, la de React.
  - Primero se prende solo en el link de prueba, o con `?react=pantalla` en la dirección.
  - En partazy.com se prende recién con el OK de Juan.
  - Volver atrás es apagar el interruptor.
- **Se descartó:**
  - Reescribir todo de una y cambiar al final: es demasiado grande (21 pantallas, ~8.700 líneas) y frena el lanzamiento.
  - Una segunda app en otra ruta (por ejemplo `/nueva`): duplicaría la sesión y los datos guardados en el celu, y los links `#/evento/...` que ya circulan no llegarían a ella.

## 2026-11-10: Estrategia secundaria: rama por abstracción para la capa de datos
- `DataService` (app.js, líneas 67 a 800) es la única puerta a Firestore. En la fase 1 se cambia por dentro, del SDK compat al modular, sin cambiar su interfaz. Las pantallas viejas y las nuevas usan la misma puerta.
- Auth y App Check se inicializan una sola vez, en un módulo compartido por las dos versiones. La sesión es una sola: nadie inicia sesión dos veces.

## 2026-11-10: Pruebas durante la migración
- Las 47 pruebas actuales (jsdom, varias ventanas de distintos usuarios contra una misma base falsa) siguen siendo la red de seguridad durante las fases 1 a 3.
- Para que sigan andando con el código partido en módulos y con el SDK modular, se van a correr contra un **paquete de prueba** que arma Vite en formato IIFE. En ese paquete, `firebase/*` se reemplaza por un simulador del SDK modular (sucesor de `tests/fakefb.js`), y cada ventana jsdom carga el paquete como hoy carga app.js.
- Cada pantalla que pasa a React suma sus pruebas con Vitest + Testing Library. Las pruebas viejas de esa pantalla se pasan escenario por escenario, sin perder cobertura.

## 2026-11-10: El armazón va al final
- El encabezado, la barra de abajo, la navegación (`ir()`, historial y botón atrás), las rutas `#/...` y la sesión son la parte de la que dependen todas las pantallas. Se migran **al final**, no en la fase 2 como decía el prompt.
- En la fase 2 se arman los cimientos que las pantallas React necesitan, sin cambios visibles: la base de React, Tailwind con la paleta, el puente de estado compartido con la app vieja y el acceso a datos.
- **Por qué:** si se rompe el armazón, se rompe todo. Moviéndolo al final, cada pantalla se prueba y se vuelve atrás sola.

## 2026-11-10: Versiones de referencia (npm, 10/11/2026)
| Paquete | Versión |
|---|---|
| react | 19.3.1 |
| vite | 8.3.7 |
| @vitejs/plugin-react | 6.3.0 |
| typescript | 7.0.2 |
| tailwindcss y @tailwindcss/vite | 4.3.5 |
| firebase | 13.2.0 (la app usa 10.12.0 compat) |
| react-router | 8.5.1 |
| vitest | 5.1.0 |
| @testing-library/react | 16.3.3 |
| jsdom | 31.0.0 |
| @firebase/rules-unit-testing | 6.0.0 |
| playwright | 1.65.0 |

Antes de escribir código contra una librería, revisar su documentación instalada (no hay Context7 en esta sesión).

## 2026-11-11: Orden de las unidades, ajustado con el inventario detallado
- El detalle del evento va **tarde**, no temprano. `renderDetalle` depende de calificaciones, puerta, solicitudes, pagos, exportar, cancelar, editar, equipos y red de amigos. Primero se migran esas piezas y las tarjetas.
- Se suma la unidad **u10-primitivas-ui** (avisos, cargador, `confirmar`, `pedirTexto`, hoja genérica y elegir amigos), con la misma API que usa hoy el código viejo, para que sirva a las dos versiones.
- Se suman unidades propias para **ubicación y rango**, **mapas** y **tarjetas y portadas**, porque las comparten varias pantallas.
- Instalar la app, avisos e idioma van como unidad aparte (u14), después de la decisión de idiomas (u11).
- **Se descartó** pasar primero a Firebase compat por npm (como sugirió el inventario): sumaría al cupo de Hosting los ~158 KB del SDK compat sin el beneficio de achicarlo. Firebase compat sigue por CDN hasta u03, y ahí se pasa directo al modular.

## 2026-11-11: Particularidades que se mantienen
- Bug del cargador (`.loader .spinner` inexistente), `#/u/` con uid, `partazy_vista_*` sin límite y las ventanas compartidas que se pisan: se mantienen tal cual en la migración y se anotan. Si se arreglan, va aparte y con el OK de Juan.

## 2026-11-11: Juan aprueba y delega
- Juan publicó y commiteó lo pendiente (commit 3e374d5) y pidió: "arrancá la migración, hacé lo que creas que no va a arruinar la funcionalidad".
- Se toma el plan como aprobado. Las preguntas abiertas se resolvieron así:
  - armazón al final;
  - sin UX Agent Skill (lo reemplazan las pruebas de recorridos y las capturas comparadas);
  - plugin de Firebase sin tocar (no hizo falta);
  - bug del cargador arreglado aparte, antes de la migración.

## 2026-11-11: u02 sin partir app.js en varios archivos
- app.js pasó a ser **un** módulo ES (`src/app.js`), empaquetado por Vite. No se partió por secciones.
  - **Por qué:** partirlo exige importar y exportar entre ~45 secciones con dependencias circulares, y cambia el orden en que corre el código de primer nivel. Es mucho riesgo y no mejora nada visible. Cada sección se mueve a `src/` (con tipos) cuando su pantalla pase a React.
- El puente global se arma solo (plugin de Vite que lee las declaraciones con acorn): 625 nombres con get/set. Así las pruebas que reemplazan funciones (`w.confirmar = …`) siguen funcionando igual.

## 2026-11-11: u03 (SDK modular) postergada
- Medido con 13.2.0:

  | Forma de cargar el SDK | Peso (gzip) |
  |---|---|
  | Modular empaquetado, solo lo que usa la app | ≈216 KB |
  | Compat empaquetado | ≈242 KB |
  | Modular desde gstatic (10.12) | ≈181 KB |
  | Hoy (compat desde jsdelivr) | ≈158 KB |

- Empaquetarlo rompe el criterio de "no subir el peso desde Hosting". Desde el CDN suma peso para cada persona, sin beneficio visible.
- React usa DataService, así que no lo necesita.

## 2026-11-11: u04 cerrada por medición
- La primera visita desde Hosting bajó de ≈221 KB a ≈175 KB (minificado). No hizo falta partir el código.

## 2026-11-11: Interruptores solo fuera de producción
- `?react=` se ignora en partazy.com. Solo funciona en el link de prueba o en local. En producción solo cuenta la lista PUBLICADAS.
- **Por qué:** que nadie le prenda una pantalla a otra persona con un link.

## 2026-11-11: Primera pantalla: Ayuda (de u12), con paridad exacta
- Mismo HTML, clases e ids. Las capturas vieja contra React dan 0 píxeles distintos. El pie legal queda de la app vieja.
- **Diferencia aceptada:** la animación de entrada escalonada de la pantalla (`:nth-child`) ve un solo hijo, porque el contenedor de React usa display:contents.
