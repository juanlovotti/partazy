// Prueba: Editar un evento y aviso en el grupo.
const { JSDOM } = require('jsdom'); const fs = require('fs');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore();
store.docs.set('users/A',{nombre:'Juan Lovotti',iniciales:'JL',ciudad:'Güemes',intereses:[],foto:'',nombreBusqueda:'juan lovotti',palabras:['juan','lovotti']});
store.docs.set('users/A/privado/datos',{nacimiento:'2000-03-10'});
const w = new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://partazy.web.app/',
  beforeParse(w){ w.firebase = makeFirebase(store,()=>({uid:'A',email:'j@t.com'})); w.navigator.geolocation=undefined; w.addEventListener('error',e=>console.error('ERROR JS',e.message)); }}).window;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const $=id=>w.document.getElementById(id);
let fallas=0; const ok=(c,m)=>{ console.log((c?'✔ ':'✘ ')+m); if(!c) fallas++; };
const evDoc=()=>[...store.docs.entries()].find(([k])=>/^events\/[^/]+$/.test(k));
(async()=>{
  await sleep(700); w.cerrarTutorial(); await sleep(60); w.ir('crear');
  const f = new Date(Date.now()+3*864e5), iso=f.toISOString().slice(0,10);
  $('f-nombre').value='Fiesta Uno'; $('f-lugar').value='Güemes'; $('f-fecha').value=iso; $('f-hora').value='23:00'; $('f-capacidad').value='40'; $('f-estilo').value='cumbia';
  $('f-lineup').value='DJ A';
  const c=w.confirmar; w.confirmar=async()=>true; w.mostrarVistaPrevia=async()=>true; await w.publicarEvento(); w.confirmar=c; await sleep(80);
  const [k, ev] = evDoc(); const id=k.split('/')[1];
  ok(ev.nombre==='Fiesta Uno','evento creado');

  w.abrirDetalle(id); await sleep(150);
  ok(!!$('btn-editar-evento'), 'el creador ve "Editar evento"');
  $('btn-editar-evento').click(); await sleep(80);
  ok($('pantalla-crear').classList.contains('activa'), 'abre el formulario');
  ok($('crear-titulo').textContent==='Editar evento' && $('btn-publicar').textContent==='Guardar cambios', 'en modo edición');
  ok($('f-nombre').value==='Fiesta Uno' && $('f-fecha').value===iso && $('f-hora').value==='23:00' && $('f-capacidad').value==='40' && $('f-estilo').value==='cumbia' && $('f-lineup').value==='DJ A', 'campos precargados');
  ok($('crear-tipo').style.display==='none', 'no deja cambiar fiesta/previa');

  // sin cambios
  await w.publicarEvento(); await sleep(30);
  ok($('toast').textContent==='No cambiaste nada', 'avisa si no cambió nada');

  // capacidad menor a confirmados
  store.docs.get('events/'+id).confirmadosCount = 5; w.eval('state').editandoEv.confirmadosCount = 5;
  $('f-capacidad').value='3'; await w.publicarEvento(); await sleep(30);
  ok(/confirmados/.test($('toast').textContent), 'no deja bajar la capacidad por debajo de los confirmados');

  $('f-capacidad').value='80'; $('f-nombre').value='Fiesta Uno (edición 2)'; $('f-hora').value='23:30'; $('f-lineup').value='DJ A\nDJ B';
  await w.publicarEvento(); await sleep(300);
  const e2 = store.docs.get('events/'+id);
  ok(e2.nombre==='Fiesta Uno (edición 2)' && e2.capacidad===80 && e2.hora==='23:30' && e2.lineup==='DJ A\nDJ B', 'guarda los cambios');
  ok(e2.creador==='A' && e2.privacidad==='publica' && e2.confirmadosCount===5, 'no toca creador, privacidad ni confirmados');
  ok(typeof e2.editadoTs==='number', 'marca la fecha de edición');
  ok(!('lat' in e2) || e2.lat===ev.lat, 'mismo lugar: no mueve el pin');
  const msj=[...store.docs.entries()].find(([k])=>k.startsWith('chats/'+id+'/messages/'));
  ok(msj && /actualizó el evento/.test(msj[1].texto) && /fecha y hora/.test(msj[1].texto), 'avisa en el grupo el cambio de horario');
  ok($('pantalla-detalle').classList.contains('activa'), 'vuelve al detalle');
  ok(/edición 2/.test($('detalle-contenido').textContent), 'el detalle muestra el nombre nuevo');

  // salir del modo edición al tocar Crear
  $('btn-editar-evento').click(); await sleep(50);
  w.ir('home'); w.ir('crear'); await sleep(20);
  ok($('crear-titulo').textContent==='Crear' && $('f-nombre').value==='' && !w.eval('state').editandoId, 'Crear desde la barra arranca un formulario vacío');
  // cerrar con la X vuelve al evento
  $('btn-editar-evento') ; w.abrirDetalle(id); await sleep(120); $('btn-editar-evento').click(); await sleep(40);
  w.cerrarCrear(); await sleep(80);
  ok($('pantalla-detalle').classList.contains('activa') && !w.eval('state').editandoId, 'la X cancela y vuelve al evento');
  console.log(fallas ? '\nFALLAS: '+fallas : '\nTODO OK'); process.exit(fallas?1:0);
})();
