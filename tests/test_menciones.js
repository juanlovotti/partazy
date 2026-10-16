// Prueba: mencionar amigos con @ al compartir (sugerencias, aviso "te mencionó" y cómo se ve el comentario).
const { JSDOM } = require('jsdom');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put=(p,v)=>store.docs.set(p,v); const T=Date.now(), H=36e5;
for(const [u,n,h] of [['A','Juan Lovotti','juan'],['B','Sofia Gomez','sofi'],['C','Ivo Paz','ivo'],['X','Extraño Total','extrano'],['O','Vortex Club','vortex']]){ put('users/'+u,{nombre:n,usuario:h,iniciales:n[0],ciudad:'Córdoba',intereses:[],foto:''}); put(`users/${u}/privado/datos`,{nacimiento:'1998-01-01'}); }
put('friendships/A_B',{users:['A','B'],de:'A',para:'B',estado:'aceptada'});
put('friendships/A_C',{users:['A','C'],de:'C',para:'A',estado:'aceptada'});
put('events/e1',{creador:'O',creadorNombre:'Vortex Club',organizador:'Vortex Club',categoria:'techno',tipo:'fiesta',ocasion:'fiesta',privacidad:'publica',hora:'23:00',precio:0,capacidad:100,confirmadosCount:3,edadMinima:18,imagen:'',descripcion:'x',lugar:'Güemes',lat:-31.42,lng:-64.19,nombre:'Noche Vortex',fechaTs:T+48*H});
const mk=uid=>new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://partazy.web.app/',beforeParse(w){ w.firebase=makeFirebase(store,()=>({uid,email:uid+'@t.com'})); w.navigator.geolocation=undefined; w.addEventListener('error',e=>console.error('ERROR JS',e.message)); }}).window;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const txt=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();
let f=0; const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m); if(!c) f++;};
const notifs=uid=>[...store.docs.entries()].filter(([k])=>k.startsWith(`notificaciones/${uid}/items/`)).map(([,v])=>v);
(async()=>{
  const A=mk('A'); await sleep(1100);
  const $=id=>A.document.getElementById(id);
  A.abrirDetalle('e1'); await sleep(500);
  $('btn-repost').click(); await sleep(400);
  ok(/@/.test(txt($('modal-texto'))), 'la ventana explica que con @ se menciona a un amigo');
  const input=$('modal-input');
  const tipear=v=>{ input.value=v; input.selectionStart=input.selectionEnd=v.length; input.dispatchEvent(new A.Event('input')); };
  tipear('Vamos @'); await sleep(30);
  const ops=[...$('modal-menciones').querySelectorAll('[data-usuario]')].map(b=>b.dataset.usuario);
  ok($('modal-menciones').style.display==='block' && ops.includes('sofi') && ops.includes('ivo') && !ops.includes('extrano'), 'al escribir @ sugiere solo a tus amigos');
  tipear('Vamos @so'); await sleep(30);
  const opsS=[...$('modal-menciones').querySelectorAll('[data-usuario]')];
  ok(opsS.length===1 && opsS[0].dataset.usuario==='sofi', 'filtra mientras escribís (@so → Sofía)');
  opsS[0].dispatchEvent(new A.MouseEvent('mousedown',{bubbles:true})); await sleep(30);
  ok(input.value==='Vamos @sofi ' && $('modal-menciones').style.display==='none', 'tocar la sugerencia completa el @usuario');
  tipear(input.value+'y @extrano 🔥'); await sleep(30);
  $('modal-ok').click(); await sleep(600);
  const nB=notifs('B'), nC=notifs('C'), nX=notifs('X');
  ok(nB.some(n=>n.tipo==='mencion' && n.objetoId==='e1' && /@sofi/.test(n.texto)), 'a Sofía (mencionada) le llega "te mencionó" con el comentario');
  ok(!nB.some(n=>n.tipo==='evento_compartido'), 'a Sofía no le llega además el aviso común (no se duplica)');
  ok(nC.some(n=>n.tipo==='evento_compartido') && !nC.some(n=>n.tipo==='mencion'), 'a Ivo (no mencionado) le llega el aviso común de compartido');
  ok(!nX.length, 'a alguien que no es tu amigo no le llega nada aunque lo arrobes');
  ok(/le avisamos a Sofia/.test(txt($('toast'))), 'te confirma a quién le avisó');
  // Sofía ve la notificación y el comentario con la mención resaltada
  const B=mk('B'); await sleep(1200);
  B.abrirNotificaciones && B.abrirNotificaciones(); await sleep(300);
  ok(/Juan Lovotti te mencionó en Noche Vortex/.test(txt(B.document.getElementById('pantalla-notificaciones'))), 'Sofía ve "Juan te mencionó en Noche Vortex"');
  await B.cargarRed(); await sleep(300);
  const span=B.document.querySelector('#lista-compartidos .nota-amigo .mencion');
  ok(span && span.textContent==='@sofi', 'en el comentario la @mención se ve resaltada');
  ok(B.textoConMenciones('<b>@hack</b>').indexOf('<b>')===-1, 'el comentario se escapa (no se puede meter HTML)');
  console.log(f?'\nFALLAS: '+f:'\nTODO OK'); process.exit(f?1:0);
})();
