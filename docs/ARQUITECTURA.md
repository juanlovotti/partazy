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
| `events/{id}/acreditaciones/{uid}` | Pedidos de prensa | La persona y quien organiza |
| `chats/{eventId}/messages` | Grupo del evento | Quien organiza y aprobados/confirmados |
| `friendships/{a_b}` | Amistades (ids ordenados) | Los dos |
| `dms/{a_b}` y `/mensajes` | Mensajes directos y solicitudes de mensaje | Los dos |
| `notificaciones/{uid}/items` | Avisos internos | El destinatario |
| `planes/{uid}` | A qué eventos va, qué compartió y su comentario opcional (`notas`, hasta 15 palabras) | El dueño y sus amigos |
| `seguidores/{org}/fans/{uid}` | Seguidores de organizaciones | La persona y la organización |
| `verificaciones/{uid}` | Pedido de insignia ✓ | El dueño y admins |
| `reports`, `bloqueos`, `admins` | Denuncias, bloqueos y administradores (`admins/{uid}` se crea a mano en la consola) | Según el caso |

### Contadores

`confirmadosCount`, `repostsCount`, `califN/califJoda/califAnf` (evento) y `seguidores`, `califN/califSuma` (usuario) se actualizan desde el cliente **en la misma escritura** que el documento que los justifica. Las reglas comparan antes/después (`get` / `getAfter`) para que nadie pueda inflarlos.

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
- El inicio escucha en vivo los próximos 100 eventos (`onSnapshot`): cada cambio en un evento cuesta 1 lectura por cada persona con la app abierta. Si crece mucho el uso, es lo primero a revisar.
- Sin Cloud Functions: no hay avisos push con la app cerrada ni tareas programadas.

## Pruebas

- `tests/fakefb.js`: imitación en memoria de Firebase (Auth + Firestore). Con `store.estricto = true` imita además los permisos de un usuario sin cuenta.
- `tests/cargar-html.js`: arma la página uniendo `index.html` + `css/app.css` + `js/app.js` y saca las librerías de internet.
- Cada `test_*.js` abre una o varias "ventanas" (usuarios distintos) con jsdom y recorre un flujo real.
