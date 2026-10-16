// Prueba: "Ya no voy", retirar solicitud y lista de espera que confirma al liberarse un lugar.
const { JSDOM } = require('jsdom'); const fs = require('fs');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put=(p,v)=>store.docs.set(p,v); const T=Date.now(); const H=36e5;
for(const u of ['A','B','O']){ put('users/'+u,{nombre:'U'+u,usuario:'u'+u.toLowerCase(),iniciales:u,ciudad:'Córdoba',intereses:[],foto:''}); put(`users/${u}/privado/datos`,{nacimiento:'1998-01-01'}); }
const base={creador:'O',creadorNombre:'UO',organizador:'UO',categoria:'',tipo:'fiesta',ocasion:'fiesta',privacidad:'publica',hora:'23:00',precio:0,edadMinima:18,imagen:'',descripcion:'x',lugar:'Belgrano 800',lat:-31.42,lng:-64.19,fechaTs:T+30*H};
put('events/e1',{...base,nombre:'Fiesta Llena',capacidad:2,confirmadosCount:2});
put('events/e1/attendees/O',{uid:'O',nombre:'UO',estado:'confirmado',ticket:'T0'});
put('events/e1/attendees/A',{uid:'A',nombre:'UA',estado:'confirmado',ticket:'T1'});
put('events/e1/attendees/B',{uid:'B',nombre:'UB',estado:'en-espera'});
put('events/p1',{...base,nombre:'Previa Privada',tipo:'previa',ocasion:'previa',privacidad:'privada',capacidad:20,confirmadosCount:1});
put('events/p1/attendees/A',{uid:'A',nombre:'UA',estado:'solicitado'});
const mk=uid=>new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://partazy.web.app/',beforeParse(w){ w.firebase=makeFirebase(store,()=>({uid,email:uid+'@t.com'})); w.navigator.geolocation=undefined; w.addEventListener('error',e=>console.error('ERROR JS',e.message)); }}).window;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const txt=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();
let f=0; const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m); if(!c) f++;};
(async()=>{
  const A=mk('A'), B=mk('B'); await sleep(1000);
  const $A=id=>A.document.getElementById(id), $B=id=>B.document.getElementById(id);
  // B en lista de espera, evento lleno
  B.abrirDetalle('e1'); await sleep(400);
  ok(/En lista de espera/.test(txt($B('btn-accion-detalle'))) && $B('btn-accion-detalle').disabled, 'B está en lista de espera (lleno)');
  ok(/Salir de la lista de espera/.test(txt($B('detalle-contenido'))), 'B puede salir de la lista de espera');
  // A ya no va
  A.abrirDetalle('e1'); await sleep(400);
  const salir=A.document.querySelector('[data-salir]');
  ok(salir && /Ya no voy/.test(txt(salir)), 'A (confirmado) tiene "Ya no voy · liberar mi lugar"');
  salir.click(); await sleep(60);
  ok(/¿Ya no vas\?/.test(txt($A('modal-titulo'))), 'pide confirmar');
  $A('modal-ok').click(); await sleep(400);
  ok(!store.docs.has('events/e1/attendees/A') && store.docs.get('events/e1').confirmadosCount===1, 'A liberó su lugar: se borra su asistencia y el contador baja a 1');
  ok(/Confirmar|Reservar/.test(txt($A('btn-accion-detalle'))), 'A vuelve a ver el botón para confirmar');
  // B: se liberó un lugar
  B.abrirDetalle('e1'); await sleep(400);
  ok(/Se liberó un lugar/.test(txt($B('btn-accion-detalle'))) && !$B('btn-accion-detalle').disabled, 'a B le aparece "¡Se liberó un lugar! Confirmar"');
  $B('btn-accion-detalle').click(); await sleep(500);
  ok(store.docs.get('events/e1/attendees/B')?.estado==='confirmado' && store.docs.get('events/e1').confirmadosCount===2, 'B pasa de la lista de espera a confirmado');
  // Retirar solicitud de previa privada
  A.abrirDetalle('p1'); await sleep(400);
  const ret=A.document.querySelector('[data-salir]');
  ok(ret && /Retirar mi solicitud/.test(txt(ret)), 'en una previa privada se puede retirar la solicitud');
  ret.click(); await sleep(60); $A('modal-ok').click(); await sleep(300);
  ok(!store.docs.has('events/p1/attendees/A') && store.docs.get('events/p1').confirmadosCount===1, 'solicitud retirada sin tocar el contador');
  // El organizador no ve "Ya no voy" en su evento
  const O=mk('O'); await sleep(900); O.abrirDetalle('e1'); await sleep(400);
  ok(!O.document.querySelector('[data-salir]'), 'quien organiza no puede bajarse de su propio evento');
  console.log(f?'\nFALLAS: '+f:'\nTODO OK'); process.exit(f?1:0);
})();
