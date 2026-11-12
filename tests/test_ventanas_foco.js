// Prueba: ventanas accesibles con teclado y lector de pantalla (src/ventanas.js) y áreas para tocar (app.css).
// Al abrir una ventana el foco entra; Tab no se sale; Escape la cierra; el foco vuelve a donde estaba.
const { JSDOM } = require('jsdom'); const fs = require('fs'); const path = require('path');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put = (p, v) => store.docs.set(p, v); const T = Date.now();
put('users/O', { nombre: 'Vortex', usuario: 'vortex', iniciales: 'V', tipoCuenta: 'organizacion', ciudad: 'Córdoba', intereses: [], foto: '' });
put('events/e1', { creador: 'O', creadorNombre: 'Vortex', organizador: 'Vortex', categoria: 'techno', tipo: 'fiesta', ocasion: 'fiesta', privacidad: 'publica', fechaTs: T + 2 * 864e5, hora: '23:30', lugar: 'Güemes', lat: -31.42, lng: -64.19, precio: 0, capacidad: 100, confirmadosCount: 3, edadMinima: 18, dresscode: 'Libre', musica: 'Techno', descripcion: 'x', reglas: 'x', estado: 'publicado', nombre: 'Noche Vortex' });
const w = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://partazy.web.app/',
  beforeParse(w){
    w.firebase = makeFirebase(store, () => null); w.navigator.geolocation = undefined; w.addEventListener('error', e => console.error('ERROR JS', e.message));
    // jsdom no calcula el diseño: "visible" = ningún contenedor con display:none
    w.Element.prototype.getClientRects = function(){ for(let e = this; e && e.nodeType === 1; e = e.parentElement){ if(w.getComputedStyle(e).display === 'none') return []; } return [{}]; };
  } }).window;
const sleep = ms => new Promise(r => setTimeout(r, ms)); const $ = id => w.document.getElementById(id);
let f = 0; const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if(!c) f++; };
const tecla = (key, shift) => { const e = new w.KeyboardEvent('keydown', { key, shiftKey: !!shift, bubbles: true, cancelable: true }); (w.document.activeElement || w.document.body).dispatchEvent(e); return e; };
const activo = () => w.document.activeElement;
(async () => {
  await sleep(700); w.cerrarTutorial && w.cerrarTutorial(); await sleep(50);

  // 1) Con el teclado: "Entrar" abre la ventana de cuenta y el foco entra
  const entrar = w.document.querySelector('.btn-entrar');
  entrar.focus(); entrar.click(); await sleep(30);
  const hoja = $('hoja-cuenta');
  ok(hoja.classList.contains('show'), 'Entrar abre la ventana "Sumate"');
  ok(activo() === hoja, 'el foco entra en la ventana (el lector de pantalla la anuncia)');
  ok(hoja.getAttribute('role') === 'dialog' && hoja.getAttribute('aria-modal') === 'true', 'la ventana se presenta como diálogo');
  const lista = [...hoja.querySelectorAll('button, a[href], input, select, textarea')].filter(b => b.getClientRects().length);
  ok(lista.length >= 2, 'la ventana tiene botones para recorrer con Tab');
  tecla('Tab'); ok(activo() === lista[0], 'Tab va al primer botón de la ventana, no a la pantalla de atrás');
  tecla('Tab', true); ok(activo() === lista[lista.length - 1], 'Shift+Tab desde el primero va al último (no se sale)');
  tecla('Tab'); ok(activo() === lista[0], 'Tab desde el último vuelve al primero');
  const e = tecla('Escape'); await sleep(80);
  ok(!hoja.classList.contains('show'), 'Escape cierra la ventana');
  ok(e.defaultPrevented, 'el Escape se usa solo para cerrar la ventana');
  ok(activo() === entrar, 'al cerrar, el foco vuelve a "Entrar"');

  // 2) Abierta por la app (sin foco previo): el foco entra igual; al cerrarla con su botón, no queda trabado adentro
  w.abrirRango(); await sleep(30);
  ok(activo() === $('modal-rango'), 'Elegir zona: el foco entra en la ventana');
  w.cerrarRango(); await sleep(80);
  ok(!$('modal-rango').contains(activo()), 'al cerrarla, el foco no queda en una ventana escondida');

  // 3) Confirmar ya ponía el foco en "Aceptar" y tenía su propio Escape: se respeta y resuelve una sola vez
  let veces = 0, valor;
  const p = w.confirmar('¿Seguro?', 'Prueba', 'Sí').then(v => { veces++; valor = v; });
  await sleep(30);
  ok(activo() === $('modal-ok'), 'Confirmar: el foco sigue en "Sí" (no se lo saca la ventana)');
  tecla('Escape'); await sleep(30); await p;
  ok(veces === 1 && valor === false && !$('modal-bg').classList.contains('show'), 'Confirmar: Escape cancela una sola vez');

  // 4) Dos ventanas: el mapa encima de "Elegir zona"; Escape cierra solo la de arriba
  w.abrirRango(); await sleep(30);
  if(typeof w.abrirMapa === 'function'){
    try{ w.abrirMapa(); } catch(err){}
    await sleep(60);
    if($('modal-mapa').classList.contains('show')){
      ok(activo() === $('modal-mapa'), 'mapa encima: el foco está en el mapa');
      tecla('Escape'); await sleep(80);
      ok(!$('modal-mapa').classList.contains('show') && $('modal-rango').classList.contains('show'), 'Escape cierra solo el mapa');
      ok($('modal-rango').contains(activo()), 'y el foco vuelve a la ventana de abajo');
    }
  }
  tecla('Escape'); await sleep(80);
  ok(!$('modal-rango').classList.contains('show'), 'otro Escape cierra "Elegir zona"');

  // 5) Sin ventanas abiertas, Tab y Escape no se tocan
  const e2 = tecla('Escape'); const e3 = tecla('Tab');
  ok(!e2.defaultPrevented && !e3.defaultPrevented, 'sin ventanas abiertas, Tab y Escape funcionan como siempre');

  // 6) CSS: sin recuadro alrededor de la ventana enfocada; áreas para tocar más grandes sin cambiar el aspecto
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.css'), 'utf8');
  ok(/\.hoja-bg\[tabindex="-1"\]:focus[^{]*\{outline:none;\}/.test(css), 'la ventana enfocada no muestra un recuadro');
  ok(/\.faq summary\{margin:-12px -14px; padding:12px 14px;\}/.test(css) && /\.faq\[open\] summary\{margin-bottom:0; padding-bottom:0;\}/.test(css), 'Ayuda: toda la tarjeta de cada pregunta se puede tocar');
  ok(/width:max\(100%, 44px\); height:max\(100%, 44px\)/.test(css) && /\.link-btn::after/.test(css) && /\.check-normas \.link-btn::after\{content:none;\}/.test(css), 'links chicos: área de 44 px (menos el de las normas, pegado a la casilla)');
  ok(!/:not\([^)]*\s[^)]*\)/.test(css.slice(css.indexOf('Accesibilidad (11/11/2026)'))), 'sin selectores que Chrome 87 no entiende');

  console.log(f ? `\n${f} falla(s)` : '\nTodo OK'); process.exit(f ? 1 : 0);
})();
