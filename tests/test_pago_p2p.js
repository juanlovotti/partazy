// Prueba: pago con comprobante (P2P, la plata va directo a la cuenta de quien organiza) y pasar la entrada a un amigo.
// Reservar → lugar guardado 30 min → avisar el pago / mandar la captura → quien organiza confirma ("Me llegó")
// o rechaza ("No me llegó", se libera el lugar) → entrada. Las reservas vencidas se liberan solas.
// Después: la entrada se le pasa a un amigo, que la acepta con un código nuevo; la vieja queda anulada.
const { JSDOM } = require('jsdom');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
let f = 0; const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if(!c) f++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const txt = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
const H = 36e5, ahora = Date.now();
const store = crearStore(); const put = (p, v) => store.docs.set(p, v);
const perfil = (uid, nombre, extra) => { put('users/' + uid, { nombre, usuario: nombre.toLowerCase().replace(/\W/g, ''), iniciales: nombre[0], ciudad: 'Córdoba', intereses: [], foto: '', nombreBusqueda: nombre.toLowerCase(), palabras: nombre.toLowerCase().split(' '), ...(extra || {}) }); put(`users/${uid}/privado/datos`, { nacimiento: '1998-01-01' }); };
perfil('O', 'Vortex Club', { tipoCuenta: 'organizacion' });
perfil('L', 'Lu Ferreyra');
perfil('S', 'Sofi Gómez');
perfil('P', 'Ivo Paz');
put('friendships/L_S', { users: ['L', 'S'], de: 'L', para: 'S', estado: 'aceptada' });
const base = { creador: 'O', creadorNombre: 'Vortex Club', organizador: 'Vortex Club', categoria: 'techno', tipoLugar: 'Fiesta', tipo: 'fiesta', privacidad: 'publica', hora: '23:30', lugar: 'Güemes', lat: -31.42, lng: -64.19, capacidad: 50, confirmadosCount: 1, edadMinima: 18, dresscode: 'Libre', musica: 'Techno', imagen: '', descripcion: 'x', reglas: 'x', estado: 'publicado', fechaTs: ahora + 30 * H, createdAt: ahora - 72 * H, conQR: true, deOrganizacion: true };
put('events/V', { ...base, nombre: 'Noche Vortex', precio: 7000, pagoInfo: 'Transferencia al alias vortex.club', pagoTitular: 'Martín Gómez', cobroComprobante: true });
put('events/V/attendees/O', { uid: 'O', nombre: 'Vortex Club', estado: 'confirmado', ticket: 'PT-ORG', ts: 1 });
put('events/G', { ...base, nombre: 'Previa gratis', precio: 0 });
function abrir(uid){
  return new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://partazy.com/',
    beforeParse(w){ w.firebase = makeFirebase(store, () => ({ uid, email: uid + '@t.com' })); w.navigator.geolocation = undefined; } }).window;
}
const at = (ev, u) => store.docs.get(`events/${ev}/attendees/${u}`);
const cuenta = ev => store.docs.get('events/' + ev).confirmadosCount;
const notifs = (u, tipo) => [...store.docs.entries()].filter(([k, v]) => k.startsWith(`notificaciones/${u}/items/`) && v.tipo === tipo);

(async () => {
  // ---------- Quien compra: reserva ----------
  const L = abrir('L'); await sleep(800); L.cerrarTutorial(); await sleep(200);
  const $L = id => L.document.getElementById(id);
  L.abrirDetalle('V'); await sleep(350);
  ok(/Reservar entrada/.test(txt($L('btn-accion-detalle'))), 'el evento pago con comprobante dice "Reservar entrada"');
  ok(/Cómo funciona/.test(txt($L('detalle-contenido'))) && /30 minutos/.test(txt($L('detalle-contenido'))), 'el detalle explica cómo funciona (lugar guardado 30 minutos, captura, confirmación)');
  $L('btn-accion-detalle').click(); await sleep(80);
  ok(/30 minutos/.test(txt($L('modal-texto'))) && /no toca la plata/.test(txt($L('modal-texto'))), 'antes de reservar avisa: 30 minutos y que la plata va directo a la cuenta');
  $L('modal-ok').click(); await sleep(400);
  const r = at('V', 'L');
  ok(r && r.estado === 'reservado' && !r.ticket && r.venceTs > Date.now() + 28 * 60e3 && r.venceTs <= Date.now() + 30 * 60e3, 'queda "reservado" por 30 minutos y todavía sin entrada');
  ok(cuenta('V') === 2, 'el lugar queda guardado (el cupo suma 1)');
  const pant = txt($L('ticket-contenido'));
  ok(L.pantallaActual() === 'ticket' && /Tu lugar está guardado/.test(pant) && /\d+ min/.test(pant), 'pasa a la pantalla de pago con la cuenta regresiva');
  ok(/vortex\.club/.test(pant) && /Martín Gómez/.test(pant) && /\$7\.000/.test(pant) && /Copiar alias/.test(pant), 'muestra monto, alias para copiar y titular de la cuenta');
  ok(!!$L('input-comprobante') && $L('btn-enviar-comprobante').disabled, 'para mandar el comprobante primero hay que elegir la captura');
  // Avisar que pagó sin captura
  $L('btn-sin-comprobante').click(); await sleep(60); $L('modal-ok').click(); await sleep(400);
  ok(at('V', 'L').estado === 'pago-enviado' && at('V', 'L').sinComprobante === true, 'puede avisar que pagó aunque no tenga la captura');
  ok(notifs('O', 'pago_enviado').length === 1, 'a quien organiza le llega el aviso para revisar el pago');
  ok(/Comprobante enviado/.test(txt($L('ticket-contenido'))), 'quien compra ve que su pago está en revisión');
  L.abrirDetalle('V'); await sleep(300);
  ok(/Pago en revisión/.test(txt($L('btn-accion-detalle'))), 'en el evento el botón dice "Pago en revisión"');

  // ---------- Otra persona manda la captura, y una reserva vencida ----------
  const P = abrir('P'); await sleep(800); P.cerrarTutorial(); await sleep(200);
  P.abrirDetalle('V'); await sleep(300); P.document.getElementById('btn-accion-detalle').click(); await sleep(60); P.document.getElementById('modal-ok').click(); await sleep(400);
  const captura = 'data:image/jpeg;base64,' + 'A'.repeat(200);
  await P.eval('DataService').enviarComprobante('V', 'P', captura); await sleep(50);
  ok(at('V', 'P').estado === 'pago-enviado' && store.docs.get('events/V/comprobantes/P')?.img === captura, 'la captura se guarda aparte (solo la ven la persona y quien organiza)');
  put('events/V/attendees/X', { uid: 'X', nombre: 'Reserva Vieja', estado: 'reservado', venceTs: Date.now() - 60e3, ts: Date.now() - 31 * 60e3 });
  put('events/V', { ...store.docs.get('events/V'), confirmadosCount: cuenta('V') + 1 });
  const antes = cuenta('V');

  // ---------- Quien organiza: revisa ----------
  const O = abrir('O'); await sleep(800); O.cerrarTutorial(); await sleep(200);
  const $O = id => O.document.getElementById(id);
  O.abrirDetalle('V'); await sleep(600);
  const panel = txt($O('lista-pagos'));
  ok(/Lu Ferreyra/.test(panel) && /sin captura/.test(panel) && /Ivo Paz/.test(panel) && /comprobante/.test(panel), 'el panel "Pagos para revisar" muestra a quién revisar y cómo avisó');
  ok(/se puede falsificar/.test(txt($O('detalle-contenido'))), 'le recuerda fijarse en su cuenta (una captura se puede falsificar)');
  ok(!at('V', 'X') && cuenta('V') === antes - 1, 'la reserva vencida sin comprobante se libera sola (el cupo resta 1)');
  // Ver captura
  O.document.querySelector('[data-ver-comp="P"]').click(); await sleep(150);
  ok(O.document.getElementById('hoja-vista').classList.contains('show') && O.document.querySelector('#hoja-contenido img')?.getAttribute('src') === captura, '"Ver captura" muestra el comprobante en grande');
  O.cerrarHoja(); await sleep(30);
  // Me llegó (Lu)
  const c1 = cuenta('V');
  O.document.querySelector('[data-pago="L"][data-accion="ok"]').click(); await sleep(60); $O('modal-ok').click(); await sleep(400);
  ok(at('V', 'L').estado === 'confirmado' && /^PT-/.test(at('V', 'L').ticket || ''), '"Me llegó": la persona queda confirmada con su código de entrada');
  ok(cuenta('V') === c1, 'confirmar no cambia el cupo (el lugar ya estaba guardado)');
  ok(notifs('L', 'pago_confirmado').length === 1, 'le avisa que ya tiene su entrada');
  // No me llegó (Ivo)
  O.document.querySelector('[data-pago="P"][data-accion="no"]').click(); await sleep(60);
  $O('modal-input').value = 'No me figura ninguna transferencia'; $O('modal-ok').click(); await sleep(400);
  ok(at('V', 'P').estado === 'pago-rechazado' && /No me figura/.test(at('V', 'P').motivoRechazo), '"No me llegó": queda rechazado con el comentario');
  ok(cuenta('V') === c1 - 1 && !store.docs.has('events/V/comprobantes/P'), 'se libera el lugar y se borra la captura');
  ok(notifs('P', 'pago_rechazado').length === 1, 'le avisa que no encontraron su pago');
  P.abrirTicket('V'); await sleep(300);
  ok(/No encontraron tu pago/.test(txt(P.document.getElementById('ticket-contenido'))) && P.document.querySelector('[data-reintentar-pago="V"]'), 'quien pagó ve el motivo y puede volver a reservar');

  // ---------- La entrada de Lu: QR y pasarla a Sofi ----------
  L.abrirTicket('V'); await sleep(350);
  ok(/Asistencia confirmada/i.test(txt($L('ticket-contenido'))) && !!L.document.querySelector('[data-pasar-entrada="V"]'), 'con el pago confirmado aparece la entrada y la opción de pasársela a un amigo');
  L.document.querySelector('[data-pasar-entrada="V"]').click(); await sleep(250);
  const sel = L.document.querySelector('#hoja-lista .sel-amigo[data-sel="S"]');
  ok(!!sel, 'elige entre sus amigos');
  sel.click(); await sleep(80); $L('modal-ok').click(); await sleep(300);
  ok(at('V', 'L').transferirA === 'S' && at('V', 'L').estado === 'confirmado', 'la oferta queda hecha y la entrada sigue siendo de Lu hasta que Sofi acepte');
  ok(notifs('S', 'entrada_transferencia').length === 1, 'a Sofi le llega el aviso');
  ok(/Le ofreciste tu entrada/.test(txt($L('ticket-contenido'))), 'Lu ve que está esperando que acepte (y puede cancelar)');

  const S = abrir('S'); await sleep(800); S.cerrarTutorial(); await sleep(200);
  S.abrirOfertaEntrada('V', 'L'); await sleep(350);
  ok(/Lu Ferreyra te pasa su entrada/.test(txt(S.document.getElementById('ticket-contenido'))) && /no cobra nada/.test(txt(S.document.getElementById('ticket-contenido'))), 'Sofi ve quién le pasa la entrada (y que Partazy no cobra nada)');
  const cT = cuenta('V'), viejo = at('V', 'L').ticket;
  S.document.getElementById('btn-aceptar-entrada').click(); await sleep(450);
  const s = at('V', 'S');
  ok(s && s.estado === 'confirmado' && /^PT-/.test(s.ticket) && s.ticket !== viejo && s.deTransferencia === 'L', 'Sofi queda confirmada con un código nuevo');
  ok(at('V', 'L').estado === 'transferida', 'la entrada de Lu queda anulada (su código ya no vale en la puerta)');
  ok(cuenta('V') === cT, 'pasar la entrada no cambia el cupo');
  ok(notifs('L', 'entrada_aceptada').length === 1, 'a Lu le avisan que Sofi aceptó');
  ok(S.pantallaActual() === 'ticket' && /Asistencia confirmada/i.test(txt(S.document.getElementById('ticket-contenido'))), 'Sofi ve su entrada');
  L.abrirTicket('V'); await sleep(300);
  ok(/Le pasaste tu entrada a Sofi/.test(txt($L('ticket-contenido'))), 'Lu ve que se la pasó a Sofi');
  S.abrirOfertaEntrada('V', 'L'); await sleep(300);
  ok(/Ya tenés tu entrada/.test(txt(S.document.getElementById('ticket-contenido'))), 'la misma oferta no se puede usar dos veces');

  // ---------- Sin cobro con comprobante, todo sigue como antes ----------
  L.abrirDetalle('G'); await sleep(300); $L('btn-accion-detalle').click(); await sleep(400);
  ok(at('G', 'L')?.estado === 'confirmado', 'un evento sin cobro con comprobante se confirma directo, como siempre');

  // ---------- Crear: el interruptor y el alias ----------
  O.ir('crear'); await sleep(80);
  ok($O('switch-comprobante') && $O('switch-comprobante').classList.contains('on'), 'al crear un evento pago, "Cobrar con comprobante" viene prendido');
  const fecha = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  O.elegirTipo('fiesta');
  $O('f-nombre').value = 'Fiesta con alias'; $O('f-lugar').value = 'Belgrano 800, Güemes'; $O('f-fecha').value = fecha; $O('f-hora').value = '23:00'; $O('f-capacidad').value = '40';
  if(!$O('switch-pago').classList.contains('on')) O.toggleSwitchPago($O('switch-pago'));
  $O('f-precio').value = '5000'; $O('f-pago-info').value = 'Efectivo en la puerta';
  O.confirmar = async () => true; O.mostrarVistaPrevia = async () => true;
  await O.publicarEvento(); await sleep(200);
  const nuevos = () => [...store.docs.entries()].filter(([k, v]) => /^events\/[^/]+$/.test(k) && v.nombre === 'Fiesta con alias');
  ok(!nuevos().length && /alias o CBU/.test(txt($O('toast'))), 'sin alias ni CBU no deja publicar con cobro por comprobante');
  $O('f-pago-info').value = 'Transferencia al alias fiesta.alias';
  await O.publicarEvento(); await sleep(300);
  ok(nuevos().length === 1 && nuevos()[0][1].cobroComprobante === true, 'con el alias se publica con cobro por comprobante');

  // Alias sin puntos (12/11: "alias: partazyproductora" no dejaba publicar)
  const casosAlias = [['alias: partazyproductora', 'partazyproductora'], ['partazyproductora', 'partazyproductora'], ['Transferencia al alias vortex.club', 'vortex.club'],
    ['cvu: 0000 0031 0001 2345 6789 01', '0000003100012345678901'], ['Efectivo en la puerta', ''], ['www.partazy.com', ''], ['Pedile el alias al organizador', ''], ['alias: ab', '']];
  ok(casosAlias.every(([t, e]) => O.datoPago(t) === e), 'reconoce alias sin puntos, con puntos y CBU/CVU en grupos; no confunde frases ni páginas web');
  O.ir('crear'); await sleep(80); O.elegirTipo('fiesta');
  $O('f-nombre').value = 'Fiesta alias sin puntos'; $O('f-lugar').value = 'Belgrano 800, Güemes'; $O('f-fecha').value = fecha; $O('f-hora').value = '23:00'; $O('f-capacidad').value = '40';
  if(!$O('switch-pago').classList.contains('on')) O.toggleSwitchPago($O('switch-pago'));
  $O('f-precio').value = '15000'; $O('f-pago-info').value = 'alias: partazyproductora';
  await O.publicarEvento(); await sleep(300);
  const sinPuntos = [...store.docs.entries()].filter(([k, v]) => /^events\/[^/]+$/.test(k) && v.nombre === 'Fiesta alias sin puntos');
  ok(sinPuntos.length === 1 && sinPuntos[0][1].cobroComprobante === true, 'con "alias: partazyproductora" se publica con cobro por comprobante');

  console.log(f ? '\nFALLAS: ' + f : '\nTODO OK'); process.exit(f ? 1 : 0);
})();
