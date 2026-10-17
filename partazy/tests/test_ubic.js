// Prueba: Ubicación en cualquier ciudad de Argentina y aviso de dirección poco precisa.
const { JSDOM } = require('jsdom'); const fs = require('fs');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put=(p,v)=>store.docs.set(p,v); const T=Date.now(); const H=36e5;
put('users/A',{nombre:'Juan',usuario:'juan',iniciales:'J',ciudad:'Rosario',intereses:[],foto:''}); put('users/A/privado/datos',{nacimiento:'1998-01-01'});
const ev=(id,o)=>put('events/'+id,Object.assign({creador:'O',creadorNombre:'X',organizador:'X',categoria:'',tipo:'fiesta',ocasion:'fiesta',privacidad:'publica',hora:'23:00',precio:0,capacidad:100,confirmadosCount:1,edadMinima:18,imagen:'',descripcion:'x',fechaTs:T+30*H},o));
ev('cba',{nombre:'Fiesta en Córdoba',lugar:'Güemes',lat:-31.42,lng:-64.19});
ev('ros',{nombre:'Fiesta en Rosario',lugar:'Pichincha',lat:-32.94,lng:-60.65});
const w=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://partazy.web.app/',beforeParse(w){ w.firebase=makeFirebase(store,()=>({uid:'A',email:'a@t.com'}));
  w.navigator.geolocation={ getCurrentPosition:(ok,err)=>setTimeout(()=>err({code:1}),10) };
  w.addEventListener('error',e=>console.error('ERROR JS',e.message)); }}).window;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const $=id=>w.document.getElementById(id); const txt=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();
let f=0; const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m); if(!c) f++;};
(async()=>{
  await sleep(900); w.cerrarTutorial(); w.ir('home'); w.renderHome(); await sleep(50);
  const home=txt($('pantalla-home'));
  ok(/Elegí tu ciudad/.test(txt(w.document.querySelector('.ubic-btn'))), 'sin permiso de ubicación no asume Córdoba: "'+txt(w.document.querySelector('.ubic-btn'))+'"');
  ok(/Fiesta en Córdoba/.test(home) && /Fiesta en Rosario/.test(home), 'muestra todos los eventos del país');
  ok(/No sabemos en qué ciudad estás/.test(home) && /Elegir mi ciudad/.test(home), 'y ofrece elegir la ciudad');
  ok(!/\d km/.test(txt($('lista-cerca'))), 'sin ubicación no inventa distancias');
  // en Rosario
  w.aplicarUbicacion({lat:-32.95,lng:-60.66}, true, 'Rosario'); w.elegirRango(50); await sleep(80);
  w.ir('home'); w.renderHome(); await sleep(30);
  const h2=txt($('pantalla-home'));
  ok(/Fiesta en Rosario/.test(h2) && !/Fiesta en Córdoba/.test(h2), 'en Rosario con 50 km: ve lo de Rosario, no lo de Córdoba');
  ok(/Rosario de noche/i.test(txt($('home-ticker'))), 'la banda dice "Rosario de noche"');
  ok($('lista-barrios').children.length===0, 'no sugiere barrios de Córdoba si estás en otra ciudad');
  // crear con dirección poco precisa → aviso
  w.ir('crear'); $('f-nombre').value='Mi fiesta'; $('f-lugar').value='Pichincha'; $('f-fecha').value=new Date(T+3*864e5).toISOString().slice(0,10); $('f-hora').value='23:00'; $('f-capacidad').value='40';
  w.mostrarVistaPrevia=async()=>true;
  const p=w.publicarEvento(); await sleep(60);
  ok(/¿La dirección está completa\?/.test(txt($('modal-titulo'))), 'dirección sin número: avisa que sea lo más específica posible');
  $('modal-cancelar').click(); await p; await sleep(30);
  ok(![...store.docs.values()].some(v=>v.nombre==='Mi fiesta'), '"Cancelar" vuelve a completar la dirección');
  $('f-lugar').value='Pichincha 1200, Rosario';
  await w.publicarEvento(); await sleep(200);
  const nuevo=[...store.docs.values()].find(v=>v.nombre==='Mi fiesta');
  ok(nuevo && nuevo.ciudad==='Rosario' && Math.abs(nuevo.lat+32.95)<0.2, 'con calle y número publica directo; el evento queda en Rosario (no en Córdoba)');
  ok(/lo más específico posible/.test(txt($('ayuda-lugar'))), 'el campo de dirección lo aclara siempre');
  console.log(f?'\nFALLAS: '+f:'\nTODO OK'); process.exit(f?1:0);
})();
