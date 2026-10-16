// Prueba: Calificaciones: quién puede, promedios del evento y de organizaciones, personas sin nota.
const { JSDOM } = require('jsdom'); const fs = require('fs');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put=(p,v)=>store.docs.set(p,v); const T=Date.now(); const H=36e5;
put('users/A',{nombre:'Juan',usuario:'juan',iniciales:'J',ciudad:'Córdoba',intereses:[],foto:'',nombreBusqueda:'juan',palabras:['juan']}); put('users/A/privado/datos',{nacimiento:'1998-01-01'});
put('users/O',{nombre:'Vortex Club',usuario:'vortex',iniciales:'VC',tipoCuenta:'organizacion',ciudad:'Córdoba',intereses:[],foto:'',califN:3,califSuma:12});
put('users/P',{nombre:'Sofi',usuario:'sofi',iniciales:'S',ciudad:'Córdoba',intereses:[],foto:''});
const ev=(id,o)=>put('events/'+id,Object.assign({creador:'O',creadorNombre:'Vortex Club',organizador:'Vortex Club',categoria:'techno',tipo:'fiesta',ocasion:'fiesta',privacidad:'publica',hora:'23:30',lugar:'Güemes',lat:-31.42,lng:-64.19,precio:5000,capacidad:200,confirmadosCount:20,edadMinima:18,imagen:'',descripcion:'x',deOrganizacion:true},o));
ev('e1',{nombre:'Noche Vortex',fechaTs:T-8*H});
ev('e2',{nombre:'Próxima Vortex',fechaTs:T+48*H});
ev('e3',{nombre:'Previa de Sofi',creador:'P',creadorNombre:'Sofi',organizador:'Sofi',tipo:'previa',ocasion:'previa',privacidad:'privada',deOrganizacion:false,fechaTs:T-30*H});
ev('e4',{nombre:'Muy vieja',fechaTs:T-40*24*H});
put('events/e1/attendees/A',{uid:'A',nombre:'Juan',estado:'confirmado'}); put('events/e2/attendees/A',{uid:'A',nombre:'Juan',estado:'confirmado'});
put('events/e3/attendees/A',{uid:'A',nombre:'Juan',estado:'aprobado'}); put('events/e4/attendees/A',{uid:'A',nombre:'Juan',estado:'confirmado'});
const w=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://partazy.web.app/',beforeParse(w){ w.firebase=makeFirebase(store,()=>({uid:'A',email:'a@t.com'})); w.navigator.geolocation=undefined; w.addEventListener('error',e=>console.error('ERROR JS',e.message)); for(let i=0;i<w.localStorage.length;i++){} try{ Object.keys({}).forEach(()=>{}); }catch(e){} }}).window;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const $=id=>w.document.getElementById(id); const txt=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();
let f=0; const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m); if(!c) f++;};
const estrellas=(root,nombre,v)=>root.querySelector(`[data-estrellas="${nombre}"] [data-estrella="${v}"]`).click();
(async()=>{
  await sleep(300); w.eval("localStorage.setItem(claveTutorial(),'1')"); w.cerrarTutorial && w.cerrarTutorial();
  w.eval("revisarParaCalificar()"); await sleep(400);
  const hoja=$('hoja-vista');
  ok(hoja.classList.contains('show') && /¿Cómo estuvo\?/.test(txt(hoja)) && /(Noche Vortex|Previa de Sofi)/.test(txt(hoja)), 'al entrar te pregunta cómo estuvo un evento al que fuiste: '+txt(hoja.querySelector('h3')));
  const primero=txt(hoja.querySelector('h3'));
  ok(!/Muy vieja|Próxima/.test(txt(hoja)), 'no pregunta por eventos futuros ni de hace más de 15 días');
  // Enviar sin estrellas
  hoja.querySelector('[data-enviar-calif]').click(); await sleep(50);
  ok(/estrellas/.test(txt($('toast'))), 'si falta una fila, pide completar');
  estrellas(hoja,'joda',5); estrellas(hoja,'anfitrion',4); await sleep(20);
  ok(hoja.querySelectorAll('[data-estrellas="joda"] .on').length===5 && /Increíble/.test(txt(hoja)), 'las estrellas se pintan y muestran "¡Increíble!"');
  hoja.querySelector('[data-enviar-calif]').click(); await sleep(250);
  const id1 = primero==='Noche Vortex'?'e1':'e3';
  const c1=store.docs.get(`events/${id1}/calificaciones/A`);
  ok(c1 && c1.joda===5 && c1.anfitrion===4 && !hoja.classList.contains('show'), 'se guarda la calificación y se cierra');
  // Calificar el otro desde el detalle
  const id2 = id1==='e1'?'e3':'e1';
  w.abrirDetalle(id2); await sleep(400);
  const b=$('bloque-calif');
  ok(b.style.display!=='none' && b.querySelector('[data-calif-root]'), 'en el detalle de un evento que ya pasó aparece "¿Cómo estuvo?"');
  ok(id2==='e3' ? /El anfitrión/.test(txt(b)) : /La organización/.test(txt(b)), 'previa de persona: "El anfitrión" / boliche: "La organización"');
  estrellas(b,'joda',4); estrellas(b,'anfitrion',2); b.querySelector('[data-enviar-calif]').click(); await sleep(500);
  const e1=store.docs.get('events/e1'), e3=store.docs.get('events/e3'), O=store.docs.get('users/O'), P=store.docs.get('users/P');
  const notaE1 = id1==='e1' ? [5,4] : [4,2];
  ok(e1.califN===1 && e1.califJoda===notaE1[0] && e1.califAnf===notaE1[1], 'el evento suma la calificación (joda y organización)');
  ok(O.califN===4 && O.califSuma===12+notaE1[1], 'la organización acumula su nota: '+O.califN+' / '+O.califSuma);
  ok(e3.califN===1 && !P.califN && !P.califSuma, 'la previa de una persona se califica, pero la persona NO tiene nota');
  // resumen en el detalle
  w.abrirDetalle('e1'); await sleep(400);
  ok(/La joda/.test(txt($('bloque-calif'))) && /1 calificación de gente que fue/.test(txt($('bloque-calif'))) && /Ya calificaste/.test(txt($('bloque-calif'))), 'el evento muestra su nota y "Ya calificaste"');
  ok(/★ 4,/.test(txt(w.document.querySelector('.organizador'))), 'al lado del organizador aparece la nota de la organización: '+txt(w.document.querySelector('.organizador .rol')));
  // evento futuro: sin formulario
  w.abrirDetalle('e2'); await sleep(400);
  ok($('bloque-calif').style.display==='none', 'evento que todavía no pasó: no se puede calificar');
  // página de la organización y de la persona
  w.abrirUsuario('O'); await sleep(400);
  ok(/★ 4,\d · 4 calificaciones/.test(txt($('usuario-contenido'))), 'la página de la organización muestra su calificación');
  w.abrirUsuario('P'); await sleep(400);
  ok(!/★|calificaci/.test(txt($('usuario-contenido'))), 'el perfil de una persona no muestra calificación');
  // no pregunta de nuevo
  w.eval("revisarParaCalificar()"); await sleep(400);
  ok(!$('hoja-vista').classList.contains('show'), 'no vuelve a preguntar por lo ya calificado');
  console.log(f?'\nFALLAS: '+f:'\nTODO OK'); process.exit(f?1:0);
})();
