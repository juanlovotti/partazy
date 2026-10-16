// Prueba: Reservar entrada paga, cancelar y eliminar eventos (con aviso a los anotados).
const { JSDOM } = require('jsdom'); const fs = require('fs');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put=(p,v)=>store.docs.set(p,v);
put('users/A',{nombre:'Juan Lovotti',iniciales:'JL',ciudad:'Güemes',intereses:[],foto:'',nombreBusqueda:'juan lovotti',palabras:['juan','lovotti']});
put('users/A/privado/datos',{nacimiento:'2000-03-10'});
put('users/B',{nombre:'Sofía Gómez',iniciales:'SG',ciudad:'Nueva Córdoba',intereses:[],foto:'',nombreBusqueda:'sofia gomez',palabras:['sofia','gomez']});
put('users/B/privado/datos',{nacimiento:'1999-05-01'});
const abrir=(uid,hash)=>new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://partazy-5555d.web.app/'+(hash||''),
  beforeParse(w){ w.firebase=makeFirebase(store,()=>({uid,email:uid+'@t.com'})); w.navigator.geolocation=undefined; w.addEventListener('error',e=>console.error(`[${uid}] ERROR JS`,e.message)); }}).window;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const txt=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();
let fallos=0; const check=(c,m)=>{console.log((c?'✔ ':'✘ ')+m); if(!c) fallos++;};
(async()=>{
  const A=abrir('A'); await sleep(150); const $A=id=>A.document.getElementById(id);
  // A crea un evento pago
  A.ir('crear'); const f=new Date(Date.now()+3*864e5);
  $A('f-nombre').value='Fiesta Paga'; $A('f-lugar').value='Güemes'; $A('f-fecha').value=f.toISOString().slice(0,10); $A('f-hora').value='23:00';
  $A('f-capacidad').value='40'; $A('f-estilo').value='techno';
  A.toggleSwitchPago($A('switch-pago')); $A('f-precio').value='5000';
  if($A('f-pago-info')) $A('f-pago-info').value='alias fiesta.paga';
  check(txt($A('campo-precio')).includes('Estamos trabajando en un sistema seguro'), 'el formulario avisa al organizador del sistema seguro de devoluciones');
  await (async()=>{const c=A.confirmar; A.confirmar=async()=>true; A.mostrarVistaPrevia=async()=>true; try{await A.publicarEvento();}finally{A.confirmar=c;}})(); await sleep(80);
  const id=[...store.docs.keys()].find(k=>/^events\/[^/]+$/.test(k)).split('/')[1];
  check(!!id, 'A publica el evento pago');

  // B lo ve y reserva
  const B=abrir('B','#/evento/'+id); await sleep(200); const $B=x=>B.document.getElementById(x);
  check(txt($B('detalle-contenido')).includes('Estamos trabajando en un sistema seguro'), 'B ve el aviso de pagos y devoluciones en el detalle');
  $B('btn-accion-detalle').click(); await sleep(40);
  check(txt($B('modal-texto')).includes('reintegro lo coordinás con el organizador') && txt($B('modal-texto')).includes('sistema seguro'), 'al reservar, el modal explica que la devolución es con el organizador');
  $B('modal-ok').click(); await sleep(120);
  check(store.docs.get('events/'+id).confirmadosCount===2, 'B queda confirmado (2 confirmados)');

  // A intenta eliminar → no se puede, hay que cancelar
  A.abrirDetalle(id); await sleep(120);
  check(!!$A('btn-cancelar-evento') && !!$A('btn-eliminar-evento'), 'el organizador ve "Cancelar evento" y "Eliminar evento"');
  check(!$B('btn-cancelar-evento'), 'otros usuarios no ven esos botones');
  $A('btn-eliminar-evento').click(); await sleep(30);
  check(txt($A('modal-titulo'))==='Eliminar evento' && /1 persona anotada/.test(txt($A('modal-texto'))) && /al instante/.test(txt($A('modal-texto'))), 'con alguien confirmado, avisa que les llega el aviso y se borra al instante');
  $A('modal-cancelar').click(); await sleep(10);

  // A cancela con motivo
  $A('btn-cancelar-evento').click(); await sleep(30);
  check(txt($A('modal-texto')).includes('la devolución corre por tu cuenta') && txt($A('modal-texto')).includes('sistema seguro'), 'al cancelar, avisa al organizador que la devolución es suya');
  const inp=A.document.querySelector('#modal-bg textarea, #modal-bg input'); if(inp) inp.value='Se suspendió por lluvia';
  $A('modal-ok').click(); await sleep(150);
  const ev=store.docs.get('events/'+id);
  check(ev.estado==='cancelado' && ev.motivoCancelacion==='Se suspendió por lluvia', 'el evento queda cancelado con el motivo');
  const msj=[...store.docs.entries()].find(([k])=>k.startsWith('chats/'+id+'/messages/'));
  check(msj && msj[1].texto.includes('canceló') && msj[1].texto.includes('sistema seguro'), 'se publica el aviso en el grupo del evento');

  // B ve la cancelación
  B.abrirDetalle(id); await sleep(150);
  check(txt($B('detalle-contenido')).includes('Este evento fue cancelado') && txt($B('detalle-contenido')).includes('lluvia'), 'B ve el cartel "Este evento fue cancelado" con el motivo');
  B.abrirTicket(id); await sleep(150);
  check(txt($B('ticket-contenido')).includes('cancelado') && txt($B('ticket-contenido')).includes('sistema seguro'), 'en su entrada, B ve el aviso de cancelación y de devoluciones');
  B.ir('home'); B.renderHome(); await sleep(20);
  check(txt(B.document.getElementById('lista-cerca')).includes('Cancelado'), 'en Inicio la tarjeta dice "Cancelado"');

  // Evento sin confirmados: se puede eliminar
  A.ir('crear');
  $A('f-nombre').value='Evento Para Borrar'; $A('f-lugar').value='Centro'; $A('f-fecha').value=f.toISOString().slice(0,10); $A('f-hora').value='22:00';
  $A('f-capacidad').value='10'; $A('f-estilo').value='cumbia';
  await (async()=>{const c=A.confirmar; A.confirmar=async()=>true; A.mostrarVistaPrevia=async()=>true; try{await A.publicarEvento();}finally{A.confirmar=c;}})(); await sleep(80);
  const id2=[...store.docs.keys()].filter(k=>/^events\/[^/]+$/.test(k)).map(k=>k.split('/')[1]).find(x=>x!==id);
  A.abrirDetalle(id2); await sleep(120);
  $A('btn-eliminar-evento').click(); await sleep(30);
  check(txt($A('modal-titulo'))==='Eliminar evento', 'sin otros confirmados, pide confirmar la eliminación');
  $A('modal-ok').click(); await sleep(120);
  check(!store.docs.has('events/'+id2) && !store.docs.has('events/'+id2+'/attendees/A'), 'el evento y la asistencia del creador se borran');
  // El cancelado (con B confirmado) también se puede borrar ya, sin esperar a que pase
  A.abrirDetalle(id); await sleep(150);
  check(B.eval('state.eventos').some(e=>e.id===id), 'antes: B tiene el evento en su feed');
  $A('btn-eliminar-evento').click(); await sleep(30); $A('modal-ok').click(); await sleep(300);
  check(!store.docs.has('events/'+id), 'con confirmados: se elimina al instante');
  check([...store.docs.entries()].some(([k,v])=>k.startsWith('notificaciones/B/items/') && v.tipo==='evento_cancelado' && /eliminó/.test(v.texto||'')), 'a B le llega el aviso de que se eliminó');
  await sleep(600);
  check(!B.eval('state.eventos').some(e=>e.id===id), 'y desaparece solo del feed de B (sin recargar)');
  console.log(fallos?`\n${fallos} FALLOS`:'\nTODO OK'); process.exit(fallos?1:0);
})().catch(e=>{console.error('FALLO',e);process.exit(1);});
