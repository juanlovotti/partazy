// Prueba: puente de estado (src/estado.js, u07). La app vieja sigue igual y React se entera de lo que cambia.
const { JSDOM } = require('jsdom');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const f = Date.now() + 2 * 864e5;
store.docs.set('users/A', { nombre: 'Lu Ferreyra', usuario: 'lu.ferreyra', iniciales: 'LF', ciudad: 'Güemes', intereses: [], foto: '', nombreBusqueda: 'lu ferreyra', palabras: ['lu', 'ferreyra'] });
store.docs.set('users/A/privado/datos', { nacimiento: '2000-03-10' });
store.docs.set('users/O', { nombre: 'Vortex', usuario: 'vortex', iniciales: 'V', tipoCuenta: 'organizacion', ciudad: 'Güemes', intereses: [], foto: '', nombreBusqueda: 'vortex', palabras: ['vortex'] });
const base = { creador: 'O', creadorNombre: 'Vortex', organizador: 'Vortex', categoria: 'techno', tipoLugar: 'Fiesta', tipo: 'fiesta', privacidad: 'publica', hora: '23:00', lugar: 'Güemes', lat: -31.42, lng: -64.19, precio: 0, capacidad: 100, confirmadosCount: 3, edadMinima: 18, dresscode: 'Libre', musica: 'Techno', imagen: '', descripcion: 'x', reglas: 'x', estado: 'publicado', fechaTs: f };
store.docs.set('events/e1', { ...base, nombre: 'Evento Uno' });
let avisos = [];
const w = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://partazy.web.app/',
  beforeParse(w){
    w.firebase = makeFirebase(store, () => ({ uid: 'A', email: 'lu@t.com' })); w.navigator.geolocation = undefined;
    w.addEventListener('error', e => console.error('ERROR JS', e.message));
    // Escucha desde el primer momento, como lo haría una pantalla React
    w.addEventListener('DOMContentLoaded', () => { w.__puenteEstado.suscribir(ids => avisos.push(...ids)); });
  } }).window;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fallas = 0; const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if(!c) fallas++; };
const vio = id => avisos.includes(id);
(async () => {
  await sleep(800);
  ok(!!w.__puenteEstado && typeof w.__puenteEstado.suscribir === 'function', 'el puente está publicado');
  ok(vio('estado.uid') && vio('estado.perfil'), 'al entrar, avisa que cambiaron la sesión y el perfil');
  ok(vio('estado.eventos'), 'avisa cuando llegan los eventos');
  ok(w.state.uid === 'A' && w.state.perfil.nombre === 'Lu Ferreyra' && w.state.eventos.some(e => e.id === 'e1'), 'la app vieja sigue leyendo state igual');

  avisos = [];
  w.ir('explorar'); await sleep(10);
  ok(vio('nav.actual') && w.NAV.actual === 'explorar', 'cambiar de pantalla avisa nav.actual');
  ok(w.document.querySelector('.screen.activa').id === 'pantalla-explorar', 'y la pantalla cambia como siempre');

  avisos = [];
  w.state.radioKm = 10; await sleep(5);
  ok(vio('estado.radioKm'), 'cambiar la distancia avisa');
  avisos = [];
  w.state.radioKm = 10; await sleep(5);
  ok(!vio('estado.radioKm'), 'el mismo valor no avisa');

  ok(typeof w.avisarEstado === 'undefined' && typeof w.observar === 'undefined', 'las funciones del puente quedan adentro de la app (no se publican en window)');
  ok(w.NAV.pila !== undefined && Array.isArray(w.state.eventos), 'state y NAV siguen siendo los mismos objetos de siempre');
  // El "atrás" sigue funcionando con NAV observado
  w.ir('detalle', { clave: 'detalle:e1' }); await sleep(10);
  w.history.back(); await sleep(80);
  ok(w.NAV.actual === 'explorar', 'el "atrás" sigue volviendo a la pantalla anterior');
  console.log(fallas ? `\n${fallas} falla(s)` : '\nTodo OK'); process.exit(fallas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
