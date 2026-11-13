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

## 11/11: revisión de accesibilidad y estrategia de pruebas (cierre de fase 1)
- Se corrieron `design:accessibility-review` (axe-core + teclado + áreas para tocar + contraste) y `engineering:testing-strategy`, que faltaban del cierre de fase 1. Informes: `docs/ACCESIBILIDAD.md` y `docs/PRUEBAS.md`.
- Se arreglaron solo cosas que no cambian el aspecto (0 píxeles distintos en 21 estados): foco en las ventanas (`src/ventanas.js`), áreas para tocar de 44 px y preguntas de Ayuda tocables en toda la tarjeta (`src/app.css`). Prueba: `tests/test_ventanas_foco.js`.
- Quedan propuestos para que Juan elija (cambian algo a la vista): borde de foco en el buscador de Explorar y contraste del sello "Verificado" de /organizadores.
- Las pantallas React de la fase 3 heredan esto: si una ventana pasa a React, tiene que mantener foco adentro, Tab, Escape y vuelta del foco.

## 12/11: u07, puente de estado con Proxy
- `state` y `NAV` se envuelven con un Proxy (`src/estado.js`) en lugar de cambiar cada escritura de la app vieja: las ~60 asignaciones de primer nivel quedan cubiertas sin tocarlas, y solo 5 cambios por dentro necesitan `avisarEstado()`.
- Alternativas descartadas: un store nuevo con `store.set()` en cada escritura (muchos cambios en app.js, fácil olvidarse uno) y revisar `state` cada tanto (gasta batería y llega tarde).
- Los avisos se juntan por microtarea: React nunca ve un estado a medio cambiar (por ejemplo, `uid` nuevo con el `perfil` viejo).
- React navega llamando a las funciones de la app vieja (`navegar.*` en legado.ts) hasta que la navegación pase a React (u29).

## 12/11: Tarjetas nuevas en la app de siempre (adelanto del diseño de u21)
- Juan eligió en Superdesign la variante 1: fecha sobre la foto, hora grande, lugar con pin, "Últimos N lugares" (azul) y "Agotado" (banda roja en la esquina).
- Se cambió en `tarjetaHTML` y `tarjetaHorizontalHTML` de `src/app.js`, no en React: el diseño se cambia donde vive hoy. u21 las pasa a React con este aspecto, sin paridad con el diseño anterior.
- `estadoCupo` ahora dice "Últimos N lugares" (9 o menos), "Último lugar" o "Últimos lugares" (desde el 85 %), y no dice nada con venta externa o sin tope (Partazy no sabe cuántos quedan). La píldora del detalle pasó de amarillo a azul con letra oscura (el amarillo ya significa "Se pone bueno" en el ambiente), y "Agotado" a letra oscura (contraste 3,3 → 6,2).
- La guía de colores dejó los "·" de los títulos ("Verde: hay lugar").

## 12/11: Crear por pasos en React (primera parte de u25)
- **No es paridad:** es el diseño "conversacional" (variante B) que Juan eligió en Superdesign: 7 pasos con un tema por pantalla, "Siguiente" fijo y revisión final con la tarjeta.
- **Pantalla propia** (`#pantalla-crear-pasos`) detrás del interruptor `crear`, y solo para eventos nuevos. Editar sigue en el formulario de siempre hasta que se haga Editar en React: así React no le saca el formulario a la edición. `ir('crear')` abre la de React si el interruptor está prendido y React ya cargó; si no, el de siempre.
- **Una sola lógica para publicar (branch-by-abstraction):** `publicarEventoUnaVez` se partió en `leerFormCrear()` (lee el DOM) y `publicarEventoUnaVez(datos, ui)` (valida, arma y guarda). El formulario de siempre y React (`aDatos()` en `src/react/crear/borrador.ts`) mandan los mismos datos. React revisa cada paso antes de avanzar con los mismos mensajes; la validación final y el guardado son los de siempre.
- **Cambio aceptado en el formulario de siempre:** cuando una validación falla, además del aviso se enfoca el campo y se va al paso donde está (antes solo lo hacían algunos errores).
- **Cosas nuevas del diseño:** casilla "Acepto las normas de la comunidad" antes de publicar; "Otra hora" y botones de horario; aviso de madrugada ("a las 00:30 del sábado es la madrugada de ese día"); mapa chiquito con teselas de OpenStreetMap; "¿Vendés en otra página?" dentro de la entrada paga.
- **No se pasó** el cambio automático a Previa si el nombre dice "previa" (en el Crear por pasos el tipo se elige primero).
- `abrirMapa(opts)` acepta `{ inicio, alConfirmar }` para devolverle el punto a React sin tocar el formulario de siempre.
- En el celu, mientras se completa, se esconde la barra de abajo (`#app.foco-crear`); en la compu queda la barra lateral.
- **Revisión de paridad (agente, 12/11) y lo que se decidió:**
  - *Arreglado (alta):* el "vino de una sugerencia" del lugar vivía en el paso y se perdía al ir y volver; editar el lugar después dejaba el pin viejo. Ahora está en el borrador (`ubicacionDeSugerencia`). Prueba en `test_crear_react.js`.
  - *Arreglado (media):* una respuesta de opciones de otro tipo (ej. "Nivel: Principiante" de Deporte al pasar a Taller) ya no se guarda; los textos libres con la misma clave sí pasan, como en el de siempre.
  - *Arreglado (media):* la tarjeta del paso 7 decía "Agotado" con venta externa sin tope; ahora usa la misma capacidad que se guarda (20.000 y `capacidadDesconocida`).
  - *Diferencia aceptada:* lo que no aplica al tipo elegido (lista VIP en una peña o charla, dress code en un taller o feria) no se guarda desde React. El de siempre lo guardaba si se había cargado antes de cambiar de tipo, aunque el campo estuviera oculto.
  - *Diferencia aceptada:* el formulario de siempre ahora lee todo al tocar "Publicar" (antes leía algunos campos después de buscar el lugar, que puede tardar unos segundos).
  - *Rareza que se mantiene (igual en los dos):* si marcás la casa en el mapa con la previa privada y después la pasás a pública, el pin queda exacto. En React ahora el texto lo avisa ("Al ser pública, todos ven el punto exacto").

## 12/11 (noche): Crear por pasos prendido para todos
- Juan dio el OK: `PUBLICADAS = ['crear']`.
- Para no gastar cupo de Hosting: las pantallas de `CON_CUENTA` (hoy solo `crear`) bajan React recién cuando hay sesión y el navegador está libre. Quien mira sin cuenta no lo baja.
- Con el sitio traducido (`idiomaActual() !== 'es'`) se usa el formulario de siempre: Google Translate cambia el texto por debajo y puede romper React (u11 sigue pendiente).
- `?react=0` ahora apaga todo, también lo publicado y también en partazy.com (salida de emergencia; prender sigue sin poder hacerse por link en partazy.com). Las pruebas del formulario de siempre usan `?react=0`.
- "Charla / Seminario" pasa a llamarse "Seminario" (OK de Juan).

## 13/11: u08 datos y tipos
- `src/geo.js` junta los 6 pedidos a Nominatim. Sin memoria de resultados (hubiera cambiado cuántos pedidos se hacen y lo vigilan las pruebas); se puede sumar después con su prueba.
- La capa `datos.*` solo tiene los métodos que van a usar las próximas pantallas (perfil, entradas, social): se agregan a medida que hagan falta, no todo DataService de una.
- Perfil (u23): diseño elegido por Juan el 12/11 en Superdesign, portada de la variante A con los accesos rápidos de la B.

## 13/11: sin emojis en la app
- Juan pidió sacar los emojis "en todos lados" porque quedan poco profesionales.
- Los íconos que hacían falta (notificaciones, menú del perfil, filas de la hoja del evento, perfil de organización, razón de las recomendaciones) ahora son íconos de línea: `ico(nombre, tamaño)` arriba de `src/app.js` (diccionario `ICONOS`; si el nombre es un tipo de evento usa `ICONOS_TIPO`).
- En títulos, botones, avisos y toasts el emoji se sacó sin reemplazo.
- Quedan los signos tipográficos que no son emojis: ✓ ✗ ✕ ★ ✦ ☰ ›.
- La razón de una tarjeta ya no se marca con el emoji del principio: es un objeto `{ ico, texto }` que pinta `razonHTML()`.
- Las respuestas rápidas del chat quedaron solo con texto. Lo que escribe la gente (bio, mensajes, comentarios) puede seguir teniendo emojis.

## 13/11: menú del perfil A y tutorial B, ya en la app
- Menú ☰ del perfil: variante A (lista con íconos en cuadraditos y flechita). Es solo CSS más `data-tono` en los botones de `index.html`.
- Tutorial: variante B (arriba, la app en chiquito dentro de un marco; barritas de progreso; Saltar a la izquierda; atrás redondo y Siguiente con flecha). Se mezcló con las animaciones de antes: logo que se mueve, buscador que escribe solo, dedo que toca, punto que late, rayas del último paso.
- Los textos del tutorial quedaron en una o dos frases por paso.
- Falta elegir el cartel de "Necesitás una cuenta" (A o B).
