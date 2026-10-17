// Prueba: ubicación — mensajes claros cuando no se puede, sugerencias de lugares reales y no aceptar lugares que no existen.
const { JSDOM } = require('jsdom');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put=(p,v)=>store.docs.set(p,v);
put('users/A',{nombre:'Juan Lovotti',usuario:'juan',iniciales:'J',ciudad:'Río Tercero',intereses:['Techno'],foto:''}); put('users/A/privado/datos',{nacimiento:'1998-01-01'});
const LUGARES={ 'rio tercero':[{lat:'-32.17',lon:'-64.11',name:'Río Tercero',address:{city:'Río Tercero',state:'Córdoba'}}],
  'villa zoila':[{lat:'-32.18',lon:'-64.12',name:'Villa Zoila',address:{suburb:'Villa Zoila',city:'Río Tercero',state:'Córdoba'}}] };
const mk=(ua, geo)=>new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://partazy.com/',beforeParse(w){
  w.firebase=makeFirebase(store,()=>({uid:'A',email:'a@t.com'}));
  w.fetch=async u=>{ const q=decodeURIComponent((String(u).match(/[?&]q=([^&]*)/)||[])[1]||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); const k=Object.keys(LUGARES).find(k=>q.includes(k)); return { json: async()=> (String(u).includes('/reverse') ? {address:{city:'Río Tercero'}} : (k?LUGARES[k]:[])) }; };
  Object.defineProperty(w.navigator,'geolocation',{value: geo, configurable:true}); Object.defineProperty(w.navigator,'userAgent',{value: ua, configurable:true});
  w.addEventListener('error',e=>console.error('ERROR JS',e.message)); }}).window;
const bloqueada={ getCurrentPosition:(ok,mal)=>setTimeout(()=>mal&&mal({code:1}),10) };
const IPHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const txt=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();
let f=0; const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m); if(!c) f++;};
(async()=>{
  const A=mk(IPHONE, bloqueada); await sleep(1300); A.cerrarTutorial();
  const $=id=>A.document.getElementById(id);
  ok(A.eval('state.userCoords') && /Río Tercero/.test(A.eval('state.ciudadActual')), 'sin GPS, usa la ciudad del perfil (Río Tercero) en vez de mostrar todo');
  A.abrirRango(); A.usarMiUbicacion(); await sleep(80);
  ok(/Ajustes/.test(txt($('rango-estado'))) && /Safari/.test(txt($('rango-estado'))), 'en iPhone con la ubicación bloqueada explica cómo activarla');
  // sugerencias
  const inp=$('rango-ciudad'); inp.value='villa zoila'; inp.dispatchEvent(new A.Event('input')); await sleep(600);
  const sug=A.document.querySelector('#modal-rango .sug-lugares');
  ok(sug && sug.style.display==='block' && /Villa Zoila, Río Tercero/.test(txt(sug)), 'al escribir aparecen lugares reales para elegir');
  sug.querySelector('.sug-lugar').dispatchEvent(new A.MouseEvent('mousedown',{bubbles:true})); await sleep(50);
  ok(A.eval('state.ciudadActual')==='Villa Zoila, Río Tercero' && /Mostrando eventos cerca de Villa Zoila/.test(txt($('rango-estado'))), 'elegir uno lo usa como ubicación');
  inp.value='asdfqwer'; inp.dispatchEvent(new A.Event('input')); await sleep(600);
  ok(/No encontramos ese lugar/.test(txt(A.document.querySelector('#modal-rango .sug-lugares'))), 'si el lugar no existe, lo avisa');
  // perfil: no deja guardar un lugar que no existe
  A.cerrarRango(); A.ir('perfil'); A.editarPerfil(); await sleep(100);
  $('ep-ciudad').value='asdfqwer'; $('ep-ciudad').dataset.ok='';
  await A.guardarPerfil(); await sleep(100);
  ok(store.docs.get('users/A').ciudad==='Río Tercero' && /No encontramos esa ciudad/.test(txt($('toast'))), 'en el perfil no se puede guardar una ciudad que no existe');
  $('ep-ciudad').value='Villa Zoila, Rio Tercero'; $('ep-ciudad').dataset.ok='';
  await A.guardarPerfil(); await sleep(100);
  ok(store.docs.get('users/A').ciudad==='Villa Zoila, Rio Tercero', 'una que sí existe se guarda');
  // Instagram
  const I=mk(IPHONE+' Instagram 300.0', bloqueada); await sleep(1300); I.cerrarTutorial(); I.abrirRango(); I.usarMiUbicacion(); await sleep(50);
  ok(/Instagram/.test(txt(I.document.getElementById('rango-estado'))) && /Abrir en el navegador/.test(txt(I.document.getElementById('rango-estado'))), 'adentro de Instagram explica que hay que abrirlo en el navegador');
  console.log(f?'\nFALLAS: '+f:'\nTODO OK'); process.exit(f?1:0);
})();
