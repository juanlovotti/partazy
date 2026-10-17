// Prueba: Pasar una previa de pública a privada y viceversa; feed en vivo.
const { JSDOM } = require('jsdom'); const fs = require('fs');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put=(p,v)=>store.docs.set(p,v); const T=Date.now(); const H=36e5;
for(const u of ['A','B','C']){ put('users/'+u,{nombre:'U'+u,usuario:'u'+u.toLowerCase(),iniciales:u,ciudad:'Córdoba',intereses:[],foto:''}); put(`users/${u}/privado/datos`,{nacimiento:'1998-01-01'}); }
const base={creador:'A',creadorNombre:'UA',organizador:'UA',categoria:'',hora:'23:00',capacidad:30,confirmadosCount:1,edadMinima:18,precio:0,imagen:'',descripcion:'cumple de mi primo',estado:'publicado'};
// creada como "fiesta" con el tipo Previa (versión vieja): pública, sin poder hacerla privada
put('events/p1',{...base,nombre:'Previa Barrio Medialuna',tipo:'fiesta',tipoLugar:'Fiesta',ocasion:'previa',privacidad:'publica',lugar:'Obispo Trejo 100, Nueva Córdoba',lat:-31.4250,lng:-64.1900,ubicacionExacta:true,fechaTs:T+50*H});
put('events/p1/attendees/A',{uid:'A',nombre:'UA',estado:'confirmado'});
put('events/p2',{...base,nombre:'Previa privada',tipo:'previa',tipoLugar:'Previa',ocasion:'previa',privacidad:'privada',lugar:'General Paz',lat:-31.41,lng:-64.17,ubicacionExacta:false,fechaTs:T+30*H});
put('events/p2/private/data',{direccion:'Sucre 500'}); put('events/p2/attendees/A',{uid:'A',nombre:'UA',estado:'confirmado'});
const mk=uid=>new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://partazy.web.app/',beforeParse(w){ w.firebase=makeFirebase(store,()=>({uid,email:uid+'@t.com'})); w.navigator.geolocation=undefined; w.addEventListener('error',e=>console.error('ERROR JS',e.message)); }}).window;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const txt=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();
let f=0; const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m); if(!c) f++;};
(async()=>{
  const A=mk('A'), B=mk('B'); await sleep(900); A.cerrarTutorial(); B.cerrarTutorial(); const $=id=>A.document.getElementById(id);
  const vis=id=>$(id).style.display!=='none';
  // Feed: no hay nada esta noche → arriba aparece lo próximo
  B.ir('home'); B.renderHome(); await sleep(30);
  ok(/Previa privada/.test(txt(B.document.getElementById('lista-esta-noche'))) && /Previa Barrio/.test(txt(B.document.getElementById('lista-esta-noche'))), 'sin nada esta noche, la primera fila muestra lo próximo (privadas incluidas): '+txt(B.document.getElementById('titulo-fila-1')));
  // Editar la "previa" vieja: se trata como previa y se puede pasar a privada
  A.abrirDetalle('p1'); await sleep(300); $('btn-editar-evento').click(); await sleep(150);
  ok($('op-previa').classList.contains('activo') && !vis('campo-tipos') && !vis('campo-estilo') && !vis('fila-vip'), 'al editar una previa: sin tipos, sin estilo y sin lista VIP');
  ok(vis('fila-privacidad'), 'al editar una previa aparece el interruptor privada/pública');
  ok(!$('switch-privacidad').classList.contains('on'), 'arranca como estaba (pública)');
  $('switch-privacidad').click(); await sleep(30);
  ok($('f-direccion').value==='Obispo Trejo 100, Nueva Córdoba' && $('f-lugar').value==='', 'al pasarla a privada, la dirección baja al campo privado y pide el barrio');
  $('f-lugar').value='Nueva Córdoba';
  A.mostrarVistaPrevia=async()=>true; await A.publicarEvento(); await sleep(300);
  let e=store.docs.get('events/p1');
  ok(e.privacidad==='privada' && e.tipo==='previa' && e.lugar==='Nueva Córdoba' && e.ubicacionExacta===false && (Math.abs(e.lat+31.4250)>0 || Math.abs(e.lng+64.19)>0), 'queda privada, tipo previa, con barrio público y el pin corrido');
  ok(store.docs.get('events/p1/private/data')?.direccion==='Obispo Trejo 100, Nueva Córdoba', 'la dirección queda guardada aparte (solo aprobados)');
  ok(/ahora es privada/.test([...store.docs.entries()].filter(([k])=>k.startsWith('chats/p1/messages/')).map(([k,v])=>v.texto).join(' ')), 'se avisa en el grupo del evento');
  await sleep(600);
  const enB=B.eval("state.eventos.find(e=>e.id==='p1')");
  ok(enB && enB.privacidad==='privada' && enB.lugar==='Nueva Córdoba', 'el feed de los demás se actualiza solo');
  // Privada → pública, con una solicitud pendiente: no deja
  put('events/p2/attendees/C',{uid:'C',nombre:'UC',estado:'solicitado'});
  A.abrirDetalle('p2'); await sleep(300); $('btn-editar-evento').click(); await sleep(200);
  ok($('switch-privacidad').classList.contains('on') && $('f-direccion').value==='Sucre 500', 'privada: carga la dirección para editarla');
  $('switch-privacidad').click(); await sleep(30);
  ok(/Sucre 500/.test($('f-lugar').value), 'al pasarla a pública, la dirección pasa al lugar visible: '+$('f-lugar').value);
  const pub=A.publicarEvento(); await sleep(200);
  ok(/solicitudes sin responder/.test(txt($('modal-titulo'))), 'con solicitudes pendientes, pide responderlas antes');
  $('modal-ok').click(); await pub; await sleep(50);
  ok(store.docs.get('events/p2').privacidad==='privada', 'y no la cambia');
  store.docs.get('events/p2/attendees/C').estado='rechazado';
  await A.publicarEvento(); await sleep(300);
  e=store.docs.get('events/p2');
  ok(e.privacidad==='publica' && /Sucre 500/.test(e.lugar), 'sin pendientes: queda pública y la dirección se ve');
  B.abrirDetalle('p2'); await sleep(300);
  ok(/Sucre 500/.test(txt(B.document.getElementById('detalle-contenido'))), 'los demás ven la dirección');
  // detalle sin "·" de más
  ok(!/FIESTA ·$|Previa · $/.test(txt(B.document.querySelector('.hero-bottom .cat'))) && !/·\s*$/.test(txt(B.document.querySelector('.hero-bottom .cat'))), 'sin estilo de música no queda un "·" suelto: '+txt(B.document.querySelector('.hero-bottom .cat')));
  console.log(f?'\nFALLAS: '+f:'\nTODO OK'); process.exit(f?1:0);
})();
