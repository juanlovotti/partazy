// Prueba: Registro, @usuario, denuncias, bloqueos y panel de moderación.
const { JSDOM } = require('jsdom'); const fs = require('fs');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put = (p, v) => store.docs.set(p, v);
const futuro = Date.now() + 2 * 864e5;
put('users/A', { nombre: 'Juan Lovotti', usuario: 'juan.lovotti', iniciales: 'JL', ciudad: 'Güemes', intereses: [], foto: '', nombreBusqueda: 'juan lovotti', palabras: ['juan','lovotti','juan.lovotti'] });
put('users/A/privado/datos', { nacimiento: '2000-03-10' });
put('usernames/juan.lovotti', { uid: 'A' });
put('users/B', { nombre: 'Sofía Gómez', usuario: 'sofi.g', apodo: 'Sofi', iniciales: 'S', ciudad: 'Nueva Córdoba', intereses: [], foto: '', nombreBusqueda: 'sofia gomez', palabras: ['sofia','gomez','sofi','sofi.g'] });
put('users/B/privado/datos', { nacimiento: '1999-05-01' });
put('usernames/sofi.g', { uid: 'B' });
put('users/D', { nombre: 'Dani Paz', iniciales: 'DP', ciudad: 'Centro', intereses: [], foto: '', nombreBusqueda: 'dani paz', palabras: ['dani','paz'] });
put('users/D/privado/datos', { nacimiento: '1998-01-01' });
put('friendships/A_B', { users: ['A','B'], de: 'A', para: 'B', estado: 'aceptada', ts: 1 });
put('events/ev1', { nombre: 'Fiesta de Juan', creador: 'A', creadorNombre: 'Juan Lovotti', organizador: 'Juan Lovotti', categoria: 'techno', tipoLugar: 'Fiesta', tipo: 'fiesta',
  privacidad: 'publica', fechaTs: futuro, hora: '23:00', lugar: 'Güemes', lat: -31.42, lng: -64.19, precio: 0, capacidad: 50, confirmadosCount: 1, edadMinima: 18,
  dresscode: 'Libre', musica: 'Techno', bebida: false, listaVip: false, ambiente: 'verde', ambienteLabel: 'Recién creado', ambienteDesc: '', imagen: '', descripcion: 'x', reglas: 'y' });

const abrir = (uid, extra) => new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://partazy-5555d.web.app/',
  beforeParse(w){ w.firebase = makeFirebase(store, () => uid ? ({ uid, email: uid + '@t.com', displayName: (extra || {}).displayName || '' }) : null);
    w.navigator.geolocation = undefined; w.addEventListener('error', e => console.error(`[${uid}] ERROR JS`, e.message)); } }).window;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const txt = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
const act = w => w.document.querySelector('.screen.activa')?.id.replace('pantalla-', '');
let fallos = 0; const check = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if(!c) fallos++; };

(async () => {
  // ---------- Bienvenida animada ----------
  const N = abrir(null); await sleep(300); N.irALogin('ingresar'); await sleep(150);
  const logo = N.document.querySelector('#pantalla-bienvenida .lv-login');
  check(act(N) === 'bienvenida' && N.document.body.classList.contains('modo-invitado') && logo && logo.querySelector('.lv-ico') && logo.querySelector('.lv-txt').textContent === 'artazy' && logo.getAttribute('aria-label') === 'PARTAZY', 'sin cuenta mira la app; al ir a ingresar: el logo nuevo animado');
  check(N.document.querySelectorAll('.eq i').length === 9, 'bienvenida: ecualizador de 9 barras');

  // ---------- Registro con @usuario, apodo y normas ----------
  const C = abrir('C', { displayName: 'Juan Lovotti' }); await sleep(200);
  const $C = id => C.document.getElementById(id);
  check(act(C) === 'registro', 'usuario nuevo: pantalla de registro');
  check($C('rg-usuario').value === 'juan.lovotti', 'sugiere @usuario a partir del nombre (juan.lovotti)');
  await sleep(450);
  check(txt($C('rg-usuario-estado')).includes('ya está en uso'), 'avisa que @juan.lovotti ya está en uso');
  $C('rg-usuario').value = 'Juan Cito!!'; $C('rg-usuario').dispatchEvent(new C.Event('input')); await sleep(450);
  check($C('rg-usuario').value === 'juancito' && txt($C('rg-usuario-estado')).includes('disponible'), 'limpia lo escrito ("Juan Cito!!" → juancito) y confirma que está libre');
  $C('rg-nacimiento').value = '2001-06-15'; $C('rg-apodo').value = 'Juanchi';
  await C.completarRegistro(); await sleep(50);
  check(txt($C('rg-error')).includes('normas de la comunidad'), 'sin aceptar las normas, no deja registrarse');
  $C('btn-ver-normas').click(); await sleep(20);
  check(txt($C('modal-texto')).includes('Sin desnudez'), 'se pueden leer las normas de la comunidad');
  $C('modal-ok').click(); await sleep(10);
  $C('rg-normas').checked = true;
  await C.completarRegistro(); await sleep(150);
  check(store.docs.get('usernames/juancito')?.uid === 'C' && store.docs.get('users/C')?.usuario === 'juancito' && store.docs.get('users/C')?.apodo === 'Juanchi', 'registra y reserva @juancito, con apodo "Juanchi"');
  check(!!store.docs.get('users/C/privado/datos')?.aceptoNormasTs, 'guarda la aceptación de las normas');
  await sleep(600); check($C('tutorial').classList.contains('show'), 'cuenta nueva: el tutorial sale solo la primera vez'); C.cerrarTutorial(); await sleep(20);
  C.ir('perfil'); await sleep(20);
  check(txt($C('perfil-nombre')) === 'Juanchi' && txt($C('perfil-handle')) === '@juancito', 'perfil muestra el apodo y el @usuario');

  // Cambiar @usuario
  C.editarPerfil(); await sleep(20);
  $C('ep-usuario').value = 'juanchi.cba'; await C.guardarPerfil(); await sleep(80);
  check(store.docs.get('usernames/juanchi.cba')?.uid === 'C' && !store.docs.has('usernames/juancito'), 'al cambiar el @usuario, reserva el nuevo y libera el viejo');

  // ---------- Búsqueda por @usuario y apodo ----------
  C.abrirAmigos(); await sleep(30);
  await C.buscarPersonas('@sofi'); await sleep(30);
  check(txt($C('resultados-personas')).includes('Sofi') && txt($C('resultados-personas')).includes('@sofi.g'), 'buscar "@sofi" encuentra a Sofi (@sofi.g)');

  // ---------- Denuncias de un evento (3 personas → se oculta) ----------
  const B = abrir('B'); await sleep(200);
  const $B = id => B.document.getElementById(id);
  B.abrirDetalle('ev1'); await sleep(100);
  check(!!$B('btn-denunciar-evento'), 'en un evento ajeno aparece "Denunciar este evento"');
  $B('btn-denunciar-evento').click(); await sleep(20);
  check($B('modal-denuncia').classList.contains('show') && B.document.querySelectorAll('#den-motivos input').length === 10, 'se abre el formulario con 10 motivos');
  $B('den-ok').click(); await sleep(20);
  check(txt($B('den-error')) === 'Elegí un motivo.', 'sin motivo no se envía');
  B.document.querySelector('#den-motivos input[value="sexual"]').checked = true;
  $B('den-detalle').value = 'la foto es explícita';
  $B('den-ok').click(); await sleep(80);
  const rep = store.docs.get('reports/evento_ev1_B');
  check(rep && rep.motivo === 'sexual' && rep.estado === 'pendiente' && store.docs.get('events/ev1').denuncias === 1, 'denuncia guardada (reports/evento_ev1_B) y contador del evento en 1');
  // Otras dos denuncias
  for(const [u, m] of [['C', 'estafa'], ['D', 'sexual']]){
    put(`reports/evento_ev1_${u}`, { tipo: 'evento', objetoId: 'ev1', autor: 'A', motivo: m, reportante: u, estado: 'pendiente', ts: Date.now(), objetoNombre: 'Fiesta de Juan' });
  }
  store.docs.get('events/ev1').denuncias = 3;
  const B2 = abrir('B'); await sleep(200);
  check(!txt(B2.document.getElementById('lista-cerca')).includes('Fiesta de Juan'), 'con 3 denuncias, el evento desaparece de las listas');
  B2.abrirDetalle('ev1'); await sleep(100);
  check(txt(B2.document.getElementById('detalle-contenido')).includes('en revisión'), 'y su detalle dice "en revisión"');

  // ---------- Panel de moderación (A es admin) ----------
  put('admins/A', { rol: 'admin' });
  const A = abrir('A'); await sleep(250);
  const $A = id => A.document.getElementById(id);
  check($A('btn-moderacion').style.display !== 'none', 'el admin ve el botón "Moderación"');
  check(txt(A.document.getElementById('lista-cerca')).includes('Fiesta de Juan'), 'el creador/admin sigue viendo su evento');
  A.abrirModeracion(); await sleep(100);
  check(txt($A('lista-reportes')).includes('Fiesta de Juan') && txt($A('lista-reportes')).includes('3 denuncias'), 'el panel agrupa las 3 denuncias del evento');
  check(txt($A('lista-reportes')).includes('Desnudez o contenido sexual ×2') && txt($A('lista-reportes')).includes('la foto es explícita'), 'muestra motivos con cantidad y los comentarios');
  A.document.querySelector('[data-mod="desestimar"]').click(); await sleep(20);
  $A('modal-ok').click(); await sleep(120);
  check(store.docs.get('events/ev1').denuncias === 0 && store.docs.get('reports/evento_ev1_B').estado === 'resuelto', 'desestimar: el evento vuelve a mostrarse y las denuncias quedan resueltas');
  check(txt($A('lista-reportes')).includes('No hay denuncias pendientes'), 'el panel queda vacío');

  // ---------- Denunciar un mensaje ----------
  B.abrirDM('A'); await sleep(80);
  put('dms/A_B/mensajes/m1', { de: 'A', tipo: 'texto', texto: 'mensaje feo', ts: Date.now() });
  store.listeners.forEach(l => l()); await sleep(80);
  B.document.querySelector('#dm-mensajes [data-msg="m1"]').click(); await sleep(30);
  check(txt($B('modal-texto')).includes('mensaje feo'), 'tocar un mensaje ajeno ofrece denunciarlo');
  $B('modal-ok').click(); await sleep(60);
  B.document.querySelector('#den-motivos input[value="acoso"]').checked = true;
  $B('den-ok').click(); await sleep(100);
  const rm = store.docs.get('reports/mensaje_m1_B');
  check(rm && rm.texto === 'mensaje feo' && rm.autor === 'A' && rm.ambito === 'dm', 'la denuncia guarda una copia del mensaje para que la revise el admin');
  await sleep(450);
  check(txt($B('modal-titulo')).includes('bloquear'), 'después de denunciar, ofrece bloquear a la persona');
  $B('modal-cancelar').click(); await sleep(10);

  // ---------- Bloquear ----------
  B.abrirUsuario('A'); await sleep(80);
  B.document.querySelector('[data-bloquear="A"]').click(); await sleep(40);
  $B('modal-ok').click(); await sleep(150);
  check(store.docs.get('bloqueos/B_A')?.a === 'A' && !store.docs.has('friendships/A_B'), 'bloquear: se guarda el bloqueo y se elimina la amistad');
  check(txt($B('usuario-contenido')).includes('Bloqueaste a esta persona') && !!B.document.querySelector('[data-desbloquear="A"]'), 'el perfil muestra "Bloqueaste a esta persona" y "Desbloquear"');
  B.ir('home'); B.renderHome(); await sleep(20);
  check(!txt($B('lista-cerca')).includes('Fiesta de Juan'), 'B deja de ver los eventos de quien bloqueó');
  B.abrirAmigos(); await sleep(80);
  check(txt($B('bloque-bloqueados')).includes('Juan Lovotti'), 'Amigos → "Personas bloqueadas" lo lista');
  B.document.querySelector('#bloque-bloqueados [data-desbloquear="A"]').click(); await sleep(120);
  check(!store.docs.has('bloqueos/B_A'), 'desbloquear funciona');

  // ---------- Suspensión ----------
  A.abrirUsuario('D'); await sleep(60);
  store.docs.get('users/D').suspendido = true;
  const D = abrir('D'); await sleep(200);
  check(act(D) === 'suspendido' && D.document.getElementById('app').classList.contains('sin-nav'), 'una cuenta suspendida ve solo la pantalla "Cuenta suspendida"');

  // ---------- Umbral del filtro de fotos ----------
  const F = C.eval('FiltroFotos');
  check(F.esInapropiada({ porno: .7, hentai: 0, sexy: .1 }) && F.esInapropiada({ porno: .2, hentai: .35, sexy: 0 }) && F.esInapropiada({ porno: 0, hentai: 0, sexy: .85 }), 'filtro: bloquea porno/hentai ≥ 50% y "sexy" ≥ 80%');
  check(!F.esInapropiada({ porno: .05, hentai: .02, sexy: .4 }), 'filtro: deja pasar fotos normales de fiesta');

  console.log(fallos ? `\n${fallos} FALLOS` : '\nTODO OK'); process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('FALLO', e); process.exit(1); });
