// Prueba: ubicar el lugar de un evento siempre cerca de donde estás (caso real: "Centro" estando en Río Tercero).
const { JSDOM } = require('jsdom');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put=(p,v)=>store.docs.set(p,v);
put('users/A',{nombre:'Juan',usuario:'juan',iniciales:'J',ciudad:'Villa Zoila, Río Tercero',intereses:[],foto:''}); put('users/A/privado/datos',{nacimiento:'1998-01-01'});
const RIO3={lat:-32.1731,lng:-64.1137}, CBA={lat:-31.4167,lng:-64.1833};
const pedidos=[];
const w=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://partazy.com/',beforeParse(w){
  w.firebase=makeFirebase(store,()=>({uid:'A',email:'a@t.com'})); w.navigator.geolocation=undefined;
  w.fetch=async u=>{ u=String(u); pedidos.push(decodeURIComponent(u)); const q=decodeURIComponent((u.match(/[?&]q=([^&]*)/)||[])[1]||'').toLowerCase();
    let res=[];
    if(/calle inventada/.test(q)) res=[{lat:'-34.6',lon:'-58.4',address:{city:'Buenos Aires'}}];   // existe, pero muy lejos
    else if(/centro, r[ií]o tercero/.test(q)) res=[{lat:'-32.1745',lon:'-64.1150',address:{suburb:'Centro',city:'Río Tercero',state:'Córdoba'}}];
    else if(q==='centro') res=[{lat:String(CBA.lat),lon:String(CBA.lng),address:{suburb:'Centro',city:'Córdoba'}}];   // el "Centro" equivocado
    else if(/r[ií]o tercero/.test(q)) res=[{lat:String(RIO3.lat),lon:String(RIO3.lng),name:'Río Tercero',address:{city:'Río Tercero',state:'Córdoba'}}];
    return { json: async()=>res }; };
  w.addEventListener('error',e=>console.error('ERROR JS',e.message)); }}).window;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let f=0; const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m); if(!c) f++;};
(async()=>{
  await sleep(1400); w.cerrarTutorial(); await sleep(200);
  const st=w.eval('state');
  ok(st.userCoords && w.distanciaKm(st.userCoords.lat,st.userCoords.lng,RIO3.lat,RIO3.lng)<5, 'sin GPS, te ubica en Río Tercero (tu perfil)');
  const c=await w.ubicarLugar('Centro');
  ok(w.distanciaKm(c.lat,c.lng,RIO3.lat,RIO3.lng)<3 && c.ciudad==='Río Tercero', '"Centro" se busca en Río Tercero, no en Córdoba capital');
  ok(pedidos.some(p=>/q=Centro, Río Tercero/.test(p) && /bounded=1/.test(p)), 'la búsqueda se limita a tu zona');
  const lejos=await w.ubicarLugar('Calle Inventada 123');
  ok(w.distanciaKm(lejos.lat,lejos.lng,RIO3.lat,RIO3.lng)<5 && lejos.aproximada, 'si lo que aparece está a cientos de km, usa el centro de tu ciudad (aproximado)');
  ok(!w.enCordobaCapital(), 'los barrios de Córdoba capital no se usan si estás en otra ciudad');
  // en Córdoba capital sí
  st.userCoords={lat:-31.42,lng:-64.19}; st.ciudadActual='Córdoba';
  const g=await w.ubicarLugar('Güemes');
  ok(Math.abs(g.lat-(-31.4245))<0.01, 'estando en Córdoba capital, "Güemes" usa el barrio cargado');
  console.log(f?'\nFALLAS: '+f:'\nTODO OK'); process.exit(f?1:0);
})();
