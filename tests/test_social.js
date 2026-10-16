// Prueba: Amistades, perfiles y chat del grupo del evento.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const { crearStore, makeFirebase } = require('./fakefb.js');

const html = require('./cargar-html.js')();
const store = crearStore();
const futuro = Date.now() + 26 * 3600e3;
const put = (p, v) => store.docs.set(p, v);
put('users/A', { nombre: 'Juan Lovotti', iniciales: 'JL', ciudad: 'Güemes', intereses: ['Techno'], foto: '', nombreBusqueda: 'juan lovotti', palabras: ['juan','lovotti'] });
put('users/A/privado/datos', { nacimiento: '2000-03-10', email: 'juan@test.com' });
put('users/B', { nombre: 'Sofía Gómez', iniciales: 'SG', ciudad: 'Nueva Córdoba', intereses: ['House'], foto: '', nombreBusqueda: 'sofia gomez', palabras: ['sofia','gomez'] });
put('users/B/privado/datos', { nacimiento: '1999-05-01', email: 'sofi@test.com' });
put('events/ev1', { nombre: 'Fiesta de Prueba', creador: 'A', creadorNombre: 'Juan Lovotti', organizador: 'Juan Lovotti', categoria: 'techno', tipoLugar: 'Fiesta', tipo: 'fiesta',
  privacidad: 'publica', fechaTs: futuro, hora: '23:00', lugar: 'Güemes', lat: -31.42, lng: -64.19, precio: 0, capacidad: 50, confirmadosCount: 1, edadMinima: 18,
  dresscode: 'Libre', musica: 'Techno', bebida: false, listaVip: false, ambiente: 'verde', ambienteLabel: 'Recién creado', ambienteDesc: '', imagen: '', descripcion: 'x', reglas: 'y' });

function abrir(uid, email, hash){
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://partazy-5555d.web.app/' + (hash || ''),
    beforeParse(w){
      w.firebase = makeFirebase(store, () => ({ uid, email, displayName: '', photoURL: '' }));
      w.navigator.geolocation = undefined;
      w.addEventListener('error', e => console.error(`[${uid}] ERROR JS:`, e.message));
    }
  });
  return dom.window;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const act = w => w.document.querySelector('.screen.activa')?.id.replace('pantalla-', '');
const txt = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
let fallos = 0;
const check = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if(!cond) fallos++; };

(async () => {
  const A = abrir('A', 'juan@test.com');
  const B = abrir('B', 'sofi@test.com', '#/evento/ev1');
  await sleep(150);
  const $A = id => A.document.getElementById(id), $B = id => B.document.getElementById(id);

  // Link compartido
  check(act(B) === 'detalle' && txt($B('detalle-contenido')).includes('Fiesta de Prueba'), 'B abre directo el evento desde el link #/evento/ev1');
  check(B.location.hash === '#/evento/ev1', 'la barra de direcciones conserva el link del evento');
  check(!!$B('btn-compartir-evento') && !!$B('btn-enviar-amigos'), 'el detalle tiene "Compartir link" y "Enviar a amigos"');

  // Enviar a amigos sin amigos → ofrece buscar
  $B('btn-enviar-amigos').click(); await sleep(30);
  check($B('modal-bg').classList.contains('show') && txt($B('modal-titulo')).includes('Todavía no tenés amigos'), 'sin amigos, "Enviar a amigos" invita a buscar amigos');
  $B('modal-cancelar').click(); await sleep(10);

  // Compartir link (sin navigator.share ni portapapeles → muestra el link)
  $B('btn-compartir-evento').click(); await sleep(30);
  check(txt($B('modal-texto')).includes('https://partazy-5555d.web.app/#/evento/ev1'), 'Compartir link muestra la URL correcta del evento');
  $B('modal-ok').click(); await sleep(10);

  // A busca a Sofía
  A.abrirAmigos(); await sleep(30);
  check(act(A) === 'amigos', 'A entra a Amigos');
  A.buscarPersonas('sofi'); await sleep(60);
  check(txt($A('resultados-personas')).includes('Sofía Gómez'), 'buscar "sofi" encuentra a Sofía Gómez (sin tilde)');
  A.buscarPersonas('gomez'); await sleep(60);
  check(txt($A('resultados-personas')).includes('Sofía Gómez'), 'buscar por apellido "gomez" también la encuentra');
  A.document.querySelector('[data-amigo-accion="pedir"][data-uid="B"]').click(); await sleep(80);
  check(store.docs.get('friendships/A_B')?.estado === 'pendiente', 'A envía solicitud (friendships/A_B pendiente)');
  check(txt($A('resultados-personas')).includes('Enviada'), 'el botón de A pasa a "Enviada ✓"');
  check(txt($A('bloque-enviadas')).includes('Sofía Gómez'), 'aparece en "Solicitudes enviadas"');

  // B ve el aviso y acepta
  check($B('badge-amigos').classList.contains('on') && $B('badge-amigos').textContent === '1', 'B ve el aviso rojo "1" en Amigos');
  B.abrirAmigos(); await sleep(60);
  check(txt($B('bloque-recibidas')).includes('Juan Lovotti'), 'B ve la solicitud de Juan');
  B.document.querySelector('[data-amigo-accion="aceptar"]').click(); await sleep(80);
  check(store.docs.get('friendships/A_B')?.estado === 'aceptada', 'B acepta: ahora son amigos');
  check(!$B('badge-amigos').classList.contains('on'), 'el aviso de B desaparece');
  await sleep(40);
  check(txt($A('lista-amigos')).includes('Sofía Gómez') && txt($A('titulo-mis-amigos')).includes('(1)'), 'A ve a Sofía en "Mis amigos (1)"');

  // A le escribe
  A.document.querySelector('#lista-amigos [data-dm="B"]').click(); await sleep(60);
  check(act(A) === 'chat' && A.document.getElementById('app').classList.contains('sin-nav'), 'A abre el chat (sin barra inferior)');
  check(txt($A('chat-top-persona')).includes('Sofía Gómez'), 'el encabezado del chat muestra a Sofía');
  $A('dm-input').value = 'hola! vas el sábado? <b>xss</b>';
  $A('dm-enviar').click(); await sleep(80);
  check(txt($A('dm-mensajes')).includes('hola! vas el sábado?'), 'A ve su mensaje enviado');
  check(!$A('dm-mensajes').querySelector('b:not(.msj-evento b)') || !$A('dm-mensajes').innerHTML.includes('<b>xss</b>'), 'el HTML del mensaje se escapa (sin inyección)');

  // B recibe
  check($B('badge-chats').classList.contains('on'), 'B ve el aviso de mensaje no leído en Chats');
  B.abrirChats(); await sleep(60);
  check(txt($B('lista-chats')).includes('Juan Lovotti') && txt($B('lista-chats')).includes('hola! vas el sábado?'), 'B ve la conversación con el último mensaje');
  B.document.querySelector('[data-chat="A"]').click(); await sleep(120);
  check(txt($B('dm-mensajes')).includes('hola! vas el sábado?'), 'B abre el chat y lee el mensaje');
  check(!$B('badge-chats').classList.contains('on'), 'al leerlo, el aviso de B se apaga');

  // A manda la fiesta por chat
  A.abrirDetalle('ev1'); await sleep(80);
  $A('btn-enviar-amigos').click(); await sleep(60);
  check($A('hoja-amigos').classList.contains('show') && txt($A('hoja-lista')).includes('Sofía Gómez'), 'se abre la lista de amigos para elegir');
  A.document.querySelector('[data-sel="B"]').click(); await sleep(10);
  check(!$A('hoja-ok').disabled, 'al elegir a Sofía se habilita "Enviar"');
  $A('hoja-ok').click(); await sleep(120);
  check(txt($B('dm-mensajes')).includes('Fiesta de Prueba'), 'B recibe la fiesta como tarjeta en el chat, en tiempo real');
  B.document.querySelector('#dm-mensajes [data-abrir="ev1"]').click(); await sleep(80);
  check(act(B) === 'detalle' && txt($B('detalle-contenido')).includes('Fiesta de Prueba'), 'B toca la tarjeta y se abre el evento');

  // Perfil ajeno
  B.abrirUsuario('A'); await sleep(60);
  check(act(B) === 'usuario' && txt($B('usuario-contenido')).includes('✓ Amigos') && txt($B('usuario-contenido')).includes('Fiesta de Prueba'), 'perfil de Juan: muestra "Amigos" y el evento que organiza');
  check(B.location.hash === '#/u/A', 'el perfil tiene su propio link (#/u/A)');
  check(txt(B.document.getElementById('stat-amigos')) === '1', 'el contador "Amigos" del perfil propio de B marca 1');

  // Eliminar amistad
  B.document.querySelector('[data-amigo-accion="eliminar"]').click(); await sleep(30);
  $B('modal-ok').click(); await sleep(100);
  check(!store.docs.has('friendships/A_B'), 'B elimina la amistad');
  check(txt($B('usuario-contenido')).includes('Agregar a amigos'), 'el perfil vuelve a ofrecer "Agregar a amigos"');

  console.log(fallos ? `\n${fallos} FALLOS` : '\nTODO OK');
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('FALLO', e); process.exit(1); });
