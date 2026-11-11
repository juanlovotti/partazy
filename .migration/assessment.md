# Inventario de la app actual (10/11/2026)

Medido sobre una copia idéntica a la carpeta de Juan, con los cambios del 10/11 todavía sin commit.

## Tipo de app
- **Sistema de módulos:** scripts clásicos (`flavor: script-tag`).
  - index.html carga 4 scripts compat de Firebase 10.12.0 desde cdn.jsdelivr.net y después `/js/app.js`.
  - Todo comparte el ámbito global: ~520 funciones sueltas, 97 `const`/`let` de primer nivel, el objeto `state` y `NAV`.
- **Modelo de página:** una sola página.
  - index.html trae las 21 pantallas como `<div class="screen" id="pantalla-...">`. `ir(nombre)` pone y saca la clase `.activa`, maneja la pila de navegación y marca la barra de abajo.
  - Cada pantalla se pinta con funciones que arman HTML como texto (32 funciones `...HTML`, 165 `innerHTML`) y lo escapan con `esc()` (282 usos).
- **Páginas aparte:** `/privacidad`, `/terminos`, `/soporte`, `/eliminar-cuenta`, `/organizadores` y `/lanzamiento`. Son HTML estático generado por `herramientas/generar-paginas.js`, que lee los textos de index.html. Usan `paginas.css`, `lanzamiento.js` y `organizadores.js` (este último escribe en `consultas` con App Check).

## Pantallas (21) y ventanas (11)
- **Pantallas:** bienvenida, registro, home, explorar, detalle, ticket, crear, confirmacion, perfil, amigos, usuario, chats, chat, notificaciones, verificacion, puerta, ayuda, privacidad, terminos, moderacion y suspendido.
- **Ventanas y hojas:** modal-mapa, modal-rango, menu-perfil, hoja-cuenta, hoja-vista, modal-referencias, tutorial, modal-bg, modal-acred, modal-denuncia y hoja-amigos.

## Secciones de app.js por tamaño (líneas aprox.)
| Sección | Líneas |
|---|---|
| Amigos, perfiles, chats y compartir | 856 |
| DataService | 739 |
| Crear evento | 736 |
| Cuentas (Google + mail) | 520 |
| Portadas prediseñadas | 508 |
| Detalle | 365 |
| Utilidades | 284 |
| Gustos musicales / Para vos | 282 |
| Navegación | 246 |
| Organizaciones y verificación | 229 |
| Ubicación y rango | 219 |
| Pago con comprobante | 192 |
| Perfil | 185 |
| Editar evento | 176 |
| Inicio | 167 |
| Ticket + chat | 164 |
| Filtro de fotos | 163 |
| Ayuda y privacidad | 162 |
| Mapa para elegir lugar | 144 |
| Notificaciones | 137 |
| Arranque | 133 |
| Calificaciones | 131 |
| Organizaciones (página pública) | 129 |
| Entradas en otra página | 124 |
| Puerta | 112 |
| Modo invitado | 107 |
| Moderación | 105 |
| Acreditaciones | 97 |
| Pasar la entrada | 94 |
| Avisos del celular | 91 |
| Exportar lista | 90 |
| Denuncias | 90 |
| Mapa de eventos | 79 |
| Explorar personas | 79 |
| Solicitudes | 78 |
| Identidad | 77 |
| Red de amigos | 74 |
| Eliminar cuenta | 58 |
| Vista previa | 54 |
| Cancelar / eliminar | 54 |
| Estado | 51 |
| Explorar | 50 |
| Instalar | 37 |
| Idioma | 34 |
| Bloqueos | 31 |
| Enlaces externos | 30 |
| Eventos (line-up, cupo) | 22 |
| Normas | 14 |
| Tarjetas | 7 |

## Dónde vive el estado
- **`state`** (objeto global): uid, perfil, privado, email, eventos, usuarios, userCoords, filtroActivoHome, filtroActivoExplorar, busqueda, tipoEventoActivo, imagenNueva, fotoPerfilNueva, chatUnsub, bloqueados, esAdmin, reportes, msgsVistos, notificaciones, notifResaltadas, verificacion, verifPendientes, sigo, amistades, dms, socialUnsubs, dmActual, dmUnsub, usuarioActual, resultadosPersonas, busquedaPersonas, rutaPendiente, tok y ultimoCreado. También se le agregan claves sueltas en otras secciones: invitado, radioKm, ciudadActual, ubicManual, geoFallo, misCompartidos, editandoId, vistaExplorar, `_feedSucio`, `_tCuenta`…
- **`NAV`:** pila, actual, clave, abrir, volviendo, popTs, modalHist e ignorarPop.
- **Clases CSS como estado:**
  - `.screen.activa` (pantalla visible);
  - `.show` (ventanas y hojas);
  - `body.modo-invitado`;
  - `.topbar.compacta` / `.con-fondo` (encabezado al bajar);
  - `.screen.con-scroll` y `.entrando`;
  - `.chip.activo`;
  - `.nav-item.activo`.
- **`localStorage` / `sessionStorage`** (19 usos): `partazy_` + preferencias (radioKm, ciudad, ubicManual…), `partazy_fundador_*`, `partazy_tutorial_*`, `partazy_vista_*`, `partazy_calif`, `partazy_navMini`, `partazy_limpieza_*` y `partazy_ruta`. Además, la copia local de Firestore en IndexedDB.
- **Formularios:** Crear y Editar, Perfil, Registro, Ingreso, Rango y Chats se leen al apretar el botón.
- **El DOM usado como variable:** por ejemplo, `ir()` mira `form-perfil.style.display === 'flex'` para saber si se estaba editando el perfil. El inventario detallado lista más.

## Cableado oculto
- **`onclick` en línea:** 177 en index.html y 45 en plantillas de app.js, que llaman funciones globales.
- **Delegación de clics** en `document` (3 listeners) por atributos `data-*`: `data-abrir`, `data-usuario`, `data-vista`, `data-pago`, `data-pasar-entrada`, `data-eq-unir`… En modo sin cuenta, otro listener en fase de captura intercepta todo lo que pide cuenta.
- **Listeners de página:**
  - en `document`: `keydown` (4), `visibilitychange` (2), `pointermove` / `pointerout`;
  - en `window`: `resize` (2), `popstate`, `hashchange` y `beforeinstallprompt`;
  - `scroll` en cada `.screen` y en el Inicio (encabezado compacto o con fondo);
  - 1 `ResizeObserver` (la banda del Inicio).
- **Timers:** 5 `setInterval`, entre ellos el que mueve los chips cada 4,5 s, y muchos `setTimeout`.
- **Suscripciones en vivo:** 9 `onSnapshot` (eventos, notificaciones, chats, mensajes directos, red social…), guardadas en `state.*Unsub`.

## Capa de datos
- `DataService` (líneas 67 a 800, 102 métodos públicos y 5 auxiliares) es la puerta a Firestore: tiene adentro las 108 llamadas `db.*`.
- **Excepciones:**
  - 2 `firebase.firestore.FieldValue.delete()` en `guardarEdicion` (8292, 8296).
  - DataService lee `state` en 2 lugares (`limiteEventos`, `vipPendiente`).
  - 7 `fetch` directos a Nominatim.
- Auth se usa ~28 veces fuera (ingreso con Google por ventana o por redirección, mail, verificación, nueva contraseña, cerrar sesión, eliminar cuenta).
- **App Check:** `ReCaptchaEnterpriseProvider`, clave pública en el código.
- **Firestore:** `ignoreUndefinedProperties` y `enablePersistence({ synchronizeTabs: true })`.
- **Colecciones** (28 `match` en firestore.rules, 852 líneas, 2 índices): users/privado, usernames, events (vip, calificaciones, media, reposts, vistas, votos, private, equipos, attendees, comprobantes, acreditaciones), seguidores/fans, friendships, dms/mensajes, chats/messages, notificaciones/items, planes, verificaciones, reports, consultas, bloqueos y admins.
- **Imágenes:** van como data URL dentro de los documentos (no hay Storage).

## Librerías externas (cargadas al usarse)
| Librería | Versión | Para qué |
|---|---|---|
| Leaflet | 1.9.4 | mapa |
| qrcodejs | 1.0.0 | dibujar el QR |
| html5-qrcode | 2.3.8 | escáner de la puerta |
| jsPDF | 2.5.1 | lista en PDF |
| TensorFlow.js + nsfwjs | 4.22 / 4.4 | filtro de fotos |
| Google Translate | (widget) | idioma |

Las tipografías vienen de Google Fonts: Inter, Barlow Condensed, JetBrains Mono y Unbounded.

## Rutas
- **Con dirección:** `#/crear`, `#/evento/{id}` y `#/u/{usuario}` (`abrirRuta`, más `hashchange`), y `?mode=…&oobCode=…` para los links de los mails.
- **El resto de las pantallas** no tiene dirección propia: `ir()` + `history.pushState` en la misma URL, y el botón atrás usa la pila `NAV`.

## Pruebas
- 47 archivos, que corren con `npm test` (`tests/correr-todas.js`).
  - 46 usan jsdom + `tests/cargar-html.js` (mete app.js y app.css dentro de index.html) + `tests/fakefb.js` (simula el SDK compat en memoria, con modo estricto y un enganche de reglas simple).
  - `test_paginas.js` revisa las páginas generadas, y `test_redireccion_hosting.js` revisa firebase.json.
- Varias pruebas abren varias ventanas (un usuario por ventana) contra la misma base: hasta 7 aperturas en `test_ronda_1810.js`, y 5 en `test_pago_p2p.js`.
- **No hay pruebas que ejecuten firestore.rules.**

## Peso de la primera visita (gzip)
- **Desde Firebase Hosting, ≈221 KB:** app.js 153, app.css 32 e index.html 36.
- **Desde jsdelivr, ≈158 KB** (no cuenta en el cupo de Hosting): firestore compat 101, auth 39, app 10 y app-check 8.
- JS y CSS van con `Cache-Control: no-cache`.

## Hallazgos del inventario detallado (agente vanillajs-inventory, 11/11)
- **Funciones globales:** son 524. index.html las llama con 176 `onclick`, 2 `onchange` y 1 `onsubmit` (unas 70 funciones distintas), y las plantillas con 44 `onclick` más. Hay 69 asignaciones `.onclick =` por propiedad, y los modales compartidos reasignan sus botones al abrirse.
- **`state`:** unas 85 claves (34 iniciales y unas 51 agregadas desde otras secciones), usadas en 716 líneas. `state.tok` invalida dibujos viejos que todavía no terminaron (45 usos). En `state` también viven resolvers de promesas (`_resolverPrevia`, `_resolverEquipo`).
- **Lecturas del DOM como variable:**
  - `pantallaActual()` (16 usos) duplica `NAV.actual`.
  - `renderHome` deduplica según el `display` que acaba de escribir.
  - Los interruptores se leen por su clase `.on`, y los chips y opciones por `.activo`.
  - Los campos que aplican se deciden por `closest('.campo').style.display`.
  - Las estrellas usan `dataset.valor`, y el autocompletado del @usuario y del lugar usa `dataset.auto`.
  - El menú ☰ vuelve a disparar `b.onclick`, y el portero del modo sin cuenta usa `matches('[onclick*=…]')`.
- **Suscripciones:**
  - `escucharEventos` se cierra solo al volver a suscribirse.
  - Las 7 sociales (y las de administración) **nunca se cierran**: el cierre de sesión recarga la página.
  - El DM y el chat del grupo se cierran en `ir()`.
- **Timers:** de los `setInterval`, 4 son permanentes (latido cada 150 s, usuarios cada 60 s, chat cada 2 s, chips cada 4,5 s) y 1 se limpia (la cuenta regresiva de la reserva). El `ResizeObserver` nunca se desconecta.
- **Rutas:** `#/u/` lleva el **uid**, no el @usuario (`compartirMiPerfil`, `invitarAmigos`, `abrirUsuario`). `DataService.uidDeUsuario` existe pero no se usa.
- **Service worker:** `registrarSW` usa la ruta relativa `'sw.js'`, y el aviso abre `./#/evento/…`. Funciona con rutas por hash; con rutas por path haría falta cambiarlo.
- **Pruebas:**
  - Llaman unas 57 funciones globales.
  - Usan `w.eval` sobre `state`, `NAV`, `DataService`, `MAPA`, `FiltroFotos`, `fotosGrandes`, `firebaseConfig`, `auth` y otras.
  - Reemplazan funciones globales en 8 archivos (`w.confirmar`, `w.mostrarVistaPrevia`, `DataService.getDireccionExacta`, `miniaturaDe`).
  - Usan esperas fijas de 20 a 1.000 ms.
  - `test_paginas.js` compara byte por byte las 6 páginas generadas y saca `AYUDA` de app.js con una expresión regular.
- **Sin pruebas:** Google Translate, instalar la app, service worker y avisos, la barra lateral, Leaflet real, el escáner, el PDF real, el filtro de fotos, Nominatim, las animaciones y el camino de error del arranque.
- **Inyección de HTML:**
  - No apareció texto de usuario sin escapar.
  - Hay un uso frágil: `esc(ev.id)` dentro del JS de un `onclick` en línea, donde escapar para HTML no alcanza. Hoy está protegido porque las reglas exigen ids `^[A-Za-z0-9_-]{1,64}$`.
  - `TIPOS_NOTIF.texto()` devuelve texto crudo: cualquier uso nuevo tiene que escaparlo.
- **Scripts de CDN:** ninguno tiene `integrity` (SRI).
- **Bugs:**
  - `init()` busca `.loader .spinner`, que ya no existe (líneas 8546, 8552 y 8645). En el camino de error tira `TypeError` antes de mostrar "Error de conexión" y Reintentar, y la persona queda trabada en la pantalla de carga.
  - `partazy_vista_{evento}` crece sin límite en `localStorage`.
  - `pintarMailContacto` se llama varias veces en el arranque.
- **Acoples entre secciones:**
  - CUENTAS ↔ INICIO: `entrarALaApp` llama a `renderHome`.
  - `irAMisEntradas` vive en NAVEGACIÓN.
  - Puerta usa el cargador de scripts del filtro de fotos.
  - Tarjetas, Inicio y Detalle usan constantes definidas en CREAR (7034-7067).
  - Los listeners sociales repintan según `pantallaActual()`.
