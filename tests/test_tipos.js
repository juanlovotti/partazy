// Prueba: Tipos de evento (Peña, After, Gastronómico...) y portadas.
const { JSDOM } = require('jsdom'); const fs = require('fs');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put=(p,v)=>store.docs.set(p,v); const T=Date.now();
put('users/A',{nombre:'Juan',usuario:'juan',iniciales:'J',ciudad:'Córdoba',intereses:[],foto:'',nombreBusqueda:'juan',palabras:['juan']}); put('users/A/privado/datos',{nacimiento:'1998-01-01'});
const w=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://partazy.web.app/',beforeParse(w){ w.firebase=makeFirebase(store,()=>({uid:'A',email:'a@t.com'})); w.navigator.geolocation=undefined; w.addEventListener('error',e=>console.error('ERROR JS',e.message)); }}).window;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const $=id=>w.document.getElementById(id); const txt=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();
let f=0; const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m); if(!c) f++;};
const publicar=async(nombre, tipoKey, estilo, previa)=>{
  w.ir('crear'); if(previa){ w.elegirTipo('previa'); w.toggleSwitch($('switch-privacidad')); w.actualizarCamposPrivacidad(); }
  if(tipoKey) w.document.querySelector(`[data-ocasion="${tipoKey}"]`).click();
  $('f-nombre').value=nombre; $('f-lugar').value='Güemes'; $('f-fecha').value=new Date(T+3*864e5).toISOString().slice(0,10); $('f-hora').value='21:00'; $('f-capacidad').value='50'; $('f-estilo').value=estilo||'';
  const c=w.confirmar; w.confirmar=async()=>true; w.mostrarVistaPrevia=async()=>true; await w.publicarEvento(); w.confirmar=c; await sleep(150);
  return [...store.docs.values()].find(v=>v.nombre===nombre);
};
(async()=>{
  await sleep(800); w.cerrarTutorial(); w.ir('crear'); await sleep(50);
  const ops=[...w.document.querySelectorAll('#tipos-grid .tipo-op')].map(b=>b.textContent.trim());
  ok(JSON.stringify(ops)===JSON.stringify(['Fiesta','Previa','After','Peña','Egresados','Cumpleaños','Evento musical','Evento gastronómico']), 'los 8 tipos con su ícono: '+ops.join(', '));
  ok(w.document.querySelectorAll('#tipos-grid svg').length===8, 'cada tipo tiene su logito');
  ok($('f-ocasion').value==='fiesta' && w.document.querySelector('[data-ocasion="fiesta"]').classList.contains('on'), 'arranca en "Fiesta"');
  w.elegirTipo('previa'); ok($('f-ocasion').value==='previa', 'al tocar "Previa" arriba, el tipo pasa a Previa');
  w.elegirTipo('fiesta');
  const pena=await publicar('Peña del Sábado','pena','cuarteto');
  ok(pena && pena.ocasion==='pena', 'se guarda una Peña');
  const gastro=await publicar('Feria de comidas','gastronomico','');
  ok(gastro && gastro.ocasion==='gastronomico' && !gastro.categoria, 'evento gastronómico sin estilo de música: se publica igual');
  w.ir('home'); w.renderHome(); await sleep(50);
  const cardP=[...w.document.querySelectorAll('.tarjeta, .tarjeta-h')].find(c=>/Peña del Sábado/.test(c.textContent));
  ok(cardP && txt(cardP.querySelector('.cat')).replace('Vista previa','').trim()==='Peña' && !/\$|Cuarteto|Gratis/.test(txt(cardP)) && cardP.querySelector('.cat svg.ico-tipo'), 'tarjeta limpia: ícono + "Peña", sin estilo ni precio');
  ok(/PE%C3%91A|PEÑA/.test(decodeURIComponent(cardP.querySelector('.foto-img').style.backgroundImage)), 'sin foto: usa la portada de Peña');
  w.ir('explorar'); w.elegirChipExplorar([...w.document.querySelectorAll('#chips-explorar .chip')].find(c=>c.textContent==='Gastronómicos'),'gastronomico'); await sleep(30);
  ok(/Feria de comidas/.test(txt($('lista-explorar-cont'))) && !/Peña del Sábado/.test(txt($('lista-explorar-cont'))), 'filtro "Gastronómicos" en Explorar');
  const id=Object.keys(Object.fromEntries(store.docs)).find(k=>store.docs.get(k)?.nombre==='Peña del Sábado').split('/')[1];
  w.abrirDetalle(id); await sleep(250); $('btn-editar-evento').click(); await sleep(80);
  ok(w.document.querySelector('[data-ocasion="pena"]').classList.contains('on'), 'al editar, queda marcado el tipo guardado');
  console.log(f?'\nFALLAS: '+f:'\nTODO OK'); process.exit(f?1:0);
})();
