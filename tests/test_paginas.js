// Prueba: páginas públicas con dirección propia (privacidad, términos, soporte, eliminar cuenta, organizadores)
// y que estén al día con los textos de la app.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { generar } = require('../herramientas/generar-paginas.js');
const PUB = path.join(__dirname, '..', 'public');
let f = 0; const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if(!c) f++; };

const esperado = generar();
const nombres = ['privacidad.html', 'terminos.html', 'soporte.html', 'eliminar-cuenta.html', 'organizadores.html', 'lanzamiento.html'];
ok(nombres.every(n => fs.existsSync(path.join(PUB, n))), 'existen las 6 páginas públicas');
ok(nombres.every(n => fs.readFileSync(path.join(PUB, n), 'utf8') === esperado[n]), 'están al día con los textos de la app (si falla: npm run paginas)');

const doc = n => new JSDOM(esperado[n]).window.document;
const priv = doc('privacidad.html');
ok(/Ley 25\.326/.test(priv.body.textContent) && priv.querySelectorAll('.tabla-legal').length === 2, 'privacidad: ley, servicios que usamos y plazos de conservación');
ok(/10 días corridos/.test(priv.body.textContent) && /5 días hábiles/.test(priv.body.textContent), 'privacidad: plazos para responder pedidos');
ok(!priv.querySelector('[onclick]') && priv.querySelector('a[href="mailto:partazycontacto@gmail.com"]'), 'privacidad: sin botones de la app y con el mail de contacto');

const js = fs.readFileSync(path.join(PUB, 'js', 'app.js'), 'utf8');
const preguntas = require('vm').runInNewContext(js.match(/const AYUDA = (\[[\s\S]*?\n\]);/)[1]).reduce((n, [, qs]) => n + qs.length, 0);
const sop = doc('soporte.html');
ok(sop.querySelectorAll('details.faq').length === preguntas && preguntas > 5, `soporte: están las ${preguntas} preguntas frecuentes de la app`);
ok(/48 horas hábiles/.test(sop.body.textContent), 'soporte: dice cómo contactarnos y en cuánto respondemos');

const el = doc('eliminar-cuenta.html');
ok(/ELIMINAR/.test(el.body.textContent) && /Qué se borra/.test(el.body.textContent) && /Qué puede quedar/.test(el.body.textContent), 'eliminar cuenta: pasos, qué se borra y qué queda');

const org = doc('organizadores.html');
ok(org.querySelector('#form-org') && org.querySelector('a[href="/#/crear"]') && org.querySelector('script[src="/js/organizadores.js"]'), 'organizadores: botón para publicar y formulario de contacto');
const todas = nombres.map(doc);
ok(todas.every(d => d.querySelector('.pie a[href="/privacidad"]') && d.querySelector('.pie a[href="/eliminar-cuenta"]') && d.querySelector('.lv-ico')), 'todas tienen el logo nuevo y los links del pie');
ok(!nombres.some(n => esperado[n].includes('juanvalentinlovotti')), 'ninguna página muestra el mail personal');

const lz = doc('lanzamiento.html');
ok(/Próximamente/.test(lz.body.textContent) && !/\d{1,2}\/1[0-2]|octubre|noviembre/i.test(lz.querySelector('main').textContent), 'lanzamiento: dice "Próximamente" sin mostrar la fecha');
ok(lz.querySelector('.fundador a[href="/"]') && lz.querySelector('.lv-anim .lv-ico') && lz.querySelector('a[href="/organizadores"]'), 'lanzamiento: logo animado, invitación a ser Fundador y link para organizadores');
ok(!/solo-post|Date\.parse|¡Ya llegó!/.test(esperado['lanzamiento.html']), 'lanzamiento: no depende de ninguna fecha');
const fb = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'firebase.json'), 'utf8'));
ok(fb.hosting[0].cleanUrls === true, 'firebase: las páginas se abren sin ".html" (partazy.com/privacidad)');

// Formulario de organizadores: guarda en "consultas" con un formato que aceptan las reglas
(async () => {
  const guardados = [];
  const w = new JSDOM(esperado['organizadores.html'], { runScripts: 'outside-only', url: 'https://partazy.com/organizadores' }).window;
  w.firebase = { initializeApp(){}, appCheck: null, firestore: () => ({ collection: c => ({ add: async d => { guardados.push([c, d]); } }) }) };
  w.eval(fs.readFileSync(path.join(PUB, 'js', 'organizadores.js'), 'utf8'));
  const $ = id => w.document.getElementById(id);
  $('o-nombre').value = 'Luna'; $('o-email').value = 'mal'; $('form-org').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await new Promise(r => setTimeout(r, 30));
  ok(!guardados.length && /mail/.test($('o-estado').textContent), 'organizadores: si el mail está mal, avisa y no manda nada');
  $('o-email').value = 'luna@productora.com'; $('o-org').value = 'Productora Luna'; $('o-ciudad').value = 'Córdoba';
  $('form-org').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await new Promise(r => setTimeout(r, 30));
  const [col, d] = guardados[0] || [];
  ok(col === 'consultas' && d.motivo === 'organizacion' && d.uid === '' && typeof d.ts === 'number' && /Productora Luna/.test(d.mensaje)
    && Object.keys(d).sort().join() === 'email,mensaje,motivo,nombre,ts,uid', 'organizadores: el pedido llega a Consultas (motivo organización) con los campos que piden las reglas');
  console.log(f ? '\nFALLAS: ' + f : '\nTODO OK'); process.exit(f ? 1 : 0);
})();
