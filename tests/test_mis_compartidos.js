// Prueba: ver mis propios compartidos en el inicio y editar / borrar mi comentario (desde el evento y desde el perfil).
const { JSDOM } = require('jsdom');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put=(p,v)=>store.docs.set(p,v); const T=Date.now(), H=36e5;
for(const [u,n,h] of [['A','Juan Lovotti','juan'],['B','Sofia Gomez','sofi'],['O','Vortex Club','vortex']]){ put('users/'+u,{nombre:n,usuario:h,iniciales:n[0],ciudad:'Córdoba',intereses:[],foto:''}); put(`users/${u}/privado/datos`,{nacimiento:'1998-01-01'}); }
put('friendships/A_B',{users:['A','B'],de:'A',para:'B',estado:'aceptada'});
put('events/e1',{creador:'O',creadorNombre:'Vortex Club',organizador:'Vortex Club',categoria:'techno',tipo:'fiesta',ocasion:'fiesta',privacidad:'publica',hora:'23:00',precio:0,capacidad:100,confirmadosCount:3,edadMinima:18,imagen:'',descripcion:'x',lugar:'Güemes',lat:-31.42,lng:-64.19,nombre:'Noche Vortex',fechaTs:T+48*H});
const mk=uid=>new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://partazy.web.app/',beforeParse(w){ w.firebase=makeFirebase(store,()=>({uid,email:uid+'@t.com'})); w.navigator.geolocation=undefined; w.addEventListener('error',e=>console.error('ERROR JS',e.message)); }}).window;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const txt=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();
let f=0; const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m); if(!c) f++;};
(async()=>{
  const A=mk('A'); await sleep(1100);
  const $=id=>A.document.getElementById(id);
  const escribir=v=>{ const i=$('modal-input'); i.value=v; i.dispatchEvent(new A.Event('input')); };
  // Compartir con comentario
  A.abrirDetalle('e1'); await sleep(500);
  $('btn-repost').click(); await sleep(400); escribir('Primera versión'); $('modal-ok').click(); await sleep(700);
  ok(/Tu comentario/.test(txt($('mi-nota-repost'))) && /Primera versión/.test(txt($('mi-nota-repost'))), 'en el evento veo mi comentario debajo del botón');
  // Editar desde el evento
  A.document.querySelector('#mi-nota-repost [data-editar-nota]').click(); await sleep(400);
  ok($('modal-input').value==='Primera versión', 'al editar aparece el comentario actual para cambiarlo');
  escribir('Versión nueva @sofi'); $('modal-ok').click(); await sleep(700);
  ok(store.docs.get('planes/A').notas.e1==='Versión nueva @sofi', 'el comentario editado se guarda');
  ok(/Versión nueva/.test(txt($('mi-nota-repost'))), 'el evento muestra el comentario nuevo');
  const menc=[...store.docs.entries()].filter(([k,v])=>k.startsWith('notificaciones/B/') && v.tipo==='mencion');
  ok(menc.length===1, 'si al editar mencionás a alguien nuevo, le llega el aviso');
  // Mi compartido en el inicio
  A.ir('home'); A.renderHome(); await sleep(200);
  const lista=$('lista-compartidos');
  ok(lista.style.display!=='none' && /Noche Vortex/.test(txt(lista)) && /Lo compartiste vos/.test(txt(lista)) && /— Vos/.test(txt(lista)), 'en el inicio veo lo que compartí yo, con mi comentario');
  ok(txt(A.document.querySelector('#titulo-compartidos h2'))==='Lo que compartiste', 'la sección se titula "Lo que compartiste" cuando es solo mío');
  // Borrar desde el perfil
  A.ir('perfil'); A.pintarMisCompartidos(); await sleep(100);
  const borrar=$('perfil-compartidos').querySelector('[data-borrar-nota]');
  ok(borrar, 'en el perfil cada compartido tiene botón para borrar el comentario');
  borrar.click(); await sleep(150);
  ok(/¿Borrar tu comentario\?/.test(txt($('modal-titulo'))), 'pide confirmar');
  $('modal-ok').click(); await sleep(500);
  ok(!('e1' in (store.docs.get('planes/A').notas||{})) && store.docs.get('planes/A').compartidos.includes('e1'), 'se borra el comentario pero el evento sigue compartido');
  ok(store.docs.has('events/e1/reposts/A'), 'el compartido sigue registrado');
  ok(/Comentar/.test(txt($('perfil-compartidos'))) && !/Versión nueva/.test(txt($('perfil-compartidos'))), 'en el perfil ya no aparece el comentario y se puede volver a comentar');
  // Tocar el botón dentro de la tarjeta no abre el evento
  $('perfil-compartidos').querySelector('[data-editar-nota]').click(); await sleep(300);
  ok(A.eval("pantallaActual()")==='perfil' && $('modal-bg').classList.contains('show'), 'tocar el botón del comentario abre la ventana, no el evento');
  $('modal-cancelar').click(); await sleep(100);
  console.log(f?'\nFALLAS: '+f:'\nTODO OK'); process.exit(f?1:0);
})();
