// Prueba: "Empezar" en el registro no se traba si quedaron restos de un intento anterior
// (el @usuario ya reservado a su nombre, la parte privada ya creada) o si el perfil ya estaba guardado.
// La base falsa imita las reglas de Firestore que importan acá: no se pisa un @usuario existente,
// no se cambia la fecha de nacimiento y no se vuelve a "crear" un perfil que ya existe.
const { JSDOM } = require('jsdom');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
let f = 0; const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if(!c) f++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const negar = p => { const e = new Error('Missing or insufficient permissions. ' + p); e.code = 'permission-denied'; throw e; };
function reglas(path, nuevo, viejo, opt){
  if(/^usernames\//.test(path) && viejo) negar(path);                                   // update de @usuario: prohibido
  if(/\/privado\/datos$/.test(path) && viejo && nuevo.nacimiento !== viejo.nacimiento) negar(path);
  if(/^users\/[^/]+$/.test(path) && viejo && !opt?.merge && nuevo.createdAt !== viejo.createdAt) negar(path);
}
function abrir(store, uid){
  return new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://partazy.com/',
    beforeParse(w){ w.firebase = makeFirebase(store, () => ({ uid, email: uid + '@t.com', displayName: 'Lu Ferreyra' }));
      w.navigator.geolocation = undefined; } }).window;
}
async function llenar(w){
  const $ = id => w.document.getElementById(id);
  await sleep(450);
  $('rg-nacimiento').value = '2000-04-02'; $('rg-normas').checked = true;
  await w.completarRegistro(); await sleep(250);
  return { $, pantalla: (w.document.querySelector('.screen.activa')?.id || '').replace('pantalla-', '') };
}

(async () => {
  // 1) Quedó reservado su @usuario (y su parte privada con otra fecha) de un intento anterior
  let store = crearStore(); store.reglas = reglas;
  store.docs.set('usernames/lu.ferreyra', { uid: 'L', ts: 1 });
  store.docs.set('users/L/privado/datos', { nacimiento: '2000-04-01' });
  let w = abrir(store, 'L'); await sleep(250);
  ok((w.document.querySelector('.screen.activa')?.id || '') === 'pantalla-registro', 'cuenta sin perfil: muestra el registro');
  ok(w.document.getElementById('rg-usuario').value === 'lu.ferreyra', 'sugiere el mismo @usuario que ya tenía reservado');
  let r = await llenar(w);
  ok(store.docs.get('users/L')?.usuario === 'lu.ferreyra', 'con restos de un intento anterior igual crea el perfil');
  ok(store.docs.get('users/L/privado/datos')?.nacimiento === '2000-04-01' && !!store.docs.get('users/L/privado/datos')?.aceptoNormasTs, 'no intenta cambiar la fecha de nacimiento guardada');
  ok(r.pantalla === 'home', 'entra a la app');

  // 2) El perfil ya estaba guardado (por ejemplo, el celu no lo encontró sin conexión): entra directo, sin error
  store = crearStore(); store.reglas = reglas;
  w = abrir(store, 'M'); await sleep(250);
  store.docs.set('users/M', { nombre: 'Lu Ferreyra', usuario: 'lu.f', iniciales: 'LF', intereses: [], foto: '', createdAt: 123 });
  store.docs.set('users/M/privado/datos', { nacimiento: '1999-01-01' });
  store.docs.set('usernames/lu.f', { uid: 'M' });
  r = await llenar(w);
  ok(r.pantalla === 'home' && !r.$('rg-error').textContent, 'si el perfil ya existe, entra a la app en vez de decir "No pudimos guardar"');
  ok(store.docs.get('users/M').createdAt === 123 && store.docs.get('users/M').usuario === 'lu.f', 'no pisa el perfil que ya existía');

  // 3) Un error real muestra el código, para saber qué pasó
  store = crearStore(); store.reglas = (p) => { if(/^users\/[^/]+$/.test(p)) negar(p); };
  w = abrir(store, 'N'); await sleep(250);
  r = await llenar(w);
  ok(/No pudimos guardar tu perfil/.test(r.$('rg-error').textContent) && /permission-denied/.test(r.$('rg-error').textContent), 'si falla de verdad, avisa con el código del error');
  ok(!store.docs.has('usernames/lu.ferreyra') && !store.docs.has('users/N/privado/datos'), 'si falla, no deja nada a medias (todo o nada)');

  // 4) Registro normal sigue igual
  store = crearStore(); store.reglas = reglas;
  w = abrir(store, 'P'); await sleep(250);
  r = await llenar(w);
  ok(store.docs.get('usernames/lu.ferreyra')?.uid === 'P' && store.docs.get('users/P')?.nombre === 'Lu Ferreyra' && r.pantalla === 'home', 'registro normal: reserva el @usuario, crea el perfil y entra');

  console.log(f ? '\nFALLAS: ' + f : '\nTODO OK'); process.exit(f ? 1 : 0);
})();
