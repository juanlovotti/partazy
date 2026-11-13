// Prueba: tarjetas con la fecha en la foto (variante 1 elegida en Superdesign).
// Día y mes sobre la foto, hora grande, lugar con pin, sellos "Últimos N lugares" y "Agotado".
const { JSDOM } = require('jsdom');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put = (p, v) => store.docs.set(p, v);
put('users/A', { nombre: 'Lu Ferreyra', usuario: 'lu.ferreyra', iniciales: 'LF', ciudad: 'Güemes', intereses: [], foto: '', nombreBusqueda: 'lu ferreyra', palabras: ['lu', 'ferreyra'] });
put('users/A/privado/datos', { nacimiento: '2000-03-10' });
put('users/O', { nombre: 'Vortex Club', usuario: 'vortex', iniciales: 'V', tipoCuenta: 'organizacion', ciudad: 'Güemes', intereses: [], foto: '', nombreBusqueda: 'vortex club', palabras: ['vortex', 'club'] });
// Sábado que viene a las 23:30 (siempre en el futuro y nunca hoy ni mañana)
const d = new Date(); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7) + 7); d.setHours(23, 30, 0, 0);
const F = d.getTime();
const base = { creador: 'O', creadorNombre: 'Vortex Club', organizador: 'Vortex Club', categoria: 'techno', tipoLugar: 'Fiesta', ocasion: 'fiesta', privacidad: 'publica', hora: '23:30', lugar: 'Güemes', lat: -31.42, lng: -64.19, precio: 0, capacidad: 100, confirmadosCount: 10, edadMinima: 18, dresscode: 'Libre', musica: 'Techno', imagen: '', descripcion: 'x', reglas: 'x', estado: 'publicado', fechaTs: F };
put('events/normal', { ...base, nombre: 'Noche Vortex' });
put('events/pocos', { ...base, nombre: 'Peña del Abasto', ocasion: 'pena', tipoLugar: 'Peña', lugar: 'Abasto', capacidad: 20, confirmadosCount: 17 });
put('events/uno', { ...base, nombre: 'Casi Casi', capacidad: 10, confirmadosCount: 9 });
put('events/muchos', { ...base, nombre: 'Gran Fiesta', capacidad: 1000, confirmadosCount: 900 });
put('events/lleno', { ...base, nombre: 'Taller de DJ', ocasion: 'taller', tipoLugar: 'Taller', lugar: 'Nueva Córdoba', capacidad: 12, confirmadosCount: 12 });
put('events/externa', { ...base, nombre: 'Con Venta Afuera', capacidad: 50, confirmadosCount: 50, linkEntradas: 'https://alpogo.com/x' });
put('events/sintope', { ...base, nombre: 'Sin Tope', capacidad: 1, confirmadosCount: 5, capacidadDesconocida: true });
put('events/privada', { ...base, nombre: 'Previa de Lu', ocasion: 'previa', tipoLugar: 'Previa', privacidad: 'privada', creador: 'O', lugar: 'Colón 1234, Alberdi', direccion: 'Colón 1234' });
const hoy = new Date(); hoy.setHours(23, 59, 0, 0);
put('events/hoy', { ...base, nombre: 'Esta Noche', fechaTs: hoy.getTime() });
put('events/cancelado', { ...base, nombre: 'Se Suspendió', estado: 'cancelado' });

const w = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://partazy.web.app/',
  beforeParse(w){ w.firebase = makeFirebase(store, () => ({ uid: 'A', email: 'lu@t.com' })); w.navigator.geolocation = undefined; w.addEventListener('error', e => console.error('ERROR JS', e.message)); } }).window;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const txt = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
let fallas = 0; const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if(!c) fallas++; };
const MES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'][d.getMonth()];

(async () => {
  await sleep(800); try { w.cerrarTutorial(); } catch(e){}
  const caja = w.document.createElement('div'); w.document.body.appendChild(caja);
  const ev = id => ({ id, ...store.docs.get('events/' + id) });
  const tarjeta = id => { caja.innerHTML = w.tarjetaHTML(ev(id)); return caja.firstElementChild; };
  const horizontal = id => { caja.innerHTML = w.tarjetaHorizontalHTML(ev(id)); return caja.firstElementChild; };

  // ---------- La tarjeta común ----------
  let t = tarjeta('normal');
  const fecha = t.querySelector('.foto .fecha-foto');
  ok(fecha && txt(fecha.querySelector('b')) === String(d.getDate()) && txt(fecha.querySelector('span')) === MES, `fecha sobre la foto: "${d.getDate()}" y "${MES}"`);
  ok(fecha && fecha.getAttribute('aria-hidden') === 'true', 'la fecha de la foto no se lee dos veces (ya está en la etiqueta de la tarjeta)');
  ok(txt(t.querySelector('.meta-tarjeta .hora-grande')) === '23:30', 'la hora va grande: 23:30');
  ok(txt(t.querySelector('.meta-tarjeta .lugar-txt')) === 'Güemes' && t.querySelector('.meta-tarjeta .lugar-mini svg'), 'el lugar va con el pin');
  ok(txt(t.querySelector('.cat')) === 'Fiesta' && t.querySelector('.cat svg.ico-tipo'), 'sigue el tipo con su ícono');
  ok(!t.querySelector('.pill-cupo, .banda-agotado'), 'con lugar de sobra no lleva sello');
  ok(!/[·•]/.test(txt(t)), 'sin "·" ni "•" en la tarjeta');
  const etiqueta = t.getAttribute('aria-label');
  ok(/^Noche Vortex, sábado \d+ de \w+, 23:30, Güemes$/.test(etiqueta), `la tarjeta se lee completa: "${etiqueta}"`);

  // ---------- Sellos de cupo ----------
  t = tarjeta('pocos');
  ok(txt(t.querySelector('.foto .pill-cupo.ultimas')) === 'Últimos 3 lugares', 'quedan 3 de 20: píldora azul "Últimos 3 lugares"');
  ok(/últimos 3 lugares$/.test(t.getAttribute('aria-label')), 'y el lector de pantalla también lo dice');
  ok(txt(tarjeta('uno').querySelector('.pill-cupo')) === 'Último lugar', 'queda 1: "Último lugar"');
  ok(txt(tarjeta('muchos').querySelector('.pill-cupo')) === 'Últimos lugares', 'quedan 100 de 1000: "Últimos lugares" (sin un número que asuste)');
  t = tarjeta('lleno');
  ok(txt(t.querySelector('.foto .banda-agotado')) === 'Agotado' && t.classList.contains('agotada'), 'lleno: banda "Agotado" en la esquina');
  ok(!tarjeta('externa').querySelector('.pill-cupo, .banda-agotado'), 'si el cupo lo maneja una venta externa, no dice "Agotado"');
  ok(!tarjeta('sintope').querySelector('.pill-cupo, .banda-agotado'), 'sin tope de gente, no lleva sello');

  // ---------- Privacidad de las previas ----------
  t = tarjeta('privada');
  ok(txt(t.querySelector('.lugar-txt')) === 'Alberdi', 'previa privada: solo el barrio');
  ok(!/Colón|1234/.test(t.outerHTML), 'la dirección no aparece en ningún lado de la tarjeta (ni en la etiqueta)');
  ok(t.querySelector('.foto .candado-badge') && /previa privada$/.test(t.getAttribute('aria-label')), 'lleva el candado y se lee "previa privada"');

  // ---------- Hoy y cancelado ----------
  t = tarjeta('hoy');
  ok(txt(t.querySelector('.fecha-foto span')) === 'HOY' && /, hoy, 23:59,/.test(t.getAttribute('aria-label')), 'si es hoy, abajo del día dice "HOY"');
  t = tarjeta('cancelado');
  ok(txt(t.querySelector('.meta-tarjeta .cancelado-txt')) === 'Cancelado' && !t.querySelector('.hora-grande') && t.classList.contains('cancelada'), 'cancelado: en lugar de la hora dice "Cancelado"');
  ok(!t.querySelector('.pill-cupo, .banda-agotado'), 'cancelado no lleva sello de cupo');

  // ---------- Tarjeta horizontal (Explorar y "Lo que viene") ----------
  t = horizontal('pocos');
  ok(t.querySelector('.foto-h .fecha-foto') && txt(t.querySelector('.meta-tarjeta .hora-grande')) === '23:30', 'horizontal: fecha en la foto y hora grande');
  ok(txt(t.querySelector('.foto-h .banda-h.ultimas')) === 'Quedan 3', 'horizontal: franja "Quedan 3" abajo de la foto');
  ok(txt(horizontal('lleno').querySelector('.banda-h.agotado')) === 'Agotado', 'horizontal: franja "Agotado"');
  ok(txt(horizontal('privada').querySelector('.lugar-txt')) === 'Alberdi', 'horizontal: previa privada, solo el barrio');

  // ---------- En Inicio de verdad ----------
  caja.remove();
  w.ir('home'); w.renderHome(); await sleep(60);
  const home = w.document.getElementById('pantalla-home');
  const tarjetaDe = n => [...home.querySelectorAll('.tarjeta, .tarjeta-h')].find(c => txt(c.querySelector('h3, h4')) === n);
  const pena = tarjetaDe('Peña del Abasto');
  ok(pena && /Últimos 3 lugares|Quedan 3/.test(txt(pena)), 'en Inicio la Peña muestra que quedan 3 lugares');
  ok(pena && pena.querySelector('.fecha-foto'), 'y la fecha va sobre la foto');
  ok(!/Colón 1234/.test(home.innerHTML), 'en Inicio no aparece la dirección de la previa privada');

  // ---------- Guía de colores ----------
  w.abrirReferencias(); await sleep(30);
  const guia = w.document.getElementById('modal-referencias');
  ok(/Últimos lugares/.test(txt(guia)) && !/Últimas entradas/.test(txt(guia)), 'la guía de colores explica "Últimos lugares"');
  w.cerrarReferencias();

  console.log(fallas ? `\n${fallas} falla(s)` : '\nTodo OK'); process.exit(fallas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
