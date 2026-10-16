// Prueba: comentario opcional al compartir (límite de 15 palabras), cómo lo ven los amigos, y el tutorial nuevo.
const { JSDOM } = require('jsdom');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put=(p,v)=>store.docs.set(p,v); const T=Date.now(), H=36e5;
for(const [u,n] of [['A','Juan Lovotti'],['B','Sofia Gomez'],['O','Vortex Club']]){ put('users/'+u,{nombre:n,usuario:n.split(' ')[0].toLowerCase(),iniciales:n[0],ciudad:'Córdoba',intereses:[],foto:''}); put(`users/${u}/privado/datos`,{nacimiento:'1998-01-01'}); }
put('friendships/A_B',{users:['A','B'],de:'A',para:'B',estado:'aceptada'});
const base={creador:'O',creadorNombre:'Vortex Club',organizador:'Vortex Club',categoria:'techno',tipo:'fiesta',ocasion:'fiesta',privacidad:'publica',hora:'23:00',precio:0,capacidad:100,confirmadosCount:3,edadMinima:18,imagen:'',descripcion:'x',lugar:'Güemes',lat:-31.42,lng:-64.19};
put('events/e1',{...base,nombre:'Noche Vortex',fechaTs:T+48*H});
put('events/e2',{...base,nombre:'Sunset Rooftop',fechaTs:T+72*H});
const mk=uid=>new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://partazy.web.app/',beforeParse(w){ w.firebase=makeFirebase(store,()=>({uid,email:uid+'@t.com'})); w.navigator.geolocation=undefined; w.addEventListener('error',e=>console.error('ERROR JS',e.message)); }}).window;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const txt=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();
let f=0; const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m); if(!c) f++;};
(async()=>{
  const A=mk('A'); await sleep(1100);
  const $=id=>A.document.getElementById(id);
  // Compartir con comentario
  A.abrirDetalle('e1'); await sleep(500);
  $('btn-repost').click(); await sleep(300);
  ok($('modal-bg').classList.contains('show') && /opcional/.test(txt($('modal-texto'))), 'al compartir pide un comentario y aclara que es opcional');
  const input=$('modal-input');
  input.value='uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciseis'; input.dispatchEvent(new A.Event('input')); await sleep(30);
  ok($('modal-ok').disabled && /16\/15/.test(txt($('modal-contador'))), 'con más de 15 palabras el contador avisa y no deja compartir');
  input.value='¡Vamos a esta! 🔥'; input.dispatchEvent(new A.Event('input')); await sleep(30);
  ok(!$('modal-ok').disabled && /4\/15/.test(txt($('modal-contador'))), 'dentro del límite se puede compartir');
  $('modal-ok').click(); await sleep(400);
  ok(store.docs.has('events/e1/reposts/A') && store.docs.get('events/e1').repostsCount===1, 'quedó compartido');
  A.guardarMisPlanes && await A.guardarMisPlanes(); await sleep(200);
  const pl=store.docs.get('planes/A');
  ok(pl && pl.compartidos.includes('e1') && pl.notas?.e1==='¡Vamos a esta! 🔥', 'el comentario se guarda junto con lo compartido (solo lo leen tus amigos)');
  // Compartir sin comentario
  A.abrirDetalle('e2'); await sleep(500);
  $('btn-repost').click(); await sleep(300); $('modal-ok').click(); await sleep(400);
  await A.guardarMisPlanes(); await sleep(200);
  ok(store.docs.has('events/e2/reposts/A') && !('e2' in (store.docs.get('planes/A').notas||{})), 'sin comentario también se comparte');
  // Cancelar no comparte
  // (dejar de compartir e2 y volver a intentarlo cancelando)
  A.abrirDetalle('e2'); await sleep(500); $('btn-repost').click(); await sleep(400);
  ok(!store.docs.has('events/e2/reposts/A'), 'tocar de nuevo deja de compartir');
  A.abrirDetalle('e2'); await sleep(500); $('btn-repost').click(); await sleep(300); $('modal-cancelar').click(); await sleep(300);
  ok(!store.docs.has('events/e2/reposts/A'), '"Cancelar" en la ventana no comparte nada');
  // Perfil muestra mi comentario
  A.ir('perfil'); await sleep(100);
  ok(/¡Vamos a esta!/.test(txt($('perfil-compartidos'))), 'en mi perfil veo lo que compartí con mi comentario');
  // La amiga lo ve en su inicio
  const B=mk('B'); await sleep(1100); await B.cargarRed(); await sleep(300);
  const lista=B.document.getElementById('lista-compartidos');
  ok(/Juan lo compartió/.test(txt(lista)) && /“¡Vamos a esta! 🔥”/.test(txt(lista)) && /— Juan/.test(txt(lista)), 'Sofía ve el evento con el comentario de Juan');
  // Un comentario largo que llegue de otro lado se recorta
  ok(B.limpiarNota('a '.repeat(40)).split(' ').length===15, 'un comentario más largo se recorta a 15 palabras');
  // Tutorial nuevo
  A.abrirTutorial(); await sleep(50);
  const pasos=A.pasosTutorial();
  ok(pasos.length===6 && pasos.filter(p=>p.dibujo).length>=4, 'el tutorial tiene 6 pasos con dibujitos de la app');
  A.pasoTutorial(1); A.pasoTutorial(1); await sleep(30);
  ok(A.document.querySelector('#tuto-slide .tm-evento') && /Confirmar asistencia/.test(txt($('tuto-slide'))), 'el paso "Anotate" muestra un evento con el botón de confirmar');
  console.log(f?'\nFALLAS: '+f:'\nTODO OK'); process.exit(f?1:0);
})();
