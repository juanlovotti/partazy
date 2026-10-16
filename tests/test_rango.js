// Prueba: Rango de distancia y ubicación.
const { JSDOM } = require('jsdom'); const fs = require('fs');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put=(p,v)=>store.docs.set(p,v); const T=Date.now();
put('users/A',{nombre:'Juan',usuario:'juan',iniciales:'J',ciudad:'Río Tercero',intereses:[],foto:'',nombreBusqueda:'juan',palabras:['juan']}); put('users/A/privado/datos',{nacimiento:'1998-01-01'});
const base={creador:'O',creadorNombre:'Org',organizador:'Org',categoria:'techno',tipoLugar:'Fiesta',tipo:'fiesta',privacidad:'publica',hora:'23:00',precio:0,capacidad:100,confirmadosCount:3,edadMinima:18,dresscode:'Libre',musica:'Techno',imagen:'',descripcion:'x',reglas:'x',estado:'publicado',fechaTs:T+2*864e5,createdAt:T-72*36e5};
put('events/cba1',{...base,nombre:'Fiesta Güemes',lugar:'Güemes',lat:-31.4245,lng:-64.1935});
put('events/cba2',{...base,nombre:'Previa Nueva Córdoba',lugar:'Nueva Córdoba',lat:-31.4280,lng:-64.1870,fechaTs:T+3*864e5});
put('events/rt1',{...base,nombre:'Boliche Río Tercero',lugar:'Río Tercero',lat:-32.1730,lng:-64.1130,fechaTs:T+4*864e5});
const RIO3={latitude:-32.1760,longitude:-64.1120};
const w=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://partazy.web.app/',beforeParse(w){
  w.firebase=makeFirebase(store,()=>({uid:'A',email:'a@t.com'}));
  w.navigator.geolocation={ getCurrentPosition:(ok)=>setTimeout(()=>ok({coords:RIO3}),10) };
  w.fetch=async u=>({ json: async()=> u.includes('reverse') ? {address:{city:'Río Tercero'}} : [{lat:'-31.4201',lon:'-64.1888',address:{city:'Córdoba'}}] });
  w.addEventListener('error',e=>console.error('ERROR JS',e.message)); }}).window;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const $=id=>w.document.getElementById(id); const txt=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();
let f=0; const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m); if(!c) f++;};
(async()=>{
  await sleep(900); w.cerrarTutorial(); w.eval('localStorage.clear()'); w.elegirRango(50); await sleep(300);
  ok(/Río Tercero/.test(txt(w.document.querySelector('#pantalla-home .ubic-btn'))) && /50 km/.test(txt(w.document.querySelector('#pantalla-home .ubic-btn'))), 'arriba dice "Río Tercero · 50 km"');
  const home=txt($('pantalla-home'));
  ok(/Boliche Río Tercero/.test(home) && !/Fiesta Güemes/.test(home), 'con 50 km muestra lo de Río Tercero y no lo de Córdoba capital (≈85 km)');
  ok(/0\.\d km|[1-9]\.\d km/.test(txt($('lista-cerca'))), 'los km se calculan desde Río Tercero');
  w.elegirRango(100); await sleep(100);
  ok(/Fiesta Güemes/.test(txt($('pantalla-home'))) && /100 km/.test(txt(w.document.querySelector('.ubic-btn'))), 'con 100 km aparecen también los de Córdoba');
  w.elegirRango(5); await sleep(50);
  w.eval("state.userCoords={lat:-31.0,lng:-64.5}"); w.renderHome(); await sleep(50);
  ok(/No hay eventos a menos de 5 km/.test(txt($('home-aviso-rango'))) && /Ver todos/.test(txt($('home-aviso-rango'))), 'si no hay nada en el rango, avisa y ofrece "Ver todos"');
  w.document.querySelector('#home-aviso-rango .btn-primario').click(); await sleep(50);
  ok(/Fiesta Güemes/.test(txt($('pantalla-home'))) && /Todos/.test(txt(w.document.querySelector('.ubic-btn'))), '"Ver todos" muestra todo');
  // ciudad a mano
  w.abrirRango(); $('rango-ciudad').value='Córdoba'; await w.buscarCiudadRango(); await sleep(50);
  ok(/Córdoba/.test(txt(w.document.querySelector('.ubic-btn'))) && /Mostrando eventos cerca de Córdoba/.test($('rango-estado').textContent), 'se puede elegir otra ciudad a mano');
  w.elegirRango(10); w.cerrarRango(); await sleep(50);
  w.ir('explorar'); w.renderExplorar(); await sleep(50);
  ok(/Fiesta Güemes/.test(txt($('lista-explorar-cont'))) && !/Boliche Río Tercero/.test(txt($('lista-explorar-cont'))), 'Explorar respeta el rango (Córdoba · 10 km)');
  w.cambiarVistaExplorar('mapa'); await sleep(50);
  ok($('pantalla-explorar').classList.contains('modo-mapa') && $('vista-mapa').classList.contains('on'), 'botón Lista/Mapa cambia a vista de mapa');
  ok(w.eval("JSON.parse(localStorage.getItem('partazy_radioKm'))")===10, 'el rango elegido queda guardado');
  console.log(f?'\nFALLAS: '+f:'\nTODO OK'); process.exit(f?1:0);
})();
