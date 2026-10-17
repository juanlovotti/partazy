# PARTAZY

Red social de eventos: fiestas, previas, recitales, charlas, talleres, ferias, partidos y más. Ver qué hay cerca, a dónde van tus amigos, confirmar, armar eventos (públicos o privados), chatear y calificar.

- **En producción:** https://partazy.com (también en https://partazy.web.app)
- **Stack:** HTML + CSS + JavaScript sin frameworks ni build, sobre **Firebase** (Hosting, Authentication y Cloud Firestore), plan gratuito **Spark**.
- **Idioma del código y de la app:** español (rioplatense).

## Estructura

```
partazy/
├── public/                  ← lo que se publica en Firebase Hosting
│   ├── index.html           pantallas y estructura (HTML)
│   ├── css/app.css          estilos
│   ├── js/app.js            toda la lógica (ver mapa en docs/ARQUITECTURA.md)
│   ├── sw.js                service worker mínimo (avisos del celular)
│   ├── manifest.json        app instalable (PWA)
│   └── *.png / *.svg        íconos e imagen para compartir (og-partazy.png)
├── firestore.rules          reglas de seguridad de la base de datos (¡la seguridad real está acá!)
├── firestore.indexes.json   índices de Firestore
├── firebase.json            configuración de Hosting (2 sitios) y Firestore
├── tests/                   pruebas automáticas (jsdom + base de datos falsa en memoria)
└── docs/                    arquitectura y pendientes
```

## Requisitos

- [Node.js](https://nodejs.org) 18 o más nuevo
- Firebase CLI: `npm install -g firebase-tools` y después `firebase login`

## Correr las pruebas

```
npm install
npm test
```

Corre 37 archivos de prueba (más de 450 comprobaciones) contra la app real, con una base de datos falsa en memoria (`tests/fakefb.js`). Para correr una sola: `node tests/test_calif.js`.

> Las pruebas **no** verifican `firestore.rules` (la base falsa no aplica reglas). Cualquier cambio en las reglas se prueba a mano o con el emulador de Firebase (`firebase emulators:start`).

## Ver la app en la compu

Cualquier servidor estático sobre `public/` sirve, por ejemplo:

```
npx serve public
```

Ojo: se conecta a la base de datos **real** de producción. Para no tocar datos reales, usar el emulador de Firebase.

## Publicar

```
firebase deploy                       # todo: hosting + reglas + índices
firebase deploy --only hosting        # solo la página
firebase deploy --only firestore:rules
```

Hay dos sitios de Hosting: `partazy` (el real) y `partazy-5555d` (redirige al real).

## Reglas de trabajo

1. **Toda lectura y escritura a Firestore pasa por `DataService`** (en `js/app.js`). Nunca llamar a `firebase.firestore()` directo desde la interfaz.
2. **Todo texto que viene de usuarios se escapa con `esc()`** antes de meterlo en
