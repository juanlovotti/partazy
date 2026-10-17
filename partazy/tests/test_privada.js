// Prueba: Previas privadas: la dirección solo la ven los aprobados.
const { JSDOM } = require('jsdom'); const fs = require('fs');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put=(p,v)=>store.docs.set(p,v); const T=Date.now();
const perfil=(uid,nombre)=>{ put('users/'+uid,{nombre,usuario:nombre.toLowerCase(),iniciales:nombre[0],ciudad:'Córdoba',intereses:[],foto:'',nombreBusqueda:nombre.toLowerCase(),palabras:[nombre.toLowerCase()]}); put(`users/${uid}/privado/datos`,{nacimiento:'1998-01-01'}); };
perfil('H','Host'); perfil('B','Bruno'); perfil('C','Caro');
put('events/p1',{creador:'H',creadorNombre:'Host',organizador:'Host',nombre:'F- FEST',categoria:'cachengue',tipoLugar:'Previa',tipo:'previa',privacidad:'privada',hora:'23:00',lugar:'17 de Agosto 458, Villa Zoila',lat:-31.42,lng:-64.19,precio:0,capacidad:20,confirmadosCount:2,edadMinima:18,dresscode:'Libre',musica:'Cachengue',imagen:'',descripcion:'x',reglas:'x',estado:'publicado',fechaTs:T+2*864e5,createdAt:T-864e5});
put('events/p1/private/data',{direccion:'17 de Agosto 458, Villa Zoila'});
put('events/p1/attendees/C',{uid:'C',nombre:'Caro',estado:'aprobado',ts:1});
const abrir=uid=>new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://partazy.web.app/',beforeParse(w){ w.firebase=makeFirebase(store,()=>({uid,email:uid+'@t.com'})); w.navigator.geolocation=undefined; w.addEventListener('error',e=>console.error(uid,'ERROR JS',e.message)); }}).window;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const txt=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();
let f=0; const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m); if(!c) f++;};
(async()=>{
  const B=abrir('B'), C=abrir('C'), H=abrir('H'); await sleep(900); [B,C,H].forEach(w=>w.cerrarTutorial()); await sleep(200);
  // fakefb no aplica reglas: simulamos que la dirección privada solo la leen creador y aprobados
  B.eval("DataService.getDireccionExacta = async () => null");
  B.aplicarUbicacion({lat:-31.4201,lng:-64.1888}, true, 'Córdoba'); B.ir('explorar'); B.renderExplorar(); await sleep(50);
  const listaB=txt(B.document.getElementById('lista-explorar-cont'));
  ok(/F- FEST/.test(listaB) && !/458|17 de Agosto/.test(listaB), 'no invitado: la tarjeta no muestra la dirección');
  ok(/~\d+ km/.test(listaB), 'no invitado: la distancia va redondeada (~X km)');
  B.document.getElementById('input-buscar').value='agosto'; B.eval("state.busqueda='agosto'"); B.renderExplorar(); await sleep(50);
  ok(!/F- FEST/.test(txt(B.document.getElementById('lista-explorar-cont'))), 'no invitado: buscar por la calle no encuentra la previa');
  B.eval("state.busqueda=''"); B.abrirDetalle('p1'); await sleep(300);
  const detB=txt(B.document.getElementById('detalle-contenido'));
  ok(!/458|17 de Agosto/.test(detB) && /la ven solo los invitados aprobados/.test(detB), 'no invitado: el detalle no muestra la dirección');
  ok(!/Cómo llegar/.test(detB), 'no invitado: no hay "Cómo llegar"');
  C.abrirDetalle('p1'); await sleep(300);
  ok(/17 de Agosto 458/.test(txt(C.document.getElementById('detalle-contenido'))), 'invitado aprobado: ve la dirección exacta');
  H.abrirDetalle('p1'); await sleep(300);
  ok(/17 de Agosto 458/.test(txt(H.document.getElementById('detalle-contenido'))), 'quien organiza: ve la dirección');
  // Publicar con la dirección en el campo público
  H.ir('crear'); H.elegirTipo('previa');
  const $=id=>H.document.getElementById(id);
  $('f-nombre').value='Otra previa'; $('f-lugar').value='Colón 1234'; $('f-direccion').value='Colón 1234 piso 3'; $('f-fecha').value=new Date(T+3*864e5).toISOString().slice(0,10); $('f-hora').value='23:00'; $('f-capacidad').value='15'; $('f-estilo').value='cumbia';
  const p=H.publicarEvento(); await sleep(100);
  ok($('modal-bg').classList.contains('show') && /Ojo con la dirección/.test($('modal-titulo').textContent), 'si escribe la dirección en "Barrio o zona", la app lo frena');
  $('modal-ok').click(); await p; await sleep(100);
  ok(![...store.docs.values()].some(v=>v.nombre==='Otra previa'), 'y no se publica hasta corregirlo');
  console.log(f?'\nFALLAS: '+f:'\nTODO OK'); process.exit(f?1:0);
})();
