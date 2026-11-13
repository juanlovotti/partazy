# Migración a React: qué cambió y cómo se usa

El plan completo está en `.migration/plan.md` y el avance en `.migration/state.json`. Este documento resume lo hecho y cómo trabajar con ello.

## Lo hecho (11/11/2026)

| Paso | Qué cambió | Se ve distinto |
|---|---|---|
| Arreglo previo | Encabezado del Inicio en el celu sin la "sombra gigante" (en iPhone tapaba la pantalla de negro al bajar). Si falla el arranque, ahora aparece "Error de conexión" y "Reintentar" en vez de quedar trabado en la carga. | Sí (arreglos) |
| u01 Vite | El sitio se arma con Vite en `dist/`, y Firebase Hosting publica `dist/`. `index.html` pasó a la raíz del proyecto. Los archivos con hash (`assets/`) se guardan un año en el celu. | No |
| u02 Módulo ES | `app.js` → `src/app.js`, empaquetado por Vite (minificado y con hash). Un puente publica en `window` todo lo que antes era global (los `onclick` siguen andando). Las pruebas cargan un paquete de prueba armado igual, en modo estricto. | No |
| u06 Base React | React 19 + TypeScript + interruptores por pantalla. Si ninguna pantalla está prendida, React ni se descarga. | No |
| Ayuda en React | Primera pantalla migrada: misma apariencia (comparada píxel por píxel), mismo formulario de contacto. **Está apagada en partazy.com.** | No (apagada) |
| Accesibilidad (11/11, después de publicar) | Las ventanas se pueden usar con teclado y lector de pantalla (el foco entra, Tab queda adentro, Escape cierra) y los links chicos tienen área de 44 px para tocar. Detalle en `docs/ACCESIBILIDAD.md`; plan de pruebas en `docs/PRUEBAS.md`. **Falta publicar.** | No |
| u07 Puente de estado (12/11) | React se entera de lo que cambia en la app vieja (sesión, perfil, eventos, ubicación, amistades, pantalla actual) y puede navegar con el mismo historial. Base para las pantallas de la fase 3. **Falta publicar.** | No |
| Tarjetas nuevas (12/11) | Diseño elegido en Superdesign (variante 1): la fecha va sobre la foto (día grande y mes), la hora grande y el lugar con el pin. Sellos de cupo: "Últimos 3 lugares" en azul cuando quedan 9 o menos (o "Últimos lugares" desde el 85 %) y una banda "Agotado" en la esquina. En las listas, una franja abajo de la foto ("Quedan 3", "Agotado"). Con venta en otra página o sin tope, no hay sello (Partazy no sabe cuántos quedan). Se cambió en la app de siempre (no es React). **Falta publicar.** | **Sí** |
| Crear por pasos en React (12/11) | El "Crear" conversacional elegido en Superdesign: 7 pantallas cortas (tipo, nombre y foto, cuándo, dónde, entrada, lugares y detalles, revisar) con "Siguiente" fijo abajo, la tarjeta tal como la va a ver la gente y la casilla de las normas. Valida y guarda con las mismas reglas que el formulario de siempre. **Apagado en partazy.com**: se prueba con `?react=crear` en el link de prueba. Editar un evento sigue en el formulario de siempre. | No (apagado) |

## Números

| | Antes | Ahora |
|---|---|---|
| Primera visita desde Firebase Hosting (gzip) | ≈221 KB | **≈175 KB** (index.html 36 + JS 114 + CSS 25) |
| React (solo si hay una pantalla React prendida) | – | 84 KB + 3 KB de estilos, en archivos aparte (con Ayuda y el Crear por pasos) |
| Firebase (desde jsdelivr, no cuenta en el cupo de Hosting) | ≈158 KB | ≈158 KB (sin cambios) |
| Pruebas | 48 archivos | 54 archivos + 38 pruebas de componentes React + chequeo de TypeScript |
| Capturas comparadas (vieja vs. nueva, 10 pantallas) | – | 0 píxeles distintos, 0 errores de JavaScript |

## Cómo probar una pantalla React

1. Publicá el link de prueba: `firebase hosting:channel:deploy prueba --only partazy`.
2. Abrí ese link agregando `?react=ayuda` al final (por ejemplo `https://partazy--prueba-xxxx.web.app/?react=ayuda`). Queda prendido en ese navegador. Para el Crear por pasos: `?react=crear` (o las dos: `?react=ayuda,crear`).
3. Para apagarlo, abrí el link con `?react=0`.

### Qué mirar en el Crear por pasos
- Tocá "+" (o "Crear evento" en la compu): se abre el paso 1 de 7. En el celu se esconde la barra de abajo mientras completás.
- Probá una previa privada: en "¿Dónde es?" el barrio va arriba (lo ve todo el mundo) y la dirección exacta abajo (solo los aprobados). Si ponés calle y número en el barrio, no te deja seguir.
- Probá una entrada paga con comprobante: sin alias o CBU no te deja seguir.
- En "¿Todo listo?" tocá "Editar" en cualquier fila: te lleva a ese paso.
- Publicá uno de prueba y borralo después desde el evento (Cancelar evento).
- Editar un evento ya publicado abre el formulario de siempre: es a propósito.

En partazy.com, `?react=` no hace nada: nadie puede prenderle una pantalla a otra persona mandándole un link.

## Cómo prender una pantalla React para todos (y cómo volver atrás)

1. En `src/react/interruptores.ts`, agregá el nombre a `PUBLICADAS`, por ejemplo `['ayuda']`.
2. `npm run build` y `firebase deploy --only hosting`.
3. Para volver atrás: sacarlo de `PUBLICADAS`, armar y publicar de nuevo. También se puede restaurar la publicación anterior desde Firebase Console → Hosting → historial de publicaciones.

## Decisiones tomadas en este paso

- **Firebase sigue siendo el SDK compat 10.12 desde jsdelivr** (u03 postergada). Pasar al SDK modular empaquetado hoy sumaría unos 216 KB gzip por primera visita al cupo de Hosting (versión 13.2: Firestore solo ya son ~186 KB). Cargarlo desde el CDN de Google sumaría ~23 KB para cada persona, sin ninguna mejora visible. Las pantallas React usan `DataService` (vía `src/react/legado.ts`), así que no necesitan el SDK nuevo. Se retoma al pasar a Blaze o si Google anuncia el fin del SDK compat.
- **app.js no se partió en varios archivos todavía.** Partirlo sin React era un cambio grande y riesgoso que no mejoraba nada. Cada sección se va a mover a `src/` (con tipos) cuando su pantalla pase a React.
- **Las pantallas React reusan las clases de `app.css`**, para que se vean exactamente igual. Tailwind se suma cuando haya una mejora de diseño elegida (variantes en Superdesign).
- **El pie legal de cada pantalla sigue siendo de la app vieja**, porque lo comparten 5 pantallas.

- **Crear por pasos (12/11):** tiene pantalla propia (`#pantalla-crear-pasos`) y solo crea eventos nuevos; editar sigue en el formulario de siempre hasta que se haga la versión React de Editar. La parte que valida y guarda se separó de la que lee el formulario (`leerFormCrear` + `publicarConDatos` en `src/app.js`) y la usan los dos, así las reglas son siempre las mismas.
- **Las tarjetas se cambiaron en la app de siempre**, no en React: el diseño cambia donde vive hoy, y la unidad de tarjetas (u21) las pasará a React con este aspecto.

## Lo que quedó bloqueado o pendiente

- **u05, pruebas de las reglas de Firestore:** el emulador necesita descargarse de servidores de Google que esta sesión no puede alcanzar. Se puede correr en la compu de Juan con Java instalado, o permitir el dominio `storage.googleapis.com` en la configuración de Claude.
- **Integridad de los scripts de Firebase (SRI):** convendría agregar `integrity` a los 4 scripts de jsdelivr, pero hay que verificar el hash contra lo que sirve el CDN, y desde acá no se puede.
- **Fase 3 (las demás pantallas):** cada una necesita que Juan elija entre variantes (Superdesign) o apruebe la versión idéntica, y su OK para prenderla en partazy.com.
- **Crear por pasos y el traductor:** con el sitio en inglés o portugués (Google Translate), React puede fallar si el traductor cambia el texto de la pantalla. Si falla, la pantalla queda vacía y al tocar "Crear" de nuevo se abre el formulario de siempre. La decisión de idiomas está pendiente (u11).
- **"Charla / Seminario":** en el diseño se propuso llamarlo solo "Seminario". Sigue con el nombre de siempre hasta que Juan lo confirme.

## Particularidades conocidas (se mantienen igual)

- Entre la medianoche y las 8 de la mañana, "Hoy" considera la noche anterior (`esEstaNoche`). Por eso puede aparecer la nota "Hoy no hay nada cargado" junto a una tarjeta que dice "Hoy · 23:30".
- `#/u/` usa el código interno de la persona, no el @usuario.
- `partazy_vista_{evento}` suma una entrada en el navegador por cada evento visto.

## Checklist para publicar esta versión (fase 1)

**Antes**
- [ ] Las pruebas pasan (`npm test`: 54 archivos + componentes React + TypeScript).
- [ ] La revisión de código y la de paridad están hechas (ver `.migration/units/`).
- [ ] No hay cambios en `firestore.rules` ni en los datos.
- [ ] Los interruptores de React están apagados en partazy.com (`PUBLICADAS = []`).
- [ ] La carpeta `dist/` está al día (la arma Claude con `npm run build`).

**Publicar**
1. `firebase hosting:channel:deploy prueba --only partazy` y abrir el link en el celu.
2. Revisar los recorridos clave:
   - sin cuenta: ver Inicio, bajar y abrir un evento;
   - entrar con Google y con mail;
   - anotarse a un evento gratis y ver la entrada;
   - abrir Explorar, Perfil, Chats, Ayuda y Crear (sin publicar);
   - bajar en Inicio en el iPhone (que no quede en negro);
   - mirar las tarjetas nuevas en Inicio y en Explorar (fecha sobre la foto, hora grande, "Últimos lugares" y "Agotado" si hay alguno así).
3. Con `?react=ayuda` en el link de prueba, revisar Ayuda en React: que se vea igual y que el formulario de contacto mande la consulta. Con `?react=crear`, crear un evento de prueba con el Crear por pasos (ver "Qué mirar en el Crear por pasos").
4. Si todo está bien: `firebase deploy --only hosting` (las reglas no cambiaron).
5. Abrir partazy.com en el celu y en la compu y repetir el paso 2 rápido.

**Volver atrás si**
- partazy.com queda en blanco o en la pantalla de carga;
- no se puede entrar con Google;
- no se pueden anotar a eventos;
- aparecen errores que antes no estaban.

Para volver: Firebase Console → Hosting → partazy → historial de publicaciones → "Restaurar" la anterior (un clic). El código se vuelve atrás después, con GitHub Desktop.

**Después**
- [ ] Hacer el commit en GitHub Desktop.
- [ ] Mirar App Check y los errores en la consola de Firebase durante el día.
