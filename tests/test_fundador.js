// Prueba: insignia "Fundador" para quien se registró antes del lanzamiento oficial, y el aviso antes de registrarse.
const { JSDOM } = require('jsdom');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
let f = 0; const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if(!c) f++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function abrir(perfilA, ahora){
  const store = crearStore(); const put = (p, v) => store.docs.set(p, v);
  put('users/A', perfilA); put('users/A/privado/datos', { nacimiento: '1998-01-01' });
  put('users/B', { nombre: 'Beto Nuevo', usuario: 'beto', iniciales: 'B', ciudad: 'Córdoba', intereses: [], foto: '', createdAt: Date.parse('2026-11-05T12:00:00-03:00') });
  put('users/C', { nombre: 'Caro Vieja', usuario: 'caro', iniciales: 'C', ciudad: 'Córdoba', intereses: [], foto: '' });
  return new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://partazy.com/', beforeParse(w){
    if(ahora){ const D = w.Date; w.Date = class extends D { constructor(...a){ super(...(a.length ? a : [ahora])); } static now(){ return ahora; } }; }
    w.firebase = makeFirebase(store, () => ({ uid: 'A', email: 'a@t.com' })); w.navigator.geolocation = undefined;
    w.addEventListener('error', e => console.error('ERROR JS', e.message)); } }).window;
}
(async () => {
  const w = abrir({ nombre: 'Juan', usuario: 'juan', iniciales: 'J', ciudad: 'Córdoba', intereses: [], foto: '', createdAt: Date.parse('2026-10-17T12:00:00-03:00') });
  await sleep(1400); w.cerrarTutorial(); await sleep(150);
  const d = w.document;
  const corte = Date.parse('2026-11-20T00:00:00-03:00');
  ok(w.fundadorAntesDe({ createdAt: corte - 1 }, corte) && !w.fundadorAntesDe({ createdAt: corte }, corte), 'el día que se lance: antes de ese día sí es Fundador, desde ese día ya no');
  ok(w.esFundador({ createdAt: Date.parse('2027-03-01T12:00:00-03:00') }) && w.etapaFundadores(), 'sin fecha de lanzamiento (próximamente): todas las cuentas son Fundadoras');
  ok(w.esFundador({ nombre: 'sin fecha' }), 'los perfiles viejos sin fecha de alta también son Fundadores');
  w.ir('perfil'); await sleep(400);
  ok(/Fundador/.test(d.getElementById('perfil-fundador').textContent), 'en mi perfil aparece la insignia ✦ Fundador');
  w.abrirUsuario('B'); await sleep(500);
  ok(/Fundador/.test(d.querySelector('#pantalla-usuario .perfil-header')?.textContent || ''), 'mientras no hay lanzamiento, las cuentas nuevas también la tienen');
  w.abrirUsuario('C'); await sleep(500);
  ok(/Fundador/.test(d.querySelector('#pantalla-usuario .perfil-header')?.textContent || ''), 'en el perfil de otro Fundador también se ve');
  const aviso = [...d.querySelectorAll('[data-pre-lanzamiento]')];
  ok(aviso.length >= 2 && aviso.every(e => !e.hidden), 'antes del lanzamiento: el aviso "quedás como Fundador" se muestra al registrarse');
  ok(!/2026|octubre|noviembre/.test(aviso.map(e => e.textContent).join(' ')), 'el aviso no muestra ninguna fecha');
  console.log(f ? '\nFALLAS: ' + f : '\nTODO OK'); process.exit(f ? 1 : 0);
})();
