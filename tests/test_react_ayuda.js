// Prueba: pantalla Ayuda en React (interruptor ?react=ayuda), con los mismos casos que test_contacto.js para la
// versión vieja. También: sin interruptor sigue la versión vieja, y ?react=0 lo apaga.
const { JSDOM } = require('jsdom');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put = (p, v) => store.docs.set(p, v);
put('users/A', { nombre: 'Lu Ferreyra', usuario: 'lu.ferreyra', iniciales: 'LF', ciudad: 'Córdoba', intereses: [], foto: '' }); put('users/A/privado/datos', { nacimiento: '1998-01-01' });
const mk = url => new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url, beforeParse(w){
  w.firebase = makeFirebase(store, () => ({ uid: 'A', email: 'lu@mail.com' })); w.navigator.geolocation = undefined;
  w.addEventListener('error', e => console.log('ERROR JS', e.message)); } }).window;
const sleep = ms => new Promise(r => setTimeout(r, ms)); const txt = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
let f = 0; const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if(!c) f++; };
// Escribir como una persona (React escucha el evento "input")
const escribir = (w, el, valor) => {
  const proto = el.tagName === 'TEXTAREA' ? w.HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? w.HTMLSelectElement.prototype : w.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, valor);
  el.dispatchEvent(new w.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
};
(async () => {
  // Sin interruptor: versión vieja
  const v = mk('https://partazy.com/'); await sleep(900);
  ok(!v.__pantallasReact.has('ayuda') && !v.document.querySelector('#pantalla-ayuda [data-react]'), 'sin interruptor, Ayuda sigue siendo la versión vieja (solo el Crear por pasos está publicado)');
  // Con interruptor
  const prod = mk('https://partazy.com/?react=ayuda'); await sleep(900);
  ok(!prod.__pantallasReact.has('ayuda') && prod.localStorage.getItem('partazy_react') === null, 'en partazy.com ?react se ignora (nadie puede prenderle una pantalla a otro con un link)');
  const PRUEBA = 'https://partazy--prueba-abc123.web.app/';
  const w = mk(PRUEBA + '?react=ayuda'); const $ = id => w.document.getElementById(id);
  await sleep(900); await w.__reactListo; await sleep(50);
  ok(w.__pantallasReact.has('ayuda') && !!w.document.querySelector('#pantalla-ayuda > [data-react="ayuda"]'), 'con ?react=ayuda la dibuja React');
  ok(w.localStorage.getItem('partazy_react') === 'ayuda', 'el interruptor queda guardado en este navegador');
  ok(!!w.document.querySelector('#pantalla-ayuda > footer.pie-legal') && /partazycontacto@gmail\.com/.test(txt(w.document.querySelector('#pantalla-ayuda .pie-legal'))), 'el pie legal sigue ahí (de la app vieja)');
  w.abrirAyuda(); await sleep(80);
  ok(w.document.querySelector('.screen.activa')?.id === 'pantalla-ayuda', 'abrirAyuda muestra la pantalla');
  ok(/Colores y etiquetas/.test(txt($('lista-ayuda'))) && w.document.querySelectorAll('#lista-ayuda details.faq').length === w.eval('AYUDA').reduce((n, [, q]) => n + q.length, 0), 'están todas las preguntas frecuentes');
  ok($('ct-nombre').value === 'Lu Ferreyra' && $('ct-email').value === '', 'con sesión se precarga el nombre, pero NO el mail');
  ok($('ct-whatsapp').style.display === 'none' && /partazycontacto@gmail\.com/.test(txt($('ct-mail'))), 'sin número cargado no muestra WhatsApp; sí el mail');
  escribir(w, $('ct-email'), 'lu@mail.com'); escribir(w, $('ct-mensaje'), 'Hola'); await sleep(20);
  $('ct-enviar').click(); await sleep(80);
  ok(/un poco más/.test(txt($('toast'))) && ![...store.docs.keys()].some(k => k.startsWith('consultas/')), 'mensaje muy corto: no se manda');
  escribir(w, $('ct-motivo'), 'organizacion'); escribir(w, $('ct-mensaje'), 'Tengo un boliche y quiero publicar fechas'); await sleep(20);
  $('ct-enviar').click(); await sleep(150);
  const c = [...store.docs.entries()].find(([k]) => k.startsWith('consultas/'));
  ok(c && c[1].motivo === 'organizacion' && c[1].uid === 'A' && c[1].email === 'lu@mail.com' && c[1].nombre === 'Lu Ferreyra', 'la consulta se guarda igual que antes');
  ok(/Gracias/.test(txt($('toast'))) && $('ct-mensaje').value === '' && $('ct-enviar').textContent === 'Enviar' && !$('ct-enviar').disabled, 'avisa, limpia el mensaje y el botón vuelve a "Enviar"');
  w.document.querySelector('#lista-ayuda details.faq').open = true;
  w.eval('NAV.pila.length = 0'); w.document.querySelector('#pantalla-ayuda .volver').click(); await sleep(80);
  ok(w.document.querySelector('.screen.activa')?.id === 'pantalla-perfil', '"Volver" sin historial lleva a Perfil, como antes');
  w.abrirAyuda(); await sleep(80);
  ok(![...w.document.querySelectorAll('#lista-ayuda details.faq')].some(d => d.open), 'al volver a entrar, las preguntas arrancan cerradas (como antes)');
  // Apagar
  const z = mk(PRUEBA + '?react=0'); await sleep(900);
  ok(!z.__pantallasReact.size && z.localStorage.getItem('partazy_react') === '0', '?react=0 apaga todo (también las publicadas) y queda guardado');
  const x = mk(PRUEBA + '?react=cualquiera'); await sleep(900);
  ok(!x.__pantallasReact.has('cualquiera') && [...x.__pantallasReact].join() === 'crear', 'nombres que no tienen versión React se ignoran (queda lo publicado)');
  console.log(f ? '\nFALLAS: ' + f : '\nTODO OK'); process.exit(f ? 1 : 0);
})();
