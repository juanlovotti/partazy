// Prueba: eventos generales (charlas, ferias...), fecha límite para anotarse, vistas y estadísticas, y amigos en perfiles y en el inicio.
const { JSDOM } = require('jsdom');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put=(p,v)=>store.docs.set(p,v); const T=Date.now(), H=36e5;
for(const [u,n,h] of [['A','Juan Lovotti','juan'],['B','Sofia Gomez','sofi'],['C','Ivo Paz','ivo'],['D','Male Ruiz','male'],['O','Centro Cultural','ccc']]){ put('users/'+u,{nombre:n,usuario:h,iniciales:n[0],ciudad:'Córdoba',intereses:[],foto:''}); put(`users/${u}/privado/datos`,{nacimiento:'1998-01-01'}); }
put('friendships/A_B',{users:['A','B'],de:'A',para:'B',estado:'aceptada'});
put('friendships/A_C',{users:['A','C'],de:'C',para:'A',estado:'aceptada'});
put('friendships/B_C',{users:['B','C'],de:'B',para:'C',estado:'aceptada'});
put('friendships/B_D',{users:['B','D'],de:'B',para:'D',estado:'aceptada'});
put('friendships/B_O',{users:['B','O'],de:'B',para:'O',estado:'pendiente'});
const base={creador:'O',creadorNombre:'Centro Cultural',organizador:'Centro Cultural',categoria:'',tipo:'fiesta',privacidad:'publica',hora:'19:00',precio:0,capacidad:50,confirmadosCount:1,edadMinima:0,imagen:'',descripcion:'x',lugar:'Güemes 100',lat:-31.42,lng:-64.19,vistasCount:0};
put('events/ch',{...base,nombre:'Charla de Ciberseguridad',ocasion:'charla',fechaTs:T+48*H});
put('events/cerr',{...base,nombre:'Cena de Egresados',ocasion:'egresados',fechaTs:T+72*H,inscripcionHasta:T-H});
put('events/abie',{...base,nombre:'Feria del Libro',ocasion:'feria',fechaTs:T+96*H,inscripcionHasta:T+50*H});
put('planes/B',{eventos:['ch'],compartidos:[],red:{},ts:1});
const mk=uid=>new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://partazy.com/',beforeParse(w){ w.firebase=makeFirebase(store,()=>({uid,email:uid+'@t.com'})); w.navigator.geolocation=undefined; w.addEventListener('error',e=>console.error('ERROR JS',e.message)); }}).window;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const txt=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();
let f=0; const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m); if(!c) f++;};
(async()=>{
  const A=mk('A'); await sleep(1300); A.cerrarTutorial(); await A.cargarRed(); await sleep(300);
  const $=id=>A.document.getElementById(id);
  // Tipos generales
  A.elegirChipHome([...A.document.querySelectorAll('#chips-home .chip')].find(c=>c.textContent==='Charlas y talleres'),'charlas'); await sleep(50);
  ok(/Charla de Ciberseguridad/.test(txt($('lista-esta-noche'))) && !/Feria del Libro/.test(txt($('lista-esta-noche'))), 'filtro "Charlas y talleres" en el inicio');
  ok(/Charla \/ Seminario/.test(txt(A.document.querySelector('#lista-esta-noche .cat'))), 'la tarjeta dice "Charla / Seminario"');
  // Fila de amigos
  const fila=$('home-amigos-fila');
  ok(fila.style.display!=='none' && /Sofia/.test(txt(fila)) && /Ivo/.test(txt(fila)), 'el inicio muestra "Tus amigos"');
  ok(/Charla de Ciberseguridad/.test(txt(fila.querySelector('.con-plan'))), 'y a qué evento va cada uno');
  // Fecha límite
  A.abrirDetalle('cerr'); await sleep(500);
  ok(/Inscripción/.test(txt($('detalle-contenido'))) && /Cerró el/.test(txt($('detalle-contenido'))), 'el evento muestra que la inscripción cerró');
  ok($('btn-accion-detalle').disabled && /Inscripción cerrada/.test(txt($('btn-accion-detalle'))), 'y no deja anotarse');
  A.abrirDetalle('abie'); await sleep(500);
  ok(/quedan \d+ días|queda 1 día/.test(txt($('detalle-contenido'))) && !$('btn-accion-detalle').disabled, 'con la inscripción abierta muestra cuánto falta y deja anotarse');
  // Vistas
  A.abrirDetalle('ch'); await sleep(500);
  ok(store.docs.has('events/ch/vistas/A') && store.docs.get('events/ch').vistasCount>=1, 'abrir el evento cuenta una vista');
  const antes=store.docs.get('events/ch').vistasCount; A.abrirDetalle('ch'); await sleep(400);
  ok(store.docs.get('events/ch').vistasCount===antes, 'la misma persona cuenta una sola vez');
  // Amigos de otra persona
  A.abrirUsuario('B'); await sleep(700);
  ok(/3 amigos/.test(txt($('perfil-amigos-resumen'))) && /1 en común/.test(txt($('perfil-amigos-resumen'))), 'el perfil de Sofía dice "3 amigos · 1 en común" (la solicitud pendiente no cuenta)');
  const nombres=[...A.document.querySelectorAll('#perfil-amigos-lista .amigo-mini span')].map(s=>s.textContent);
  ok(nombres[0]==='Ivo' && nombres.includes('Male') && nombres.includes('Juan'), 'lista sus amigos, primero los que tienen en común');
  // Estadísticas para quien organiza
  const O=mk('O'); await sleep(1300); O.cerrarTutorial(); O.abrirDetalle('ch'); await sleep(500);
  const est=txt(O.document.getElementById('detalle-contenido'));
  ok(/Estadísticas/.test(est) && /persona lo vio|personas lo vieron/.test(est) && /se anotaron/.test(est), 'quien organiza ve las estadísticas (vistas, anotados, conversión)');
  ok(!store.docs.has('events/ch/vistas/O'), 'el organizador no suma vistas a su propio evento');
  ok(!/Estadísticas/.test(txt($('detalle-contenido'))), 'el resto no ve las estadísticas');
  console.log(f?'\nFALLAS: '+f:'\nTODO OK'); process.exit(f?1:0);
})();
