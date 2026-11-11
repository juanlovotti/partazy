// Prueba: si el arranque falla (por ejemplo, sin conexión al leer el perfil), se muestra
// "Error de conexión" con el botón Reintentar en vez de quedar trabado en la pantalla de carga.
const { JSDOM } = require('jsdom');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore();
const getOriginal = store.docs.get.bind(store.docs);
store.docs.get = k => { if(k === 'users/A') throw new Error('Sin conexión'); return getOriginal(k); };
const w = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://partazy.com/',
  beforeParse(w){ w.firebase = makeFirebase(store, () => ({ uid: 'A', email: 'a@t.com' })); w.navigator.geolocation = undefined;
    w.console.error = () => {}; w.addEventListener('error', e => console.log('ERROR JS', e.message)); } }).window;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let f = 0; const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if(!c) f++; };
(async () => {
  await sleep(1200);
  const txt = w.document.getElementById('loader-txt').textContent;
  ok(/Error de conexión/.test(txt) && /Sin conexión/.test(txt), 'muestra "Error de conexión" con el motivo');
  ok(!!w.document.querySelector('#loader-txt button') && /Reintentar/.test(w.document.querySelector('#loader-txt button').textContent), 'y el botón Reintentar');
  ok(w.document.querySelector('#loader .lv-carga').style.display === 'none', 'el logo animado deja de mostrarse');
  console.log(f ? '\nFALLAS: ' + f : '\nTODO OK'); process.exit(f ? 1 : 0);
})();
