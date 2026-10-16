// Prueba: Mail de contacto, "Cargar más eventos" y limpieza de eventos viejos.
const { JSDOM } = require('jsdom'); const fs = require('fs');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put=(p,v)=>store.docs.set(p,v); const T=Date.now(); const H=36e5;
put('users/A',{nombre:'Juan',usuario:'juan',iniciales:'J',ciudad:'Córdoba',intereses:[],foto:''}); put('users/A/privado/datos',{nacimiento:'1998-01-01'});
const base={creador:'O',creadorNombre:'X',organizador:'X',categoria:'',tipo:'fiesta',ocasion:'fiesta',privacidad:'publica',hora:'23:00',precio:0,capacidad:100,confirmadosCount:1,edadMinima:18,imagen:'',descripcion:'x',lugar:'Belgrano 800',lat:-31.42,lng:-64.19};
for(let i=0;i<130;i++) put('events/ev'+i,{...base,nombre:'Evento '+i,fechaTs:T+(i+2)*H});
put('events/viejo',{...base,creador:'A',nombre:'Mi fiesta vieja',fechaTs:T-40*24*H}); put('events/viejo/attendees/A',{uid:'A',nombre:'Juan',estado:'confirmado'});
put('events/reciente',{...base,creador:'A',nombre:'Mi fiesta reciente',fechaTs:T-5*24*H});
const w=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://partazy.web.app/',beforeParse(w){ w.firebase=makeFirebase(store,()=>({uid:'A',email:'a@t.com'})); w.navigator.geolocation=undefined; w.addEventListener('error',e=>console.error('ERROR JS',e.message)); }}).window;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const $=id=>w.document.getElementById(id); const txt=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();
let f=0; const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m); if(!c) f++;};
(async()=>{
  await sleep(1000);
  ok(/partazycontacto@gmail\.com/.test(txt(w.document.querySelector('#pantalla-home .pie-legal'))), 'el pie muestra el mail de contacto');
  w.abrirTerminos(); await sleep(50);
  ok(w.document.querySelector('#pantalla-terminos .mail-contacto a')?.getAttribute('href')==='mailto:partazycontacto@gmail.com', 'Términos tiene el mail con link');
  ok(w.eval('state.eventos.length')===50, 'el feed carga los primeros 50 (abre más rápido)');
  w.ir('explorar'); await sleep(50);
  ok($('explorar-mas').style.display!=='none', 'Explorar ofrece "Cargar más eventos"');
  $('explorar-mas').querySelector('button').click(); await sleep(300);
  ok(w.eval('state.eventos.length')===130 && $('explorar-mas').style.display==='none', 'carga el resto y el botón desaparece: '+w.eval('state.eventos.length'));
  await w.limpiarEventosViejos(); await sleep(100);
  ok(!store.docs.has('events/viejo') && !store.docs.has('events/viejo/attendees/A') && store.docs.has('events/reciente'), 'se borran solos los eventos propios de hace más de 30 días (no los recientes)');
  console.log(f?'\nFALLAS: '+f:'\nTODO OK'); process.exit(f?1:0);
})();
