// Prueba: Notificaciones entre usuarios y recordatorios.
const { JSDOM } = require('jsdom'); const fs = require('fs');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put = (p, v) => store.docs.set(p, v);
const perfil = (uid, nombre, usuario, extra) => {
  put('users/' + uid, { nombre, usuario, iniciales: nombre[0], ciudad: 'Córdoba', intereses: [], foto: '', nombreBusqueda: nombre.toLowerCase(), palabras: nombre.toLowerCase().split(' ').concat([usuario]), ...(extra || {}) });
  put(`users/${uid}/privado/datos`, { nacimiento: '1998-01-01' }); put('usernames/' + usuario, { uid });
};
perfil('A', 'Juan Lovotti', 'juan.lovotti');
perfil('B', 'Sofia Gomez', 'sofi.g');
perfil('O', 'Boliche Vortex', 'vortex.cba', { tipoCuenta: 'organizacion' });
put('admins/A', { rol: 'admin' });
const pronto = Date.now() + 5 * 3600e3;
put('events/priv', { nombre: 'Previa Secreta', creador: 'A', creadorNombre: 'Juan Lovotti', organizador: 'Juan Lovotti', categoria: 'house', tipoLugar: 'Previa', tipo: 'previa',
  privacidad: 'privada', fechaTs: pronto, hora: '23:00', lugar: 'Güemes', lat: -31.42, lng: -64.19, precio: 0, capacidad: 20, confirmadosCount: 1, edadMinima: 18,
  dresscode: 'Libre', musica: 'House', bebida: true, listaVip: false, ambiente: 'verde', ambienteLabel: 'Recién creado', ambienteDesc: '', imagen: '', descripcion: 'x', reglas: 'y', verificado: false });
put('events/priv/attendees/A', { uid: 'A', nombre: 'Juan Lovotti', estado: 'confirmado', ts: 1, ticket: 'PT-A' });

const abrir = uid => new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://partazy-5555d.web.app/',
  beforeParse(w){ w.firebase = makeFirebase(store, () => ({ uid, email: uid + '@t.com' })); w.navigator.geolocation = undefined;
    w.addEventListener('error', e => console.error(`[${uid}] ERROR JS`, e.message)); } }).window;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const txt = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
const act = w => w.document.querySelector('.screen.activa')?.id.replace('pantalla-', '');
const notifs = uid => [...store.docs.entries()].filter(([k]) => k.startsWith(`notificaciones/${uid}/items/`)).map(([, v]) => v);
let fallos = 0; const check = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if(!c) fallos++; };

(async () => {
  const A = abrir('A'), B = abrir('B'); await sleep(250);
  const $A = id => A.document.getElementById(id), $B = id => B.document.getElementById(id);

  // ---------- Buscador de amigos arranca vacío ----------
  B.abrirAmigos(); $B('input-buscar-personas').value = 'juan'; await B.buscarPersonas('juan'); await sleep(30);
  check(txt($B('resultados-personas')).includes('Juan Lovotti'), 'buscar "juan" muestra resultados');
  B.ir('home'); B.abrirAmigos(); await sleep(30);
  check($B('input-buscar-personas').value === '' && txt($B('resultados-personas')) === '', 'al volver a Amigos, el buscador y los resultados quedan vacíos');

  // ---------- Solicitud de amistad → notificación ----------
  await B.buscarPersonas('juan'); await sleep(30);
  B.document.querySelector('[data-amigo-accion="pedir"][data-uid="A"]').click(); await sleep(150);
  check(notifs('A').some(n => n.tipo === 'amistad_solicitud' && n.de === 'B' && n.deNombre === 'Sofia Gomez' && n.leida === false), 'B pide amistad → A recibe la notificación');
  check($A('badge-notif').classList.contains('on') && $A('badge-notif').textContent === '1', 'A ve la campanita con "1"');
  A.abrirNotificaciones(); await sleep(150);
  check(act(A) === 'notificaciones' && txt($A('lista-notificaciones')).includes('Sofia Gomez te mandó una solicitud de amistad'), 'la notificación aparece en la lista');
  check(!!A.document.querySelector('.notif.nueva'), 'resaltada como nueva');
  check(notifs('A').every(n => n.leida) && !$A('badge-notif').classList.contains('on'), 'al abrir, se marcan como leídas y se apaga la campanita');
  A.document.querySelector('[data-notif]').click(); await sleep(60);
  check(act(A) === 'amigos', 'tocarla lleva a Amigos');
  A.document.querySelector('[data-amigo-accion="aceptar"]').click(); await sleep(150);
  check(notifs('B').some(n => n.tipo === 'amistad_aceptada'), 'A acepta → B recibe "aceptó tu solicitud"');

  // ---------- Previa privada: solicitud, aprobación, cancelación ----------
  B.abrirDetalle('priv'); await sleep(120);
  $B('btn-accion-detalle').click(); await sleep(150);
  check(notifs('A').some(n => n.tipo === 'evento_solicitud' && n.objetoId === 'priv'), 'B pide unirse → A recibe "pidió unirse a Previa Secreta"');
  A.abrirDetalle('priv'); await sleep(150);
  A.document.querySelector('[data-solicitud="B"][data-accion="aprobar"]').click(); await sleep(150);
  check(notifs('B').some(n => n.tipo === 'evento_aprobada' && n.objetoNombre === 'Previa Secreta'), 'A aprueba → B recibe "Te aprobaron en Previa Secreta"');
  B.abrirNotificaciones(); await sleep(200);
  check(txt($B('lista-notificaciones')).includes('Hoy: Previa Secreta') || txt($B('lista-notificaciones')).includes('Mañana: Previa Secreta'), 'B ve el recordatorio ⏰ porque la previa empieza en menos de 24 h');
  A.abrirDetalle('priv'); await sleep(150);
  $A('btn-cancelar-evento').click(); await sleep(30);
  const inp = A.document.querySelector('#modal-bg textarea, #modal-bg input'); if(inp) inp.value = 'Se suspende';
  $A('modal-ok').click(); await sleep(250);
  check(notifs('B').some(n => n.tipo === 'evento_cancelado' && n.texto === 'Se suspende'), 'A cancela → B recibe "Se canceló Previa Secreta: Se suspende"');
  check(!notifs('A').some(n => n.tipo === 'evento_cancelado'), 'el organizador no se notifica a sí mismo');

  // ---------- Organización pide verificación ----------
  const O = abrir('O'); await sleep(250);
  const $O = id => O.document.getElementById(id);
  O.ir('perfil'); O.renderPerfilVista(); await sleep(40);
  check(txt($O('perfil-verificacion')).includes('Pedir verificación'), 'una cuenta de organización ve "Pedir verificación" en su perfil');
  check(!txt($A('perfil-verificacion')).includes('Pedir verificación') && txt($A('perfil-verificacion')).includes('¿Organizás eventos?'), 'una persona no ve "Pedir verificación", sino el acceso para pasar a organizador');
  O.abrirVerificacion(); await sleep(20);
  check($O('vf-nombre').value === 'Boliche Vortex' && $O('vf-email').value === 'O@t.com', 'el formulario viene con el nombre y el email');
  await O.enviarVerificacion(); await sleep(20);
  check(txt($O('vf-error')).includes('rubro'), 'pide el rubro');
  $O('vf-rubro').value = 'Boliche'; await O.enviarVerificacion();
  check(txt($O('vf-error')).includes('Instagram'), 'pide Instagram o web');
  $O('vf-instagram').value = '@vortex.cba'; $O('vf-telefono').value = '351 555 1234';
  await O.enviarVerificacion(); await sleep(80);
  const v = store.docs.get('verificaciones/O');
  check(v && v.estado === 'pendiente' && v.rubro === 'Boliche' && v.instagram === '@vortex.cba', 'la solicitud queda guardada como pendiente');
  check(act(O) === 'perfil' && txt($O('perfil-verificacion')).includes('en revisión'), 'el perfil muestra "Verificación en revisión"');
  // Evento de la organización antes de verificarse
  put('events/vx', { nombre: 'Noche Vortex', creador: 'O', creadorNombre: 'Boliche Vortex', organizador: 'Boliche Vortex', categoria: 'techno', tipoLugar: 'Fiesta', tipo: 'fiesta',
    privacidad: 'publica', fechaTs: Date.now() + 3 * 864e5, hora: '23:00', lugar: 'Centro', lat: -31.41, lng: -64.18, precio: 0, capacidad: 300, confirmadosCount: 1, edadMinima: 18,
    dresscode: 'Libre', musica: 'Techno', bebida: false, listaVip: false, ambiente: 'verde', ambienteLabel: 'Recién creado', ambienteDesc: '', imagen: '', descripcion: 'x', reglas: 'y', verificado: false });

  // ---------- Admin aprueba ----------
  A.abrirModeracion(); await sleep(200);
  check(txt($A('lista-verificaciones')).includes('Boliche Vortex') && txt($A('lista-verificaciones')).includes('@vortex.cba'), 'el admin ve el pedido de verificación con los datos');
  check(txt($A('badge-moderacion')) === '1', 'el botón Moderación cuenta el pedido');
  A.document.querySelector('[data-verif="aprobar"][data-uid="O"]').click(); await sleep(30);
  $A('modal-ok').click(); await sleep(250);
  check(store.docs.get('verificaciones/O').estado === 'aprobada' && store.docs.get('users/O').verificado === true, 'aprobada: la cuenta queda verificada');
  check(store.docs.get('events/vx').verificado === true, 'sus eventos existentes también pasan a verificados');
  check(notifs('O').some(n => n.tipo === 'verificacion_aprobada'), 'la organización recibe la notificación');
  const O2 = abrir('O'); await sleep(250);
  O2.ir('perfil'); O2.renderPerfilVista(); await sleep(40);
  check(!!O2.document.querySelector('#perfil-nombre .ins-verif') && txt(O2.document.getElementById('perfil-verificacion')).includes('verificada'), 'su perfil muestra la insignia ✓ y "Organización verificada"');
  B.abrirUsuario('O'); await sleep(100);
  check(!!B.document.querySelector('#usuario-contenido h2 .ins-verif') && txt($B('usuario-contenido')).includes('Organizador de eventos'), 'otros ven la insignia ✓ y "Organizador de eventos"');

  // ---------- Registro como organización ----------
  const N = abrir('N'); await sleep(250);
  const $N = id => N.document.getElementById(id);
  N.document.querySelector('#rg-tipo [data-tipo-cuenta="organizacion"]').click(); await sleep(10);
  check(txt(N.document.querySelector('label[for="rg-nombre"]')) === 'Nombre de la organización' && $N('rg-apodo').closest('.campo').style.display === 'none', 'al elegir "Organizador", el nombre pasa a "Nombre de la organización" y se oculta el apodo');
  $N('rg-nombre').value = 'Productora Luna'; $N('rg-usuario').value = 'productora.luna'; $N('rg-nacimiento').value = '1990-01-01'; $N('rg-normas').checked = true;
  await N.completarRegistro(); await sleep(150);
  check(store.docs.get('users/N')?.tipoCuenta === 'organizacion' && !store.docs.get('users/N')?.verificado, 'se registra como organización (sin verificar todavía)');

  console.log(fallos ? `\n${fallos} FALLOS` : '\nTODO OK'); process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('FALLO', e); process.exit(1); });
