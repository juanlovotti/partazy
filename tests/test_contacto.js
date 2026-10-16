// Prueba: formulario de contacto de Ayuda (con y sin cuenta) y consultas en el panel de moderación.
const { JSDOM } = require('jsdom');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put=(p,v)=>store.docs.set(p,v);
put('users/A',{nombre:'Juan Lovotti',usuario:'juan',iniciales:'J',ciudad:'Córdoba',intereses:[],foto:''}); put('users/A/privado/datos',{nacimiento:'1998-01-01'}); put('admins/A',{});
const w=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://partazy.web.app/',beforeParse(w){ w.firebase=makeFirebase(store,()=>({uid:'A',email:'juan@mail.com'})); w.navigator.geolocation=undefined; w.addEventListener('error',e=>console.error('ERROR JS',e.message)); }}).window;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const $=id=>w.document.getElementById(id); const txt=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();
let f=0; const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m); if(!c) f++;};
(async()=>{
  await sleep(1000);
  w.abrirAyuda(); await sleep(50);
  ok($('ct-nombre').value==='Juan Lovotti' && $('ct-email').value==='', 'con sesión se precarga el nombre, pero NO el mail personal');
  $('ct-email').value='juan@mail.com';
  ok($('ct-whatsapp').style.display==='none' && /partazycontacto@gmail\.com/.test(txt($('ct-mail'))), 'sin número cargado no muestra WhatsApp; sí el mail');
  $('ct-mensaje').value='Hola'; await w.enviarConsulta(); await sleep(50);
  ok(/un poco más/.test(txt($('toast'))) && ![...store.docs.keys()].some(k=>k.startsWith('consultas/')), 'mensaje muy corto: no se manda');
  $('ct-motivo').value='organizacion'; $('ct-mensaje').value='Tengo un boliche y quiero publicar fechas'; await w.enviarConsulta(); await sleep(100);
  const c=[...store.docs.entries()].find(([k])=>k.startsWith('consultas/'));
  ok(c && c[1].motivo==='organizacion' && c[1].uid==='A' && c[1].email==='juan@mail.com', 'la consulta se guarda');
  ok(/Gracias/.test(txt($('toast'))) && $('ct-mensaje').value==='', 'avisa y limpia el mensaje');
  w.eval('state.esAdmin=true'); w.abrirModeracion(); await sleep(200);
  ok(/Tengo un boliche/.test(txt($('lista-consultas'))) && /Responder desde partazycontacto@gmail\.com/.test(txt($('lista-consultas'))), 'el admin ve la consulta en Moderación');
  $('lista-consultas').querySelector('[data-borrar-consulta]').click(); await sleep(150);
  ok(![...store.docs.keys()].some(k=>k.startsWith('consultas/')), '"Listo, borrar" la elimina');
  console.log(f?'\nFALLAS: '+f:'\nTODO OK'); process.exit(f?1:0);
})();
