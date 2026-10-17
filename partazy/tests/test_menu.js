// Prueba: Menú ☰ del perfil y notificaciones agrupadas.
const { JSDOM } = require('jsdom'); const fs = require('fs');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put=(p,v)=>store.docs.set(p,v); const T=Date.now();
put('users/A',{nombre:'Juan',usuario:'juan',iniciales:'J',ciudad:'Córdoba',intereses:[],foto:''}); put('users/A/privado/datos',{nacimiento:'1998-01-01'});
put('users/B',{nombre:'Sofi',usuario:'sofi',iniciales:'S',ciudad:'Córdoba',intereses:[],foto:''});
const n=(id,tipo,ts,extra)=>put('notificaciones/A/items/'+id,Object.assign({tipo,de:'B',deNombre:'Sofi',objetoId:'e1',objetoNombre:'Fiesta X',texto:'',leida:false,ts},extra));
n('n1','amigo_evento',T-1000); n('n2','evento_solicitud',T-5000); n('n3','nuevo_evento',T-3000,{deNombre:'Vortex'}); n('n4','evento_aprobada',T-2000); n('n5','amistad_solicitud',T-500);
const w=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://partazy.web.app/',beforeParse(w){ w.firebase=makeFirebase(store,()=>({uid:'A',email:'a@t.com'})); w.navigator.geolocation=undefined; w.addEventListener('error',e=>console.error('ERROR JS',e.message)); }}).window;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const $=id=>w.document.getElementById(id); const txt=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();
const act=()=>w.document.querySelector('.screen.activa').id.replace('pantalla-','');
let f=0; const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m); if(!c) f++;};
(async()=>{
  await sleep(900); w.cerrarTutorial(); await sleep(300);
  w.ir('perfil'); await sleep(100);
  const botones=[...$('pantalla-perfil').querySelectorAll('.acciones-perfil .btn')].map(b=>txt(b));
  ok(botones.length===2 && /Mis entradas/.test(botones[0]) && /Más opciones/.test(botones[1]), 'el perfil queda con 2 botones: Mis entradas y Más opciones');
  ok(!!$('btn-menu-perfil'), 'arriba está el botón ☰');
  $('btn-menu-perfil').click(); await sleep(50);
  ok($('menu-perfil').classList.contains('show') && /Ayuda y preguntas frecuentes/.test(txt($('menu-perfil'))) && /Cerrar sesión/.test(txt($('menu-perfil'))) && /Eliminar mi cuenta/.test(txt($('menu-perfil'))), '☰ despliega el menú con el resto de opciones');
  [...$('menu-perfil').querySelectorAll('button')].find(b=>/Ayuda y preguntas/.test(b.textContent)).click(); await sleep(300);
  ok(!$('menu-perfil').classList.contains('show') && act()==='ayuda', 'elegir una opción cierra el menú y la abre');
  // notificaciones agrupadas
  await sleep(300); w.abrirNotificaciones(); await sleep(300);
  const grupos=[...w.document.querySelectorAll('#lista-notificaciones .grupo-notif')].map(g=>txt(g).replace(/\d+ nuevas?/,'').trim());
  ok(JSON.stringify(grupos)===JSON.stringify(['Solicitudes','Amigos','Seguidos','Tus eventos']), 'notificaciones ordenadas por grupo: '+grupos.join(' · '));
  const lista=txt($('lista-notificaciones'));
  ok(lista.indexOf('solicitud de amistad') < lista.indexOf('pidió unirse') && lista.indexOf('pidió unirse') < lista.indexOf('publicó Fiesta X'), 'las solicitudes van primero (amistad y para unirse a jodas)');
  const chips=[...$('chips-notif').querySelectorAll('.chip')].map(c=>txt(c));
  ok(chips[0]==='Todas' && chips.some(c=>/^Solicitudes2$/.test(c)), 'chips con cuántas nuevas hay: '+chips.join(' | '));
  [...$('chips-notif').querySelectorAll('.chip')].find(c=>/Seguidos/.test(c.textContent)).click(); await sleep(200);
  ok(/Vortex publicó una fecha nueva/.test(txt($('lista-notificaciones'))) && !/pidió unirse/.test(txt($('lista-notificaciones'))), 'filtrar por "Seguidos" muestra solo eso');
  console.log(f?'\nFALLAS: '+f:'\nTODO OK'); process.exit(f?1:0);
})();
