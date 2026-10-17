// Prueba: Entradas con QR y control de puerta.
const { JSDOM } = require('jsdom'); const fs = require('fs');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put = (p, v) => store.docs.set(p, v);
const perfil = (uid, nombre, usuario, extra) => {
  put('users/' + uid, { nombre, usuario, iniciales: nombre[0], ciudad: 'Córdoba', intereses: [], foto: '', nombreBusqueda: nombre.toLowerCase(), palabras: [usuario], ...(extra || {}) });
  put(`users/${uid}/privado/datos`, { nacimiento: '1998-01-01' }); put('usernames/' + usuario, { uid });
};
perfil('P', 'Juan Lovotti', 'juan.lovotti');
perfil('B', 'Sofia Gomez', 'sofi.g');
const abrir = uid => new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://partazy.web.app/',
  beforeParse(w){ w.firebase = makeFirebase(store, () => ({ uid, email: uid + '@t.com' })); w.navigator.geolocation = undefined;
    w.QRCode = function(el){ el.innerHTML = '<img alt="qr">'; }; w.QRCode.CorrectLevel = { M: 0 };
    w.addEventListener('error', e => console.error(`[${uid}] ERROR JS`, e.message)); } }).window;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const txt = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
let fallos = 0; const check = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if(!c) fallos++; };
const crearEvento = async (w, nombre, conPago) => {
  const $ = id => w.document.getElementById(id);
  w.ir('crear');
  $('f-nombre').value = nombre; $('f-lugar').value = 'Güemes'; $('f-fecha').value = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  $('f-hora').value = '23:00'; $('f-capacidad').value = '100'; $('f-estilo').value = 'techno';
  if(conPago){ w.toggleSwitchPago($('switch-pago')); $('f-precio').value = '5000'; $('f-pago-info').value = 'Transferencia al alias vortex.cba'; }
  const c0 = w.confirmar; w.confirmar = async () => true; w.mostrarVistaPrevia=async()=>true; try{ await w.publicarEvento(); } finally { w.confirmar = c0; } await sleep(100);
  return [...store.docs.entries()].find(([k, v]) => /^events\/[^/]+$/.test(k) && v.nombre === nombre);
};

(async () => {
  const P = abrir('P'); await sleep(250);
  const $P = id => P.document.getElementById(id);
  // Persona: ve el acceso a organizador, no el interruptor de QR
  P.ir('perfil'); P.renderPerfilVista(); await sleep(30);
  check(txt($P('perfil-verificacion')).includes('¿Organizás eventos?'), 'una persona ve "¿Organizás eventos? Pasá a cuenta de organizador"');
  P.ir('crear'); P.actualizarFilaQR && P.actualizarFilaQR();
  check($P('fila-qr').style.display === 'none', 'una persona no ve la opción "Entradas con QR" al crear');
  const [idPersona, evPersona] = await crearEvento(P, 'Previa de Juan', false);
  check(evPersona.conQR !== true, 'el evento de una persona se publica sin QR');

  // Pasa a organizador
  P.ir('perfil'); P.renderPerfilVista(); await sleep(20);
  P.document.querySelector('#perfil-verificacion button').click(); await sleep(30);
  check($P('form-perfil').style.display === 'flex' && P.document.querySelector('#ep-tipo [data-tipo-cuenta="organizacion"]').classList.contains('activo'), 'el botón abre Editar perfil con "Organizador" ya elegido');
  $P('ep-nombre').value = 'Vortex Club';
  await P.guardarPerfil(); await sleep(80);
  check(store.docs.get('users/P').tipoCuenta === 'organizacion', 'al guardar, la cuenta pasa a organizador');
  check(txt($P('perfil-verificacion')).includes('Pedir verificación'), 'y aparece la tarjeta "Pedir verificación"');

  // Organizador: ve el interruptor de QR y publica evento pago con alias
  P.ir('crear'); P.actualizarFilaQR && P.actualizarFilaQR();
  check($P('fila-qr').style.display === 'flex' && $P('switch-qr').classList.contains('on'), 'como organizador ve "Entradas con QR", activado por defecto');
  const [idOrg, evOrg] = await crearEvento(P, 'Noche Vortex', true);
  check(evOrg.conQR === true && evOrg.pagoInfo === 'Transferencia al alias vortex.cba', 'el evento se publica con QR y con el alias');

  // Otra persona lo ve y reserva
  const B = abrir('B'); await sleep(250);
  const $B = id => B.document.getElementById(id);
  B.abrirDetalle(idOrg.split('/')[1]); await sleep(150);
  check(txt($B('detalle-contenido')).includes('Transferencia al alias vortex.cba'), 'en el detalle se ve el alias para transferir');
  $B('btn-accion-detalle').click(); await sleep(30);
  check(txt($B('modal-texto')).includes('vortex.cba'), 'al reservar, el aviso repite cómo pagar');
  $B('modal-ok').click(); await sleep(250);
  check(!!B.document.querySelector('#qr-target') && txt($B('ticket-contenido')).includes('Entrada digital'), 'la entrada de un organizador tiene QR');
  check(txt($B('ticket-contenido')).includes('vortex.cba'), 'y en la entrada también se ve el alias');

  // Evento de persona: confirmar no da QR
  B.abrirDetalle(idPersona.split('/')[1]); await sleep(150);
  $B('btn-accion-detalle').click(); await sleep(250);
  check(!B.document.querySelector('#qr-target') && txt($B('ticket-contenido')).includes('Estás en la lista'), 'en el evento de una persona: "¡Estás en la lista!" sin QR');

  console.log(fallos ? `\n${fallos} FALLOS` : '\nTODO OK'); process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('FALLO', e); process.exit(1); });
