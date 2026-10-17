// Prueba: fila de amigos (qué hace cada uno), organizador que no "va", pago a terceros, casilleros de fecha y verificado.
const { JSDOM } = require('jsdom');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put=(p,v)=>store.docs.set(p,v);
put('users/A',{nombre:'Juan',usuario:'juan',iniciales:'J',ciudad:'Córdoba',intereses:[],foto:''}); put('users/A/privado/datos',{nacimiento:'1998-01-01'});
const w=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://partazy.com/',beforeParse(w){
  w.firebase=makeFirebase(store,()=>({uid:'A',email:'a@t.com'})); w.navigator.geolocation=undefined;
  w.fetch=async()=>({json:async()=>[]});
  w.addEventListener('error',e=>console.error('ERROR JS',e.message)); }}).window;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let f=0; const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m); if(!c) f++;};
(async()=>{
  await sleep(1400); w.cerrarTutorial(); await sleep(200);
  const H=36e5, ahora=Date.now();
  const enVivo={id:'e1',nombre:'LQB Fest',creador:'P',ocasion:'musical',fechaTs:ahora-H};
  const charla={id:'e2',nombre:'Seminario',creador:'P',ocasion:'charla',fechaTs:ahora+3*24*H};
  let p=w.planDeAmigo(enVivo,'B');
  ok(p.ahora && p.cuando==='Ahora en' && p.emoji==='🎤', 'amigo en un recital que está pasando: "🎤 Ahora en"');
  p=w.planDeAmigo(enVivo,'P');
  ok(p.org && p.cuando==='Organizando', 'si el amigo es el organizador dice "Organizando", no que va');
  p=w.planDeAmigo(charla,'B');
  ok(!p.ahora && p.emoji==='🎙️' && /^(Dom|Lun|Mar|Mié|Jue|Vie|Sáb) \d\d:\d\d$/.test(p.cuando), 'charla en unos días: emoji de charla y día/hora ('+p.cuando+')');
  w.eval('state').red.amigosVan['e2']=['P','B']; w.eval('state').usuarios.B={uid:'B',nombre:'Beto'}; w.eval('state').usuarios.P={uid:'P',nombre:'Productora'};
  ok(JSON.stringify(w.amigosQueVan(charla))==='["B"]', 'el organizador no aparece como "va a este evento"');
  ok(/a este evento/.test(w.amigosVanHTML(charla,true)) && !/fiesta/.test(w.amigosVanHTML(charla,true)), 'en una charla dice "evento", no "fiesta"');
  const d=w.document;
  ok(d.getElementById('f-fecha').parentElement.classList.contains('caja-fecha') && d.getElementById('f-insc-hora').parentElement.classList.contains('caja-fecha'), 'los casilleros de fecha y hora van dentro de una caja que no se deforma');
  w.elegirQuienCobra('otro');
  ok(d.getElementById('campo-titular').style.display==='block' && w.quienCobra()==='otro', 'pago: "Otra persona" pide el titular de la cuenta');
  w.resetFormularioCrear();
  ok(w.quienCobra()==='yo' && d.getElementById('campo-titular').style.display==='none', 'al empezar un evento nuevo vuelve a "Yo / mi organización"');
  const h=w.personaHTML({uid:'P',nombre:'Productora Partazy',verificado:true});
  ok(/<h5><i class="nom">Productora Partazy<\/i><span class="ins-verif"/.test(h), 'el verificado va pegado al nombre, en la misma línea');
  ok(d.querySelector('meta[name="color-scheme"]')?.content==='dark only', 'el modo oscuro forzado del celular no cambia los colores');
  console.log(f?'\nFALLAS: '+f:'\nTODO OK'); process.exit(f?1:0);
})();
