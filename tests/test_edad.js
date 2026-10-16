// Prueba: Ocultar la edad en el perfil.
const { JSDOM } = require('jsdom'); const fs = require('fs');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore();
store.docs.set('users/A',{nombre:'Juan Lovotti',usuario:'juan',iniciales:'JL',ciudad:'Güemes',intereses:[],foto:'',nombreBusqueda:'juan lovotti',palabras:['juan','lovotti']});
store.docs.set('users/A/privado/datos',{nacimiento:'2000-03-10'});
const w = new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://partazy.web.app/',
  beforeParse(w){ w.firebase = makeFirebase(store,()=>({uid:'A',email:'j@t.com'})); w.navigator.geolocation=undefined; w.addEventListener('error',e=>console.error('ERROR JS',e.message)); }}).window;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const $=id=>w.document.getElementById(id);
let f=0; const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m); if(!c) f++;};
(async()=>{
  await sleep(800); try{ w.cerrarTutorial(); }catch(e){}
  w.ir('perfil'); await sleep(200);
  ok(/\d+ años · Güemes/.test($('perfil-ubic').textContent), 'por defecto muestra la edad: '+$('perfil-ubic').textContent);
  w.editarPerfil(); await sleep(200);
  ok($('ep-edad').classList.contains('on'), 'el switch "Mostrar mi edad" arranca prendido');
  $('ep-edad').click(); await w.guardarPerfil(); await sleep(250);
  ok(store.docs.get('users/A').ocultarEdad===true, 'se guarda ocultarEdad');
  w.ir('perfil'); await sleep(200);
  ok($('perfil-ubic').textContent.trim()==='Güemes', 'con la edad oculta, el perfil muestra solo la ciudad: '+$('perfil-ubic').textContent);
  console.log(f?'\nFALLAS: '+f:'\nTODO OK'); process.exit(f?1:0);
})();
