# PARTAZY

Red social de fiestas, previas y boliches: ver qué hay cerca, a dónde van tus amigos, confirmar, armar previas (públicas o privadas), chatear y calificar.

- **En producción:** https://partazy.com (también en https://partazy.web.app)
- **Stack:** HTML + CSS + JavaScript, empaquetado con **Vite**, sobre **Firebase** (Hosting, Authentication y Cloud Firestore), plan gratuito **Spark**. En migración por partes a **React + TypeScript** (ver [docs/MIGRACION.md](docs/MIGRACION.md)).
- **Idioma del código y de la app:** español (rioplatense).

## Estructura

```
partazy/
├── index.html               la app: pantallas y estructura (entrada de Vite)
├── src/
│   ├── app.js               la lógica de la app vieja (ver mapa en docs/ARQUITECTURA.md)
│   ├── app.css              estilos
│   └── react/               lo que ya pasó a React (interruptores, pantallas, acceso a la app vieja)
├── public/                  se copia tal cual al sitio: páginas públicas, imágenes, video, sw.js, manifest
│   ├── privacidad.html, terminos.html, soporte.html, eliminar-cuenta.html, organizadores.html, lanzamiento.html
│   │                        páginas públicas (partazy.com/privacidad...). Se generan: npm run paginas
│   └── …
├── dist/                    el sitio armado (lo que publica Firebase Hosting). Se arma con npm run build
├── firestore.rules          reglas de seguridad de la base de datos (¡la seguridad real está acá!)
├── firestore.indexes.json   índices de Firestore
├── firebase.json            configuración de Hosting (2 sitios) y Firestore
├── vite.config.mjs          cómo se arma el sitio
├── herramientas/            generar-paginas.js y el puente global de la migración (vite-puente-global.mjs)
├── tests/                   pruebas automáticas (jsdom + base de datos falsa en memoria)
├── .migration/              plan y avance de la migración a React
└── docs/                    arquitectura, migración y pendientes
```

## Requisitos

- [Node.js](https://nodejs.org) 18 o más nuevo
- Firebase CLI: `npm install -g firebase-tools` y después `firebase login`

## Correr las pruebas

```
npm install
npm test
```

Corre 50 archivos de prueba (más de 500 comprobaciones) contra la app real, con una base de datos falsa en memoria (`tests/fakefb.js`), y después las pruebas de los componentes React (Vitest) y el chequeo de TypeScript. Para correr una sola: `node tests/test_calif.js`.

Las pruebas cargan la app desde un "paquete de prueba" (`tests/.paquete/app.js`) que arma Vite solo cuando hace falta.

> Las pruebas **no** verifican `firestore.rules` (la base falsa no aplica reglas). Cualquier cambio en las reglas se prueba a mano o con el emulador de Firebase (`firebase emulators:start`).

## Ver la app en la compu

```
npm run dev
```

Ojo: se conecta a la base de datos **real** de producción. Para no tocar datos reales, usar el emulador de Firebase.

## Publicar

Firebase Hosting publica la carpeta `dist/`. Si cambiaste código, primero armala (necesita `npm install` una vez):

```
npm run build
```

Después:

```
firebase hosting:channel:deploy prueba --only partazy   # link de prueba (7 días)
firebase deploy                       # todo: hosting + reglas + índices
firebase deploy --only hosting        # solo la página
firebase deploy --only firestore:rules
```

Hay dos sitios de Hosting: `partazy` (el real) y `partazy-5555d` (redirige al real).

## Reglas de trabajo

1. **Toda lectura y escritura a Firestore pasa por `DataService`** (en `src/app.js`; desde React, a través de `src/react/legado.ts`). Nunca llamar a `firebase.firestore()` directo desde la interfaz.
2. **Todo texto que viene de usuarios se escapa con `esc()`** antes de meterlo en `innerHTML`. En React no se usa `dangerouslySetInnerHTML`.
3. **La seguridad está en `firestore.rules`.** La app puede ocultar botones, pero lo que realmente se permite o no lo deciden las reglas. Cualquier función nueva que escriba en la base necesita su regla.
4. **Si agregás una función, agregá su prueba** en `tests/` y corré `npm test` antes de publicar.
5. Las funciones de `src/app.js` siguen siendo globales: el HTML las llama con `onclick="..."`. Ahora las publica en `window` el puente `herramientas/vite-puente-global.mjs` (temporal, hasta terminar la migración).

Más detalle en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md). Lo que falta hacer, en [docs/PENDIENTES.md](docs/PENDIENTES.md).
