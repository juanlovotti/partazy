# Arquitectura de PARTAZY

## Idea general

Es una **app de una sola página** (SPA) sin frameworks: `index.html` tiene todas las pantallas (`<div class="screen" id="pantalla-...">`) y `js/app.js` muestra una u otra con `ir('nombre')`. No hay servidor propio: el navegador habla directo con Firebase, y **las reglas de `firestore.rules` son las que protegen los datos**.

Como el plan es **Spark (gratis)**, no hay Cloud Functions. Todo lo que en otra app haría el servidor (contadores, avisos, limpieza) lo hace el cliente, y las reglas validan que lo haga bien. Por ejemplo: para confirmar asistencia, el cliente crea su asistencia **y** suma +1 al contador en la misma transacción, y la regla exige las dos cosas juntas.

## Mapa de `js/app.js`

El archivo está dividido en secciones con este formato de encabezado:

```
// =========================================================
//  NOMBRE DE LA SECCIÓN
// =========================================================
```

Buscá el nombre para saltar. En orden:

| Sección | Qué hace |
|---|---|
| Config + App Check | Conexión a Firebase, protección anti-bots, sesión persistente |
| **DataService** | Única puerta a Firestore: todas las lecturas y escrituras |
| ESTADO / UTILS | Objeto `state` global, `esc()`, fechas, distancias, imágenes |
| CUENTAS | Login con Google y email, registro y verificación de edad (+18) |
| MODO INVITADO | Mirar sin cuenta; cualquier interacción pide registrarse |
| CALIFICACIONES | Notas de la joda y de quien organiza (organizaciones acumulan promedio) |
| EXPORTAR LISTA | CSV y PDF de anotados para quien organiza |
| ENTRADAS VENDIDAS EN OTRA PÁGINA | "Ya compré, avisar que voy" |
| IDENTIDAD | Foto de perfil, @usuario único, apodo |
| FILTRO DE FOTOS | Modelo de IA en el navegador que frena desnudez |
| NORMAS / DENUNCIAS / BLOQUEOS / MODERACIÓN | Comunidad y panel de administración |
| NOTIFICACIONES | Avisos internos, agrupados por tipo |
| ORGANIZACIONES / VERIFICACIÓN / PUERTA / PRENSA | Funciones para boliches y productoras |
| AMIGOS, PERFILES, CHATS | Solicitudes, mensajes directos, compartir |
| NAVEGACIÓN | `ir()`, historial y botón "atrás" del celular |
| TARJETAS / PORTADAS | Tarjetas de eventos y portadas dibujadas por tipo |
| IDIOMA / INSTALAR / AVISOS | Traducción (Google), PWA, notificaciones del sistema |
| RED DE AMIGOS | A dónde van tus amigos, sugerencias y compartidos |
| HOME / EXPLORAR / DETALLE | Pantallas principales |
| CANCELAR / ELIMINAR / SOLICITUDES / TICKET + CHAT | Ciclo de vida de un evento y su asistencia |
| CREAR EVENTO / VISTA PREVIA / EDITAR EVENTO | Formulario (el mismo sirve para crear y editar) |
| UBICACIÓN Y RANGO / MAPAS | Ubicación del usuario (cualquier ciudad de Argentina), mapas Leaflet + OpenStreetMap |
| PERFIL / INIT | Perfil propio y arranque de la app |

## Base de datos (Firestore)

| Colección | Para qué | Quién lee |
|---|---|---|
| `users/{uid}` | Perfil público (nombre, foto, ciudad, @usuario, contadores de seguidores y calificación) | Logueados |
| `users/{uid}/privado/datos` | Fecha de nacimiento y email | Solo el dueño |
| `usernames/{handle}` | Reserva del @usuario (único) | Logueados (get) |
| `events/{id}` | Evento público (sin la dirección de las previas privadas) | **Todos**, también sin cuenta |
| `events/{id}/private/data` | Dirección exacta de una previa privada | Quien organiza y aprobados |
| `events/{id}/attendees/{uid}` | Asistencia: `solicitado`, `aprobado`, `rechazado`, `confirmado`, `en-espera` | La persona y quien organiza |
| `events/{id}/media/foto` | Foto grande (la tarjeta usa una miniatura dentro del evento) | Todos |
| `events/{id}/vip/lista` | Nombres de la lista VIP | Quien organiza |
| `events/{id}/calificaciones/{uid}` | Nota de cada persona (anónima; los totales están en el evento) | Solo la persona |
| `events/{id}/reposts/{uid}` | Quién lo compartió | Logueados |
| `events/{id}/votos/{uid}` | Voto de ambiente en vivo | Logueados |
| `events/{id}/vistas/{uid}` | Vista única (va junto con el +1 a `vistasCount`) | Solo la persona (get) |
| `events/{id}/acreditaciones/{uid}` | Pedidos de prensa | La persona y quien organiza |
| `events/{id}/equipos/{equipoId}` | Equipos de un torneo (nombre e integrantes) | Logueados |
| `chats/{eventId}/messages` | Grupo del evento | Quien organiza y aprobados/confirmados |
| `friendships/{a_b}` | Amistades (ids ordenados). Las aceptadas se pueden listar ("amigos" en los perfiles; índice `users`+`estado`) | Los dos; aceptadas: logueados |
| `dms/{a_b}` y `/mensajes` | Mensajes directos y solicitudes de mensaje | Los dos |
| `notificaciones/{uid}/items` | Avisos internos | El destinatario |
| `planes/{uid}` | A qué eventos va, qué compartió y su comentario opcional (`notas`, hasta 15 palabras) | El dueño y sus amigos |
| `seguidores/{org}/fans/{uid}` | Seguidores de organizaciones | La persona y la organización |
| `verificaciones/{uid}` | Pedido de insignia ✓ | El dueño y admins |
| `reports`, `bloqueos`, `admins` | Denuncias, bloqueos y administradores (`admins/{uid}` se crea a mano en la consola) | Según el caso |

### Contadores

`confirmadosCount`, `repostsCount`, `vistasCount`, `califN/califJoda/califAnf` (evento) y `seguidores`, `califN/califSuma` (usuario) se actualizan desde el cliente **en la misma escritura** que el documento que los justifica. Las reglas comparan antes/después (`get` / `getAfter`) para que nadie pueda inflarlos.

### Privacidad de las previas privadas

- El evento público solo tiene el **barrio** y una ubicación **corrida unos ~450 m al azar**.
- La dirección exacta vive en `private/data` y solo la leen quien organiza y los aprobados.

## Servicios externos

| Servicio | Para qué | Nota |
|---|---|---|
| Firebase Auth | Google y email/contraseña | Facebook preparado detrás de `LOGIN_FACEBOOK = false` |
| App Check + Google Fraud Defense | Anti-bots | Clave en `APP_CHECK_CLAVE`. Gratis hasta 10.000 verificaciones/mes. **No activar "Enforce" sin mirar el uso** |
| OpenStreetMap / Nominatim | Mapas y búsqueda de direcciones | Gratis, sin clave; respetar el uso moderado |
| Leaflet, qrcodejs, html5-qrcode, jsPDF, TensorFlow.js | Mapas, QR, escáner de puerta, PDF, filtro de fotos | Se cargan desde cdnjs / jsdelivr cuando hacen falta |
| Google Translate | Inglés y portugués | Traducción automática, no curada |

## Límites del plan gratis (Spark)

- Firestore: 50.000 lecturas y 20.000 escrituras por día.
- El inicio escucha en vivo los próximos 50 eventos (`LIMITE_INICIAL`, con "Cargar más" de a 100) (`onSnapshot`): cada cambio en un evento cuesta 1 lectura por cada persona con la app abierta. Si crece mucho el uso, es lo primero a revisar.
- Sin Cloud Functions: no hay avisos push con la app cerrada ni tareas programadas.

## Pruebas

- `tests/fakefb.js`: imitación en memoria de Firebase (Auth + Firestore). Con `store.estricto = true` imita además los permisos de un usuario sin cuenta.
- `tests/cargar-html.js`: arma la página uniendo `index.html` + `css/app.css` + `js/app.js` y saca las librerías de internet.
- Cada `test_*.js` abre una o varias "ventanas" (usuarios distintos) con jsdom y recorre un flujo real.

## Velocidad de carga

- **Hosting:** Firebase Hosting sirve los archivos desde una red global (CDN), cerca de quien entra. No depende de dónde esté la base de datos.
- **Firestore** sí vive en una región fija (se ve en la consola → Firestore Database). Cada consulta viaja hasta ahí.
- Al arrancar, perfil privado, admin, verificación y eventos se piden **en paralelo** (`entrarALaApp`).
- Firestore guarda una **copia local** (`enablePersistence`): desde la segunda visita la app abre con lo último que vio y se actualiza sola.
- Las miniaturas de los eventos pesan ~20-30 KB (`LIMITE_MINI`); la foto grande se baja solo al abrir el evento.
- Librerías pesadas (mapas, PDF, QR, filtro de fotos) se cargan **recién cuando se usan**.
- Mayor peso que queda: el SDK de Firebase "compat" (~200 KB comprimido). Migrar al SDK modular (con un empaquetador) lo reduce bastante; conviene hacerlo junto con la migración a React.

## Eventos

- `ocasion`: tipo de evento. De fiesta: fiesta, previa, after, egresados, cumple. Generales: musical, pena, gastronomico, charla, taller, cultural, deportivo, feria. Los generales no piden estilo de música ni lista VIP.
- `inscripcionHasta` (opcional): fecha límite para anotarse. La regla `inscripcionAbierta()` rechaza solicitudes, confirmaciones y lista de espera después de esa fecha.
- Estadísticas (solo quien organiza): vistas únicas, anotados, conversión y compartidos.
- `extras` (opcional, mapa ≤ 10 claves): respuestas de las preguntas según el tipo (`EXTRAS_TIPO` en app.js: deporte, menú, disertante, etc.). Se muestran en el detalle.
- Crear evento va en 3 pasos (`irAPasoCrear`): lo básico → tipo → dónde y detalles. Al editar se ve todo junto (`.form-pasos.todo`).
- `categoria`: estilo de música (`ESTILOS`). Si es `otro`, lo que escribió quien organiza va en `estiloOtro` (≤ 30) y se muestra en su lugar (`etiquetaEstilo(cat, ev)`).
- `faq` (opcional, ≤ 5): preguntas frecuentes **de cada evento** (`[{p, r}]`: guardarropa, reingreso...). Las organizaciones ya no tienen preguntas propias en su página.
- Torneos por equipos (deporte → modalidad "Torneo" → "¿Se juega por equipos?" Sí): el evento guarda `porEquipos: true` y, opcionales, `jugadoresPorEquipo` (1-50) y `maxEquipos` (2-64). Los equipos los arma la gente que se anota: `events/{id}/equipos/{equipoId}` = `{ nombre, creador, ts, miembros: { uid: { n, ts } } }` (el capitán es el primero que entró). Cada uno solo se agrega o se saca a sí mismo (regla `miembros.diff(...)`), y para sumarse tiene que estar anotado. El último que se va borra el equipo; quien organiza puede borrar cualquiera. "Ya no voy" también saca del equipo.
- Publicar: un solo envío a la vez (`state._publicando`) y sin duplicar si la escucha en vivo trae el evento antes de terminar de guardarse. "Organizando" cuenta los eventos propios que no terminaron ni se cancelaron (`misEventosOrganizando`).
- Miniaturas de las listas sin foto: el ícono del tipo sobre sus colores (`fotoMiniHTML`), en vez de la portada dibujada recortada.

## Perfil

- "Mis datos" (☰): lo que la persona cargó al registrarse, solo para ella. El mail ya no se muestra en el perfil.
- Organizaciones: en vez de "intereses" eligen qué tipo de eventos organizan (`ORG_TIPOS`); la música aparece solo si alguno lleva música (fiestas, peñas, en vivo...). Todo se guarda junto en `intereses` y el perfil lo muestra como "Organiza" y "Música".
- "Otro" en la música: lo que se escribe (hasta 3, separados por coma) se guarda como un gusto más.
- `banner` (solo organizaciones, JPEG ≤ 120.000 caracteres): portada arriba de su página.
- Foto de Google: las organizaciones no la usan (ni el nombre de la cuenta de Google al registrarse). Si una persona cambia su nombre por otro con otra inicial, la foto de Google se saca y queda la inicial nueva.
- `ocultarAmigos` / `ocultarSeguidores`: la app no muestra la lista de amigos ni el número de seguidores. (Las amistades aceptadas siguen siendo legibles por usuarios con cuenta en las reglas; para privacidad total habría que mover las amistades públicas a un documento aparte.)


## Páginas públicas (partazy.com/privacidad, /terminos, /soporte, /eliminar-cuenta, /organizadores)

- Son archivos HTML sueltos en `public/`, con su propio estilo liviano (`css/paginas.css`). `firebase.json` tiene `cleanUrls: true`, así se abren sin ".html".
- **No se editan a mano:** las genera `herramientas/generar-paginas.js` (`npm run paginas`) con los textos de la app: Privacidad y Términos salen de `index.html`, las preguntas de Soporte salen de `AYUDA` en `app.js`. `tests/test_paginas.js` falla si quedaron desactualizadas.
- `/organizadores` tiene un formulario que guarda en la colección `consultas` (motivo `organizacion`), la misma del formulario de Ayuda: se ve en Moderación → Consultas. Usa `js/organizadores.js` y App Check.
- Sirven también para lo que piden Google y Meta al revisar el inicio de sesión: link a la política de privacidad y a cómo borrar los datos (`/eliminar-cuenta`).
- La app acepta el link `partazy.com/#/crear` (abre Crear evento; sin cuenta pide registrarse y después sigue ahí).
- **Fundadores y /lanzamiento:** `FIN_FUNDADORES` en `app.js` está en `null` ("próximamente", sin fecha): todas las cuentas llevan la insignia ✦ Fundador y el aviso de registro se muestra. El día del lanzamiento se pone esa fecha y desde ahí las cuentas nuevas ya no son Fundadoras. La fecha de alta (`createdAt`) la validan las reglas al crear el perfil y no se puede cambiar después.
