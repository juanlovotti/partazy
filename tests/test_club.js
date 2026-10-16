// Prueba: Cuentas de organización: página pública, seguidores, QR, puerta y prensa.
const { JSDOM } = require('jsdom'); const fs = require('fs');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put = (p, v) => store.docs.set(p, v);
const perfil = (uid, nombre, usuario, extra) => {
  put('users/' + uid, { nombre, usuario, iniciales: nombre[0], ciudad: 'Córdoba', intereses: [], foto: '', nombreBusqueda: nombre.toLowerCase(), palabras: [usuario], ...(extra || {}) });
  put(`users/${uid}/privado/datos`, { nacimiento: '1998-01-01' }); put('usernames/' + usuario, { uid });
};
perfil('O', 'Vortex Club', 'vortex', { tipoCuenta: 'organizacion', verificado: true, bio: 'Techno desde 2019.', direccionPublica: 'Marcelo T. de Alvear 651, Güemes',
  horarios: 'Viernes y sábados de 00 a 06 hs', instagram: '@vortex.cba', web: 'vortex.com.ar', faq: [{ p: '¿Hay guardarropa?', r: 'Sí, en la entrada.' }] });
perfil('B', 'Sofia Gomez', 'sofi.g');
perfil('C', 'Prensa Cba', 'prensacba');
perfil('D', 'Dani Paz', 'danipaz');
put('friendships/B_D', { users: ['B','D'], de: 'B', para: 'D', estado: 'aceptada', ts: 1 });
put('bloqueos/D_C', { de: 'D', a: 'C', ts: 1 });
const ev = (id, o) => put('events/' + id, Object.assign({ nombre: id, creador: 'O', creadorNombre: 'Vortex Club', organizador: 'Vortex Club', categoria: 'techno', tipoLugar: 'Fiesta', tipo: 'fiesta',
  privacidad: 'publica', fechaTs: Date.now() + 3 * 864e5, hora: '23:30', lugar: 'Güemes', lat: -31.42, lng: -64.19, precio: 0, capacidad: 100, confirmadosCount: 1, edadMinima: 18,
  dresscode: 'Libre', musica: 'Techno', bebida: false, listaVip: false, ambiente: 'verde', ambienteLabel: 'Recién creado', ambienteDesc: '', imagen: '', descripcion: 'x', reglas: 'y',
  verificado: true, conQR: true, deOrganizacion: true }, o));
ev('casiLleno', { nombre: 'Casi Lleno', capacidad: 100, confirmadosCount: 90 });
ev('lleno', { nombre: 'Agotadisimo', capacidad: 50, confirmadosCount: 50, fechaTs: Date.now() + 10 * 864e5 });
ev('pronto', { nombre: 'Muy Pronto', fechaTs: Date.now() + 10 * 3600e3 });

const usuarios = {};
const abrir = (uid, hash) => {
  usuarios[uid] = { uid, email: uid + '@t.com', providerData: [], borrado: false, delete: async function(){ this.borrado = true; } };
  return new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://partazy.web.app/' + (hash || ''),
    beforeParse(w){ w.firebase = makeFirebase(store, () => usuarios[uid]); w.navigator.geolocation = undefined;
      w.QRCode = function(el){ el.innerHTML = '<img alt="qr">'; }; w.QRCode.CorrectLevel = { M: 0 };
      w.abiertos = []; w.open = (u) => { w.abiertos.push(u); return null; };
      w.addEventListener('error', e => console.error(`[${uid}] ERROR JS`, e.message)); } }).window;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const txt = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
const act = w => w.document.querySelector('.screen.activa')?.id.replace('pantalla-', '');
const notifs = uid => [...store.docs.entries()].filter(([k]) => k.startsWith(`notificaciones/${uid}/items/`)).map(([, v]) => v);
let fallos = 0; const check = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if(!c) fallos++; };

(async () => {
  const O = abrir('O'), B = abrir('B'); await sleep(300);
  const $O = id => O.document.getElementById(id), $B = id => B.document.getElementById(id);

  // ---------- Página de organización ----------
  B.abrirUsuario('O'); await sleep(120);
  const pag = txt($B('usuario-contenido'));
  check(pag.includes('Techno desde 2019.') && pag.includes('Marcelo T. de Alvear 651') && pag.includes('Viernes y sábados'), 'página de organización: descripción, dirección y horarios');
  const links = [...B.document.querySelectorAll('#usuario-contenido a.link-ext')].map(a => a.href);
  check(links.some(h => h.startsWith('https://www.google.com/maps/dir/')) && links.includes('https://instagram.com/vortex.cba') && links.some(h => h.startsWith('https://vortex.com.ar')), '"Cómo llegar" (Google Maps), Instagram y web como links');
  check(B.document.querySelectorAll('#usuario-contenido details.faq').length === 1 && pag.includes('¿Hay guardarropa?'), 'preguntas frecuentes propias de la organización');
  check(pag.includes('Agenda · próximas fechas') && pag.includes('Casi Lleno'), 'agenda con sus próximas fechas');

  // ---------- Seguir ----------
  B.document.querySelector('[data-seguir="O"]').click(); await sleep(150);
  check(store.docs.has('seguidores/O/fans/B') && store.docs.get('users/O').seguidores === 1, 'Seguir: se guarda el seguidor y el contador pasa a 1');
  check(txt($B('usuario-contenido')).includes('Siguiendo ✓') && txt($B('usuario-contenido')).includes('1 seguidor'), 'el botón pasa a "Siguiendo ✓" y muestra "1 seguidor"');

  // ---------- Organización publica → aviso a seguidores; evento completo ----------
  O.ir('crear');
  const f = new Date(Date.now() + 9 * 864e5);
  $O('f-nombre').value = 'Noche Larga'; $O('f-lugar').value = 'Güemes'; $O('f-fecha').value = f.toISOString().slice(0, 10); $O('f-hora').value = '23:30';
  $O('f-hora-fin').value = '05:00'; $O('f-capacidad').value = '300'; $O('f-edad').value = '0'; $O('f-estilo').value = 'techno';
  $O('f-lineup').value = '23:30 DJ Apertura\n02:00 Headliner Invitado';
  O.toggleSwitchPago($O('switch-pago')); $O('f-precio').value = '7000'; $O('f-link-entradas').value = 'https://alpogo.com/evento/noche-larga';
  await (async()=>{const c=O.confirmar; O.confirmar=async()=>true; O.mostrarVistaPrevia=async()=>true; try{await O.publicarEvento();}finally{O.confirmar=c;}})(); await sleep(200);
  const [kNL, nl] = [...store.docs.entries()].find(([k, v]) => /^events\/[^/]+$/.test(k) && v.nombre === 'Noche Larga');
  check(nl.lineup.includes('Headliner') && nl.horaFin === '05:00' && nl.linkEntradas === 'https://alpogo.com/evento/noche-larga' && nl.deOrganizacion === true && nl.edadMinima === 0, 'el evento se guarda con line-up, cierre, link de venta y ATP');
  check(notifs('B').some(n => n.tipo === 'nuevo_evento' && n.objetoNombre === 'Noche Larga'), 'la seguidora recibe "Vortex Club publicó una fecha nueva: Noche Larga"');
  const idNL = kNL.split('/')[1];
  B.abrirDetalle(idNL); await sleep(200);
  const det = txt($B('detalle-contenido'));
  check(det.includes('a 05:00 hs') && det.includes('ATP (todo público)'), 'detalle: horario con cierre y clasificación ATP');
  check(B.document.querySelectorAll('.lineup-item').length === 2 && txt(B.document.querySelector('.lineup-item .hora')) === '23:30', 'detalle: line-up con horarios');
  check(!!B.document.querySelector('#detalle-contenido a.link-ext[href^="https://www.google.com/maps"]'), 'detalle: "Cómo llegar"');
  check(txt($B('btn-accion-detalle')) === 'Comprar en alpogo.com ↗', 'botón principal: "Comprar en alpogo.com ↗"');
  $B('btn-accion-detalle').click(); await sleep(30);
  check(B.abiertos[0] === 'https://alpogo.com/evento/noche-larga', 'tocarlo abre la venta externa');

  // ---------- Cupo y agenda en Inicio ----------
  B.ir('home'); B.renderHome(); await sleep(30);
  const semana = txt($B('lista-semana')), viene = txt($B('lista-viene'));
  check(semana.includes('Casi Lleno') && !semana.includes('Últimas entradas'), '"Esta semana" muestra el evento (tarjeta limpia, sin carteles)');
  check(viene.includes('Agotadisimo'), '"Lo que viene" muestra los de más adelante');
  check(!semana.includes('Muy Pronto'), 'lo de esta noche no se repite en "Esta semana"');

  // ---------- Control de puerta ----------
  B.abrirDetalle('casiLleno'); await sleep(150);
  $B('btn-accion-detalle').click(); await sleep(250);
  const ticket = store.docs.get('events/casiLleno/attendees/B').ticket;
  put('events/casiLleno/attendees/E', { uid: 'E', nombre: 'Ezequiel Ruiz', estado: 'confirmado', ts: 2, ticket: 'PT-EEEEEEEEEE' });
  O.abrirDetalle('casiLleno'); await sleep(200);
  check(!!$O('btn-puerta'), 'el organizador ve "🚪 Control de puerta"');
  $O('btn-puerta').click(); await sleep(150);
  check(act(O) === 'puerta' && txt($O('puerta-contador')).includes('0') && txt($O('puerta-contador')).includes('de 2'), 'pantalla de puerta: "0 de 2 ingresaron"');
  await O.validarCodigo(`PARTAZY|casiLleno|${ticket}`); await sleep(50);
  check($O('puerta-resultado').classList.contains('ok') && txt($O('puerta-resultado')).includes('Puede pasar: Sofia Gomez'), 'escaneo válido: "✓ Puede pasar"');
  check(!!store.docs.get('events/casiLleno/attendees/B').checkinTs && txt($O('puerta-contador')).startsWith('1'), 'se registra el ingreso y el contador sube');
  await O.validarCodigo(`PARTAZY|casiLleno|${ticket}`); await sleep(50);
  check($O('puerta-resultado').classList.contains('aviso') && txt($O('puerta-resultado')).includes('ya ingresó'), 'el mismo código otra vez: "ya ingresó" (un solo uso)');
  await O.validarCodigo('PT-NOEXISTE'); await sleep(20);
  check($O('puerta-resultado').classList.contains('mal'), 'código inventado: rechazado');
  await O.validarCodigo(`PARTAZY|otroEvento|${ticket}`); await sleep(20);
  check(txt($O('puerta-resultado')).includes('otro evento'), 'entrada de otro evento: rechazada');
  O.document.querySelector('[data-checkin="E"]').click(); await sleep(80);
  check(!!store.docs.get('events/casiLleno/attendees/E').checkinTs && txt($O('puerta-contador')).startsWith('2'), 'también se puede marcar el ingreso a mano desde la lista (2 de 2)');

  // ---------- Acreditación de prensa ----------
  const C = abrir('C'); await sleep(300);
  const $C = id => C.document.getElementById(id);
  C.abrirDetalle('casiLleno'); await sleep(200);
  check(!!$C('btn-acreditacion'), 'en un evento de organización aparece "Pedir acreditación de prensa"');
  $C('btn-acreditacion').click(); await sleep(20);
  $C('ac-ok').click(); await sleep(20);
  check(txt($C('ac-error')).includes('medio'), 'pide el nombre del medio');
  $C('ac-medio').value = 'Radio Nocturna'; $C('ac-rol').value = 'Fotografía'; $C('ac-ok').click(); await sleep(200);
  check(store.docs.get('events/casiLleno/acreditaciones/C')?.estado === 'pendiente', 'el pedido queda pendiente');
  check(notifs('O').some(n => n.tipo === 'acreditacion_solicitud'), 'la organización recibe el aviso');
  check(txt($C('detalle-contenido')).includes('Acreditación en revisión'), 'el periodista ve "Acreditación en revisión"');
  O.abrirDetalle('casiLleno'); await sleep(250);
  O.document.querySelector('[data-acred="aprobar"][data-uid="C"]').click(); await sleep(250);
  check(store.docs.get('events/casiLleno/acreditaciones/C').estado === 'aprobada' && notifs('C').some(n => n.tipo === 'acreditacion_aprobada'), 'la organización aprueba y le avisa');
  C.abrirDetalle('casiLleno'); await sleep(200);
  check(txt($C('detalle-contenido')).includes('Acreditación aprobada'), 'el periodista ve "✓ Acreditación aprobada"');
  C.abrirDetalle('pronto'); await sleep(200);
  check(txt($C('detalle-contenido')).includes('cierran 24 h antes') && !$C('btn-acreditacion'), 'a menos de 24 h: "las acreditaciones cierran 24 h antes"');

  // ---------- Edición de la página de organización ----------
  O.ir('perfil'); O.renderPerfilVista(); await sleep(30);
  check($O('btn-mi-pagina').style.display !== 'none', 'la organización ve "Ver mi página pública"');
  O.editarPerfil(); await sleep(20);
  check($O('ep-org').style.display === 'flex' && $O('ep-bio').value === 'Techno desde 2019.', 'Editar perfil muestra la sección "Página de tu organización" con sus datos');
  $O('ep-faq-p1').value = '¿Se puede reingresar?'; $O('ep-faq-r1').value = 'No.';
  await O.guardarPerfil(); await sleep(100);
  check(store.docs.get('users/O').faq.length === 2, 'guarda las preguntas frecuentes');

  // ---------- Ayuda y privacidad ----------
  B.abrirAyuda(); await sleep(20);
  check(act(B) === 'ayuda' && B.document.querySelectorAll('#lista-ayuda details.faq').length >= 15 && txt($B('lista-ayuda')).includes('sistema seguro'), 'Ayuda: preguntas frecuentes de Partazy');
  B.abrirPrivacidad(); await sleep(20);
  check(act(B) === 'privacidad' && txt($B('pantalla-privacidad')).includes('Ley 25.326'), 'Privacidad: política con la Ley 25.326');

  // ---------- Eliminar cuenta ----------
  put('notificaciones/D/items/x1', { tipo: 'amistad_solicitud', de: 'B', deNombre: 'Sofi', leida: false, ts: 1 });
  const D = abrir('D'); await sleep(300);
  const $D = id => D.document.getElementById(id);
  D.ir('perfil');
  const p = D.eliminarCuenta(); await sleep(30);
  $D('modal-ok').click(); await sleep(30);
  $D('modal-input').value = 'eliminar'; $D('modal-ok').click(); await sleep(300);
  await p;
  check(!store.docs.has('users/D') && !store.docs.has('users/D/privado/datos') && !store.docs.has('usernames/danipaz'), 'eliminar cuenta: borra perfil, datos privados y @usuario');
  check(!store.docs.has('friendships/B_D') && !store.docs.has('bloqueos/D_C') && !store.docs.has('notificaciones/D/items/x1'), 'también amistades, bloqueos y notificaciones');
  check(usuarios.D.borrado === true, 'y la cuenta de inicio de sesión');

  console.log(fallos ? `\n${fallos} FALLOS` : '\nTODO OK'); process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('FALLO', e); process.exit(1); });
