// Prueba: Mis entradas, editar desde el perfil, exportar CSV, venta externa, compartidos.
const { JSDOM } = require('jsdom'); const fs = require('fs');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put=(p,v)=>store.docs.set(p,v); const T=Date.now(); const H=36e5;
for(const [u,n] of [['A','Juan Lovotti'],['B','Sofia Gomez'],['C','Ivo Paz'],['G','Gino Dellamaggiore']]){ put('users/'+u,{nombre:n,usuario:n.split(' ')[0].toLowerCase(),iniciales:n[0],ciudad:'Córdoba',intereses:[],foto:''}); put(`users/${u}/privado/datos`,{nacimiento:'1998-01-01'}); }
put('friendships/A_B',{users:['A','B'],de:'A',para:'B',estado:'aceptada'});
const base={categoria:'',tipo:'fiesta',ocasion:'fiesta',privacidad:'publica',hora:'23:00',precio:0,capacidad:100,confirmadosCount:1,edadMinima:18,imagen:'',descripcion:'x',lugar:'Belgrano 800',lat:-31.42,lng:-64.19};
put('events/f1',{...base,nombre:'Fiesta Uno',creador:'C',creadorNombre:'Ivo Paz',fechaTs:T+20*H,confirmadosCount:2});
put('events/f2',{...base,nombre:'Fiesta Dos',creador:'C',creadorNombre:'Ivo Paz',fechaTs:T+50*H,confirmadosCount:2});
put('events/mia',{...base,nombre:'Mi Previa',creador:'A',creadorNombre:'Juan Lovotti',tipo:'previa',ocasion:'previa',fechaTs:T+70*H,confirmadosCount:3});
put('events/ext',{...base,nombre:'Tejas Fest',creador:'G',creadorNombre:'Gino Dellamaggiore',precio:80000,linkEntradas:'https://www.instagram.com/tejas',capacidad:20000,capacidadDesconocida:true,lugar:'Tejas de la Candelaria',fechaTs:T+90*H});
put('events/f1/attendees/A',{uid:'A',nombre:'Juan Lovotti',estado:'confirmado',ticket:'PT-1'}); put('events/f2/attendees/A',{uid:'A',nombre:'Juan Lovotti',estado:'confirmado',ticket:'PT-2'});
put('events/mia/attendees/A',{uid:'A',nombre:'Juan Lovotti',estado:'confirmado',ticket:'PT-3'});
put('events/mia/attendees/B',{uid:'B',nombre:'Sofia Gomez',estado:'aprobado',ticket:'PT-4',checkinTs:T});
put('events/mia/attendees/C',{uid:'C',nombre:'Ivo Paz',estado:'solicitado'});
put('planes/B',{eventos:[],compartidos:['f2'],red:{},ts:1});
let blobs=[];
const w=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://partazy.web.app/',beforeParse(w){ w.firebase=makeFirebase(store,()=>({uid:'A',email:'a@t.com'})); w.navigator.geolocation=undefined;
  w.URL.createObjectURL=b=>{ blobs.push(b); return 'blob:x'; }; w.URL.revokeObjectURL=()=>{};
  w.addEventListener('error',e=>console.error('ERROR JS',e.message)); }}).window;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const $=id=>w.document.getElementById(id); const txt=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();
const act=()=>w.document.querySelector('.screen.activa').id.replace('pantalla-','');
let f=0; const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m); if(!c) f++;};
(async()=>{
  await sleep(900); w.cerrarTutorial(); await sleep(1800);
  // Mis entradas: todas
  await w.irAMisEntradas(); await sleep(300);
  const ent=[...w.document.querySelectorAll('#ticket-contenido .entrada-mini')];
  ok(ent.length===3 && /Fiesta Uno/.test(txt($('ticket-contenido'))) && /Fiesta Dos/.test(txt($('ticket-contenido'))), 'Mis entradas muestra todas (3), no solo una');
  ok(/Organizás/.test(txt(ent.find(e=>/Mi Previa/.test(e.textContent)))), 'marca las que organizás');
  ent[1].click(); await sleep(300);
  ok(act()==='ticket' && /Fiesta Dos/.test(txt($('ticket-contenido'))) && /Mis entradas \(3\)/.test(txt($('ticket-contenido'))), 'tocar una abre esa entrada, con botón para volver a Mis entradas');
  // Perfil: editar mi evento
  w.ir('perfil'); await w.renderPerfilVista(); await sleep(200);
  const itemMio=[...w.document.querySelectorAll('#perfil-proximos .item-simple')].find(x=>/Mi Previa/.test(x.textContent));
  ok(itemMio && /ORGANIZÁS/.test(txt(itemMio)) && itemMio.querySelector('[data-editar]'), 'en el perfil, tus eventos dicen ORGANIZÁS y tienen "Editar"');
  itemMio.querySelector('[data-editar]').click(); await sleep(400);
  ok(act()==='crear' && $('f-nombre').value==='Mi Previa' && /Guardar cambios/.test(txt($('btn-publicar'))), 'Editar desde el perfil abre el formulario de edición');
  w.cerrarCrear ? w.eval("state.editandoId=null; resetFormularioCrear()") : 0;
  // Exportar
  w.abrirDetalle('mia'); await sleep(400);
  const bcsv=w.document.querySelector('[data-exportar="mia|csv"]');
  ok(bcsv && w.document.querySelector('[data-exportar="mia|pdf"]'), 'quien organiza tiene Excel (CSV) y PDF');
  bcsv.click(); await sleep(500);
  const csv = blobs.length ? await new Promise(r=>{ const fr=new w.FileReader(); fr.onload=()=>r(fr.result); fr.readAsText(blobs[0]); }) : '';
  ok(/"Nombre";"Usuario";"Estado"/.test(csv) && /"Sofia Gomez";"@sofia";"Aprobado"/.test(csv) && /"Ivo Paz";"@ivo";"Solicitud pendiente"/.test(csv), 'el CSV trae nombre, @usuario y estado (abre en Excel con acentos)');
  ok(/"Sofia Gomez";"@sofia";"Aprobado";"";"Sí"/.test(csv), 'y marca quién ya ingresó');
  // Venta externa
  w.abrirDetalle('ext'); await sleep(400);
  const det=txt($('detalle-contenido'));
  ok(/Según la venta/.test(det) && /el cupo lo maneja instagram\.com/.test(det) && !w.document.querySelector('#detalle-contenido .barra-cupo'), 'venta en otra página: no muestra "1/20000", aclara que el cupo lo maneja quien vende');
  ok(/Comprar en instagram\.com/.test(txt($('btn-accion-detalle'))), 'el botón principal sigue siendo comprar');
  const ya=w.document.querySelector('[data-ya-compre]');
  ok(ya && /Ya compré mi entrada/.test(txt(ya)), 'aparece "Ya compré mi entrada · Avisar que voy"');
  ya.click(); await sleep(100);
  ok(/¿Ya tenés tu entrada\?/.test(txt($('modal-titulo'))), 'pregunta si ya la compró');
  $('modal-ok').click(); await sleep(500);
  ok(store.docs.get('events/ext/attendees/A')?.estado==='confirmado' && store.docs.get('events/ext').confirmadosCount===2, 'queda anotado y suma en el contador');
  ok(act()==='ticket' && /Tu entrada es la que compraste en instagram\.com/.test(txt($('ticket-contenido'))) && !/💳 Pago/.test(txt($('ticket-contenido'))), 'su "entrada" en Partazy aclara que la válida es la que compró afuera');
  // Cómo llegar
  w.abrirDetalle('f1'); await sleep(400);
  const link=[...w.document.querySelectorAll('#detalle-contenido a.link-ext')].find(a=>/Cómo llegar/.test(a.textContent));
  ok(link && /google\.com\/maps\/dir\/\?api=1&destination=/.test(link.href), '"Cómo llegar" abre indicaciones (funciona mejor en la app del celu)');
  // Compartidos
  w.ir('home'); w.renderHome(); await sleep(100);
  ok($('titulo-compartidos').style.display!=='none' && /Fiesta Dos/.test(txt($('lista-compartidos'))) && /Sofia lo compartió/.test(txt($('lista-compartidos'))), 'inicio: sección "Compartidos por tus amigos" con quién lo compartió');
  w.eval("state.misCompartidos=['f1']"); w.ir('perfil'); await w.renderPerfilVista(); await sleep(100);
  ok($('perfil-compartidos-bloque').style.display!=='none' && /Fiesta Uno/.test(txt($('perfil-compartidos'))), 'perfil: sección "Compartiste"');
  // Capacidad vacía con link
  w.ir('crear'); $('f-nombre').value='Con link'; $('f-lugar').value='Belgrano 900'; $('f-fecha').value=new Date(T+5*864e5).toISOString().slice(0,10); $('f-hora').value='23:00'; $('f-capacidad').value='';
  w.toggleSwitchPago($('switch-pago')); $('f-precio').value='5000'; $('f-link-entradas').value='https://alpogo.com/x';
  ok($('ayuda-capacidad').style.display!=='none', 'con entrada paga explica que la capacidad puede quedar vacía');
  w.mostrarVistaPrevia=async()=>true; await w.publicarEvento(); await sleep(300);
  const cl=[...store.docs.values()].find(v=>v.nombre==='Con link');
  ok(cl && cl.capacidadDesconocida===true && cl.capacidad===20000, 'sin tope: se publica igual');
  console.log(f?'\nFALLAS: '+f:'\nTODO OK'); process.exit(f?1:0);
})();
