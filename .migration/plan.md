# Plan de migración: Partazy, de JavaScript puro a React

Estado: **aprobado el 11/11/2026** (Juan delegó: "hacé lo que creas que no va a arruinar la funcionalidad"). Avance en `state.json` y `units/`.

## 1. Resumen
- **Qué es:** Partazy (partazy.com) es una app web de una sola página, para descubrir y organizar eventos en Córdoba. Usa Firebase (Auth, Firestore, App Check y Hosting) en el plan Spark.
- **Tamaño:**

  | Archivo | Tamaño |
  |---|---|
  | `public/index.html` | 1.191 líneas, 21 pantallas y 11 hojas o ventanas |
  | `public/js/app.js` | 8.671 líneas, ~520 funciones, unas 50 secciones |
  | `public/css/app.css` | 1.727 líneas |
  | Pruebas | 47 archivos jsdom |
  | Páginas públicas | 6, generadas por `herramientas/generar-paginas.js` |

- **Tipo de código:** scripts clásicos que comparten variables globales (`flavor: script-tag`). La página arma su propio HTML y muestra u oculta pantallas con `ir()`.
- **Estrategia:** **rebanada vertical**. React se hace cargo de una pantalla por vez, dentro de la app actual y detrás de un interruptor por pantalla. Para la capa de datos se usa **rama por abstracción**: `DataService` se cambia por dentro, sin cambiar su interfaz.
  - Por qué: la app está en vivo, todo vive en una sola dirección (`/` con rutas `#/...`) y cada pantalla ya es un contenedor propio.
  - El detalle está en `decisions.md`.

## 2. Lo más importante del inventario
(Detalle en `assessment.md`.)
- **Datos:**
  - Todo Firestore pasa por `DataService` (líneas 67 a 800, 102 métodos públicos).
  - Excepciones: 2 `FieldValue.delete()` en `guardarEdicion`. Además, DataService lee `state` en 2 lugares, y Nominatim se llama con `fetch` directo en 7 lugares.
  - Auth se usa unas 28 veces fuera de DataService.
  - App Check usa ReCaptchaEnterpriseProvider.
  - Copia local con `enablePersistence({ synchronizeTabs: true })`.
- **Cableado oculto:**
  - 176 `onclick` (más 2 `onchange` y 1 `onsubmit`) en index.html, que llaman a unas 70 funciones globales, y 44 `onclick` en plantillas de app.js.
  - El portero del modo sin cuenta, el menú ☰ y `hacerAccesibles` dependen de que existan esos atributos.
  - Delegación de clics por atributos `data-*`.
  - Listeners de página (`hashchange`, `popstate`, `scroll`, `resize`).
  - Un `setInterval` que mueve los chips solos cada 4,5 s.
- **Estado repartido:**
  - El objeto global `state` (uid, perfil, eventos, ubicación, filtros, amistades, chats, suscripciones, etc.) y `NAV` (pila de navegación).
  - Clases CSS usadas como estado (`.activa`, `.show`, `.modo-invitado`, `.compacta`, `.con-scroll`).
  - `localStorage` (`partazy_*`) y valores de formularios leídos al tocar "Publicar" o "Guardar".
- **HTML armado con texto:** se usa `innerHTML` 165 veces, y lo que escribe la gente se escapa a mano con `esc()` (282 usos).
- **Librerías diferidas** (desde CDN): Leaflet, qrcodejs, html5-qrcode, jsPDF, TensorFlow.js + nsfwjs y Google Translate.
- **Pruebas:**
  - Varias abren **más de una ventana a la vez** (un usuario por ventana, por ejemplo organizador y comprador) contra la misma base falsa en memoria (`tests/fakefb.js`, que imita el SDK compat).
  - Llaman unas 57 funciones globales, leen `state`, `NAV`, `DataService` y otras con `w.eval`, y reemplazan funciones (`w.confirmar = …`) en 8 archivos.
  - `test_paginas.js` exige que el generador produzca las 6 páginas **byte por byte iguales**. Lee `.texto-legal` de index.html y `const AYUDA` de app.js.
- **Lo central:**
  - `ir()` + `NAV` + `state.tok`: además de cambiar de pantalla, `ir()` cierra el chat, frena el escáner, resetea Crear, cancela la edición del perfil y limpia la dirección.
  - `renderDetalle`: 274 líneas, depende de unas 10 secciones.
  - `publicarEventoUnaVez`: lee unos 25 campos y 7 interruptores desde el HTML.
- **Efectos sin cierre:** 7 suscripciones sociales que nunca se cierran (al cerrar sesión se recarga la página), 4 `setInterval` permanentes y un `ResizeObserver`. En React tienen que tener su cierre, si no se duplican.
- **Bug encontrado:** `init()` busca `.loader .spinner`, que ya no existe (el cargador ahora es el logo).
  - Si Firebase no carga o falla el arranque, salta un error **antes** de mostrar "Error de conexión" y el botón Reintentar, y la persona queda trabada en la pantalla de carga.
  - Está en `app.js` en las líneas 8546, 8552 y 8645.

## 3. Stack de destino

| Pieza | Elección |
|---|---|
| Empaquetador | Vite 8 |
| Interfaz | React 19 + TypeScript 7 |
| Estilos | Tailwind 4 con la paleta en `@theme`. **Sin preflight** mientras conviva con `app.css`, para no cambiar el aspecto de las pantallas viejas. `app.css` sigue cargando hasta el final. |
| Datos | SDK modular de Firebase 13 (Firestore, Auth, App Check), a través de `DataService` y de hooks de suscripción con cierre (`useEffect`). Sin TanStack Query al principio: casi todo son suscripciones en vivo. |
| Estado compartido | Un store chico sin librerías (`subscribe` / `getSnapshot` / `set`), leído desde React con `useSyncExternalStore`. Hace de puente con la app vieja mientras convivan. |
| Rutas | Durante la convivencia, las sigue manejando la app vieja. Al final, router por hash: React Router 8 en modo hash o uno propio chico, se decide con un registro de decisión. |
| Formularios | React controlado, sin librería. Crear evento se evalúa en su unidad. |
| Pruebas | El paquete de prueba (IIFE) mantiene vivas las 47 pruebas jsdom. Las pantallas nuevas usan Vitest 5 + Testing Library 16, más Playwright 1.65 para los recorridos clave contra el link de prueba. |
| Librerías externas | Se cargan solo cuando hacen falta, como hoy, con import dinámico o CDN. Ninguna entra en la primera descarga. |
| Idiomas | **Se decide en la fase 2.** Google Translate cambia el texto de la página por debajo y suele hacer fallar a React. Opciones: textos traducidos propios, o aislar el widget. |

## 4. Cómo conviven la app vieja y la nueva
- **Pantallas:** cada pantalla sigue siendo `<div class="screen" id="pantalla-X">`. La app vieja la sigue mostrando y ocultando con `ir()`. Cuando el interruptor de X está prendido, React monta un root **una sola vez** dentro de ese contenedor, y desde ese momento ningún código viejo toca lo de adentro.
- **Interruptores por pantalla:** se activan con `?react=x,y` en la dirección (para probar), con `localStorage` o con una lista en la config que se publica. En partazy.com se prenden recién con el OK de Juan. Volver atrás es apagarlos.
- **Sesión y datos:**
  - Hay una sola inicialización de Firebase (módulo compartido) y una sola sesión.
  - Lo que comparten las dos versiones (usuario, perfil, modo invitado, eventos en vivo, ubicación y rango, amistades y planes) vive en el store puente. El código viejo avisa cada cambio con `store.set(...)`.
  - React avisa a la app vieja con funciones explícitas del puente (`navegar('detalle', {id})`, `pedirCuenta(motivo)`) o con `CustomEvent`.
- **Estilos:** las dos versiones cargan `app.css`. Las clases de la tarjeta, la hoja, el chip y el botón se mantienen en los componentes React hasta que el sistema de diseño de Tailwind los reemplace sin cambio visible.
- **Lo temporal:** el puente `window.*` de la fase 1, el store puente, los interruptores y los `CustomEvent`. Se borran en la última unidad.

## 5. Mapa de rutas

| Dirección | Hoy | React (al final) |
|---|---|---|
| `/` | Arranque: bienvenida, o Inicio sin cuenta / con sesión | Ruta `/` → Inicio |
| `#/crear` | `abrirRuta()` → `ir('crear')` | `/crear` (hash) |
| `#/evento/{id}` | `abrirDetalle(id)` | `/evento/:id` (hash) |
| `#/u/{uid}` (es el uid, no el @usuario; `uidDeUsuario` existe pero no se usa) | `abrirUsuario(uid)` | `/u/:uid` (hash). Aceptar también @usuario queda como pregunta |
| `?mode=resetPassword\|verifyEmail\|recoverEmail&oobCode=…` | Pantalla propia de acciones del mail | Igual, resuelto antes del router |
| Pantallas sin dirección propia (Inicio, Explorar, Perfil, Chats…) | `ir(nombre)` + `history.pushState` en la misma URL (el botón atrás vuelve a la anterior) | Igual, por paridad. Darles dirección propia queda como pregunta abierta |
| `/privacidad`, `/terminos`, `/soporte`, `/eliminar-cuenta`, `/organizadores`, `/lanzamiento` | Páginas estáticas generadas | Sin cambios (estáticas) |
| `/__/auth/*`, `/__/firebase/init.json` | Reservadas de Firebase Hosting | Sin cambios. La redirección de `partazy-5555d` no las puede agarrar |

## 6. Unidades
Tamaños: S (≤1 sesión), M (1 a 2 sesiones), L (2 a 3), XL (3 a 5). Una sesión son unas 2 a 4 horas de trabajo mío, más tu revisión.

### Fase 1: preparar, sin cambios visibles (puede ir ya)

| id | Qué | Depende de | Tamaño |
|---|---|---|---|
| u01-vite-base | Vite arma el sitio en `dist/`. firebase.json: el sitio `partazy` publica `dist/`, los archivos con hash llevan caché larga y la redirección de `partazy-5555d` queda igual. Las páginas generadas, imágenes, `sw.js` y manifest siguen en `public/`, y el generador y `cargar-html.js` se adaptan. app.js y Firebase compat por CDN quedan como hoy. | (ninguna) | M |
| u02-modulos | app.js partido en módulos ES por sección, con las utilidades puras como módulo propio. Puente `window.*` para las ~70 funciones del HTML, las de las plantillas y las ~57 de las pruebas, más `state`, `NAV` y `DataService`. La config pasa a variables `VITE_*`, también en `organizadores.js`. Paquete de prueba IIFE para las 47 pruebas. | u01 | L |
| u03-firebase-modular | DataService, Auth (~28 usos), App Check, la caché local (`persistentLocalCache` + `persistentMultipleTabManager`) y los 2 `FieldValue.delete()` pasan al SDK modular 13, desde npm. Se van los 4 scripts compat del CDN, que hoy no tienen verificación de integridad. Un simulador del SDK modular reemplaza a `fakefb.js`. | u02 | L |
| u04-peso-y-carga-diferida | Medición de la primera descarga desde Hosting. Si supera la de hoy (≈221 KB gzip), Crear, Chats, Moderación, Puerta y Organizaciones pasan a cargarse al entrar. | u03 | M |
| u05-pruebas-de-reglas | Pruebas de firestore.rules con el emulador: pagos, entradas, previas privadas y amistades primero. Necesita Java y descargar el emulador (ver riesgos). | u01 | M |

### Fase 2: cimientos de React, sin cambios visibles

| id | Qué | Depende de | Tamaño |
|---|---|---|---|
| u06-react-base | React + TS + Tailwind 4 (paleta en `@theme` y tipografías, sin preflight). `montarPantalla(id, Componente)` con los interruptores por pantalla, más una pantalla vacía de prueba. | u03 | M |
| u07-puente-estado | Store puente sobre `state` y `NAV` (sesión, perfil, invitado, eventos, ubicación, amistades y planes). Las escrituras viejas siguen andando y React se entera. Funciones para que React navegue a través de la app vieja. | u06 | M |
| u08-datos-y-tipos | Tipos TS de los documentos, módulo `api/` sobre DataService, hooks de suscripción con cierre y un servicio de geocodificación (los 7 `fetch` a Nominatim). | u07 | M |
| u09-sistema-de-diseno | Tokens y componentes base con el aspecto actual (Botón, Chip, Tarjeta, Hoja, Ventana, Interruptor, Campo, Avatar) y guía en HTML (Mobile Design System). | u06 | M |
| u10-primitivas-ui | Aviso (toast), cargador, `confirmar`, `pedirTexto` y `pedirClave`, hoja genérica y "elegir amigos", hechos en React pero con la misma API que hoy llama el código viejo. | u09, u07 | M |
| u11-decision-idiomas | Registro de decisión: Google Translate cambia el texto por debajo y hace fallar a React. Opciones con costo y riesgo. | u06 | S |

### Fase 3: pantallas, de las hojas hacia el centro
Cada una: variantes en Superdesign (si es pantalla) → elegís → se programa → pruebas → revisión de paridad → revisión de código → interruptor prendido en el link de prueba → tu OK → prendido en partazy.com.

| id | Qué | Depende de | Tamaño |
|---|---|---|---|
| u12-ayuda-legales-contacto | Ayuda, Privacidad, Términos, Normas y el formulario de contacto. Los textos pasan a una fuente compartida, y el generador y `test_paginas` siguen dando las páginas idénticas. | u08, u10 | M |
| u13-guia-y-tutorial | Guía de colores y tutorial de 5 pasos. | u10 | S |
| u14-instalar-idioma-avisos | Instalar la app, avisos del celular, `sw.js` y el idioma, según la decisión de u11. | u11 | M |
| u15-verificacion-org | Pantalla de verificación de organizaciones. | u08, u10 | S |
| u16-puerta | Control de puerta con escáner (html5-qrcode dentro de un componente que lo frena al salir). | u08, u10 | S |
| u17-moderacion | Panel de moderación, denuncias, bloqueos y cuenta suspendida. | u08, u10 | M |
| u18-notificaciones | Avisos internos y contadores. | u08, u07 | S |
| u19-ubicacion-y-rango | Elegir ciudad y distancia, y la línea de ubicación. | u08, u07 | M |
| u20-mapas | Mapa para elegir el lugar y mapa de Explorar (Leaflet diferido). | u19 | M |
| u21-tarjetas-y-portadas | Tarjetas de evento, portadas prediseñadas, ambiente, banda e inclinación. Las usan Inicio, Explorar y Detalle. | u09, u07 | M |
| u22-entradas-y-pagos | Entrada con QR, pago con comprobante, pasar la entrada, "Mis entradas" y chat del grupo. | u21, u10 | L |
| u23-perfil-propio | Perfil, editar, foto, @usuario, gustos, organización, menú ☰ y eliminar cuenta. | u21, u10 | L |
| u24-social | Amigos, perfil de otra persona, chats y mensajes directos. | u23 | L |
| u25-crear-y-editar | Crear en 3 pasos, editar, filtro de fotos, mapa de elección, vista previa y confirmación. | u20, u21 | XL |
| u26-inicio-y-explorar | Inicio y Explorar: filas, Para vos, red de amigos, buscador, chips y personas. | u19, u20, u21, u24 | L |
| u27-detalle | Detalle con calificaciones, equipos, solicitudes, prensa, exportar, cancelar, "ya compré" y el botón principal con todos sus estados. | u16, u22, u24, u25 | XL |
| u28-cuentas-y-arranque | Bienvenida, registro, links de los mails, modo sin cuenta (hoja "Sumate" y portero) y arranque. | u26, u27 | L |

### Fase 4: armazón y cambio

| id | Qué | Depende de | Tamaño |
|---|---|---|---|
| u29-armazon | React toma la raíz: `ir`/`volver`/`NAV`, botón atrás, rutas `#/...`, delegador de clics, barra de abajo y lateral. Se sacan los `onclick` y el portero, y las pruebas pasan a la API nueva. | todas | XL |
| u30-cambio-final | Se borran el código viejo, los puentes y los interruptores, y se depura `app.css`. Queda escrito cómo volver atrás desde el historial de Hosting. | u29 | M |

**Estimación (rango honesto):**

| Fase | Sesiones |
|---|---|
| Fase 1 | 6 a 9 |
| Fase 2 | 6 a 8 |
| Fase 3 | 30 a 40 (17 unidades; incluye las variantes y tu elección por pantalla) |
| Fase 4 | 5 a 8 |
| **Total** | **≈47 a 65** |

A unas 3 sesiones por semana, son entre 4 y 5 meses. La fase 1 puede ir ahora. Las fases 2 a 4, después del lanzamiento.

## 7. Plan de pruebas
- **Red de seguridad:** las 47 pruebas jsdom se corren en cada unidad.
  - Desde u02, contra el paquete de prueba IIFE: cada ventana jsdom carga el paquete, y `firebase/*` se reemplaza por el simulador.
  - No se borra ninguna. Si una tiene que cambiar, se explica en la ficha de la unidad.
- **Por pantalla (fase 3):**
  - Antes de migrarla, pruebas de caracterización sobre la versión vieja para lo que hoy no está cubierto (estados vacío, cargando, error, sin cuenta y organización).
  - Después, las mismas situaciones con Vitest + Testing Library sobre el componente.
  - Las pruebas jsdom de esa pantalla se pasan escenario por escenario.
- **Recorridos de punta a punta (Playwright, contra el link de prueba):**
  - encontrar un plan sin cuenta;
  - crear la cuenta y anotarse;
  - pagar con comprobante y que el organizador confirme;
  - pasar la entrada;
  - publicar un evento;
  - equipos.
- **Reglas:** u05 suma pruebas con el emulador antes de que cualquier unidad necesite cambiar una regla.
- **Peso y lecturas:** en cada fase se miden los bytes de la primera visita (desde Hosting y totales) y las lecturas de Firestore por apertura. No pueden subir sin una decisión anotada.

## 8. Riesgos y particularidades
| Riesgo | Cómo se maneja |
|---|---|
| 222 `onclick` dependen de funciones globales | Puente `window.*` generado a partir de lo que usan el HTML, las plantillas y las pruebas (u02). Se borra en u30. |
| Pruebas con varias ventanas y una base compartida | Paquete de prueba IIFE + simulador del SDK modular, sin pasarlas todas de golpe a Vitest. |
| Al empaquetar Firebase, sus ~158 KB pasan de jsdelivr (no cuenta en el cupo) a Hosting (sí cuenta) | Medición en u03 y u04, carga diferida por pantalla y caché larga para los archivos con hash. |
| Google Translate rompe React | Decisión en u11, antes de la primera pantalla. |
| El preflight de Tailwind cambiaría el aspecto de las pantallas viejas | Sin preflight mientras convivan. |
| El generador de páginas lee los textos de index.html | En u12, los textos pasan a una fuente compartida, con comparación de las páginas antes y después. |
| El DOM usado como estado (por ejemplo, `form-perfil.style.display === 'flex'` en `ir()`) | Se lista en cada unidad y se pasa a estado explícito. |
| Suscripciones `onSnapshot` duplicadas o sin cerrar (más lecturas) | Hooks con cierre. En desarrollo, el modo estricto de React duplica efectos: medir las lecturas en el build de producción. |
| Navegación y botón atrás con pila propia y `pushState` en los paneles | El armazón va al final (u29). Hasta ahí React navega por el puente. |
| La copia local de Firestore pasa de compat a modular | El formato en el celu es el mismo motor. Igual se prueba que el arranque rápido con datos guardados siga andando. |
| App Check (ReCaptchaEnterprise), `authDomain` partazy.com y la redirección `/__/` | Se prueban en el link de prueba en u03. `tests/test_redireccion_hosting.js` sigue vigilando la redirección. |
| No hay pruebas de reglas | u05. Ninguna regla cambia sin pruebas y sin el OK de Juan. En la nube hay Java, pero en octubre la descarga del emulador quedó bloqueada. Si sigue igual, se corre en la compu de Juan o al menos se valida la sintaxis antes de publicar. |
| Las ventanas compartidas (`confirmar`, `pedirTexto`, `elegirAmigos`) reasignan sus botones: si se abren dos a la vez, la primera no responde nunca | En u10 se mantiene igual por paridad y queda anotado. Si lo querés arreglar, es una decisión aparte. |
| Las pruebas reemplazan funciones globales (`w.confirmar = …`) y leen variables con `w.eval` | El puente `window.*` de u02 tiene que dejar escribir esas funciones, no solo leerlas, y las internas tienen que llamarlas a través de él. |
| El código suelto de app.js engancha listeners e intervalos apenas carga, suponiendo que el HTML ya existe | En u02 se mantiene el orden de carga. En React cada uno pasa a un efecto con cierre. |

**Particularidades que se mantienen por paridad** (no se arreglan de paso):
- El bug del cargador (`.loader .spinner`). Se puede arreglar aparte, antes de la migración, si Juan quiere.
- `#/u/` usa el uid, no el @usuario.
- `partazy_vista_{evento}` suma una entrada en `localStorage` por cada evento visto y nunca se borra.
- Los chips de filtro se mueven solos cada 4,5 s.
- Las fechas de las tarjetas usan "·" ("Hoy · 23:30"). Está pendiente por separado, fuera de la migración.
- En el CSS, la variable del naranja se llama `--rojo` y la del azul `--verde`.
- Con "Hoy" marcado y nada hoy, la primera fila muestra la semana con una nota.
- Cada evento aparece una sola vez en Inicio.

## 9. Volver atrás
- **Fase 1:** cada unidad es un commit propio, que Juan sube.
  - Si algo falla en el link de prueba, no se publica.
  - Si falla en partazy.com, se vuelve a la publicación anterior desde el historial de Hosting (un clic) y se revierte el commit.
- **Fases 2 y 3:** el interruptor de cada pantalla. El código viejo de una pantalla se borra recién cuando su versión React está prendida en partazy.com y pasó una semana sin problemas.
- **Fase 4:** antes de u30 queda marcada la última publicación con todo el código viejo, para poder volver a ella.

## 10. Preguntas abiertas para Juan
1. ¿Aprobás la estrategia de **pantallas una por una con interruptor**, en vez de una app React aparte que reemplaza a la vieja al final?
2. ¿Aprobás pasar el **armazón** (encabezado, barra de abajo, navegación, rutas) **al final**, en vez de hacerlo en la fase 2?
3. **UX Agent Skill no está instalado.** ¿Lo instalás, o seguimos sin esas auditorías y las reemplazo por pruebas Playwright de los recorridos + `design:accessibility-review`?
4. **Plugin de Firebase:** hoy apunta a otra carpeta de tu compu. ¿Lo apunto a Documentos\partazy? Lo uso solo para leer reglas y datos del proyecto y para la documentación.
5. **Bug del cargador:** si falla la conexión al abrir, la app queda trabada en la pantalla de carga en vez de mostrar "Reintentar". ¿Lo arreglo ahora, aparte de la migración? Son 3 líneas.
6. Más adelante, no hace falta decidir ahora: ¿las pantallas sin dirección propia (Perfil, Chats, Explorar) deberían tener una? ¿Y el link de perfil debería mostrar el @usuario en vez del código interno?
