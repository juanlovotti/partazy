// Prueba: Navegación: botón Volver y "atrás" del celular.
const { JSDOM } = require('jsdom'); const fs = require('fs');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const f=Date.now()+2*864e5;
store.docs.set('users/A',{nombre:'Juan',iniciales:'J',ciudad:'Güemes',intereses:[],foto:'',nombreBusqueda:'juan',palabras:['juan']});
store.docs.set('users/A/privado/datos',{nacimiento:'2000-03-10'});
store.docs.set('users/O',{nombre:'Vortex',usuario:'vortex',iniciales:'V',tipoCuenta:'organizacion',ciudad:'Güemes',intereses:[],foto:'',nombreBusqueda:'vortex',palabras:['vortex']});
const base={creador:'O',creadorNombre:'Vortex',organizador:'Vortex',categoria:'techno',tipoLugar:'Fiesta',tipo:'fiesta',privacidad:'publica',hora:'23:00',lugar:'Güemes',lat:-31.42,lng:-64.19,precio:0,capacidad:100,confirmadosCount:3,edadMinima:18,dresscode:'Libre',musica:'Techno',imagen:'',descripcion:'x',reglas:'x',estado:'publicado',fechaTs:f};
store.docs.set('events/e1',{...base,nombre:'Evento Uno'}); store.docs.set('events/e2',{...base,nombre:'Evento Dos'});
const w = new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://partazy.web.app/',
  beforeParse(w){ w.firebase = makeFirebase(store,()=>({uid:'A',email:'j@t.com'})); w.navigator.geolocation=undefined; w.addEventListener('error',e=>console.error('ERROR JS',e.message)); }}).window;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const $=id=>w.document.getElementById(id);
let fallas=0; const ok=(c,m)=>{ console.log((c?'✔ ':'✘ ')+m); if(!c) fallas++; };
const activa=()=>w.document.querySelector('.screen.activa').id.replace('pantalla-','');
(async()=>{
  await sleep(700);
  ok(!$('tutorial').classList.contains('show'), 'cuenta que ya existía: el tutorial no sale solo');
  w.abrirTutorial(); await sleep(40);
  ok($('tutorial').classList.contains('show'), 'se puede abrir desde Ayuda');
  w.history.back(); await sleep(60);
  ok(!$('tutorial').classList.contains('show') && activa()==='home', 'el "atrás" del celular primero cierra el tutorial');
  w.ir('perfil'); await sleep(20);
  w.abrirDetalle('e1'); await sleep(150);
  w.abrirUsuario('O'); await sleep(150);
  w.abrirDetalle('e2'); await sleep(150);
  ok(/Evento Dos/.test($('detalle-contenido').textContent), 'abrí: perfil → evento 1 → organizador → evento 2');
  w.document.querySelector('#detalle-contenido [aria-label="Volver"]').click(); await sleep(200);
  console.log('DBG', activa(), w.eval('NAV.pila.length'));
  ok(activa()==='usuario', 'Volver del evento 2 → página del organizador');
  w.document.querySelector('#pantalla-usuario .volver').click(); await sleep(200);
  ok(activa()==='detalle' && /Evento Uno/.test($('detalle-contenido').textContent), 'Volver → evento 1 (con su contenido)');
  w.history.back(); await sleep(200);
  ok(activa()==='perfil', 'botón atrás del celular → perfil');
  w.history.back(); await sleep(200);
  ok(activa()==='home', 'atrás otra vez → inicio');
  w.abrirAmigos && w.abrirAmigos(); await sleep(50);
  ok(!!w.document.querySelector('#pantalla-amigos [aria-label="Volver"]'), 'Amigos ahora tiene botón para volver');
  w.document.querySelector('#pantalla-amigos [aria-label="Volver"]').click(); await sleep(200);
  ok(activa()==='home', 'y vuelve a donde estabas');
  ok(!!w.document.querySelector('#pantalla-notificaciones [aria-label="Volver"]'), 'Notificaciones tiene botón para volver');
  // sin historial: el botón va a un lugar lógico
  w.eval('NAV.pila.length=0'); w.ir('ayuda'); w.eval('NAV.pila.length=0');
  w.document.querySelector('#pantalla-ayuda .volver').click(); await sleep(100);
  ok(activa()==='perfil', 'sin historial, Volver de Ayuda lleva a Perfil');
  // un modal abierto se cierra con atrás sin cambiar de pantalla
  w.abrirDetalle('e1'); await sleep(150); w.abrirReferencias(); w.history.back(); await sleep(100);
  ok(activa()==='detalle' && !$('modal-referencias').classList.contains('show'), 'atrás con la guía de colores abierta: la cierra y te deja en el evento');
  console.log(fallas ? '\nFALLAS: '+fallas : '\nTODO OK'); process.exit(fallas?1:0);
})();
