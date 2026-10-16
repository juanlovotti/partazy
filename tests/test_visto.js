// Prueba: Mensajes marcados como vistos.
const { JSDOM } = require('jsdom'); const fs = require('fs');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put=(p,v)=>store.docs.set(p,v); const T=Date.now();
const perfil=(uid,nombre)=>{ put('users/'+uid,{nombre,usuario:nombre.toLowerCase(),iniciales:nombre[0],ciudad:'Córdoba',intereses:[],foto:'',nombreBusqueda:nombre.toLowerCase(),palabras:[nombre.toLowerCase()]}); put(`users/${uid}/privado/datos`,{nacimiento:'1998-01-01'}); };
perfil('A','Juan'); perfil('F','Franco');
put('friendships/A_F',{users:['A','F'],de:'A',para:'F',estado:'aceptada'});
const ADELANTO = 5*60e3; // el celular de Franco tiene la hora 5 minutos adelantada
put('dms/A_F',{miembros:['A','F'],ultimoMsg:'No llegó nada',ultimoTs:T+ADELANTO,ultimoDe:'F',vistoPor:{F:T+ADELANTO}});
put('dms/A_F/mensajes/m1',{de:'F',tipo:'texto',texto:'No llegó nada',ts:T+ADELANTO});
const w=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://partazy.web.app/',beforeParse(w){ w.firebase=makeFirebase(store,()=>({uid:'A',email:'a@t.com'})); w.navigator.geolocation=undefined; }}).window;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const $=id=>w.document.getElementById(id);
let f=0; const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m); if(!c) f++;};
(async()=>{
  await sleep(800); w.cerrarTutorial(); await sleep(100);
  w.abrirChats(); await sleep(200);
  ok(!!w.document.querySelector('#lista-chats .punto-noleido'), 'antes de abrir: aparece como no leído');
  w.abrirDM('F'); await sleep(400);
  ok((store.docs.get('dms/A_F').vistoPor.A||0) >= T+ADELANTO, 'al abrir se marca visto aunque el reloj del otro esté adelantado');
  w.volver(w.abrirChats); await sleep(600);
  ok(!w.document.querySelector('#lista-chats .punto-noleido'), 'al volver a Chats ya no aparece el punto');
  ok(!$('badge-chats').classList.contains('on'), 'y se va el globito de la barra');
  console.log(f?'\nFALLAS: '+f:'\nTODO OK'); process.exit(f?1:0);
})();
