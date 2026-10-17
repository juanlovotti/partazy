// Prueba: Formulario de Crear: previa vs fiesta, estilo opcional, VIP, vista previa, footer.
const { JSDOM } = require('jsdom'); const fs = require('fs');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore();
store.docs.set('users/A',{nombre:'Juan Lovotti',iniciales:'JL',ciudad:'Güemes',intereses:[],foto:'',nombreBusqueda:'juan lovotti',palabras:['juan','lovotti']});
store.docs.set('users/A/privado/datos',{nacimiento:'2000-03-10'});
const w = new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://partazy-5555d.web.app/',
  beforeParse(w){ w.firebase = makeFirebase(store,()=>({uid:'A',email:'j@t.com'})); w.navigator.geolocation=undefined; w.addEventListener('error',e=>console.error('ERROR JS',e.message)); }}).window;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const $=id=>w.document.getElementById(id); const txt=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();
let f=0; const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m); if(!c) f++;};
const vis=id=>$(id) && $(id).style.display!=='none';
const evs=()=>[...store.docs.entries()].filter(([k])=>/^events\/[^/]+$/.test(k));
const fecha=new Date(Date.now()+3*864e5).toISOString().slice(0,10);
const llenar=(n)=>{ $('f-nombre').value=n; $('f-lugar').value='Belgrano 800, Güemes'; $('f-fecha').value=fecha; $('f-hora').value='23:00'; $('f-capacidad').value='40'; };
(async()=>{
  await sleep(800); try{ w.cerrarTutorial(); }catch(e){} w.ir('crear'); await sleep(50);
  // Fiesta: estilo opcional, VIP disponible, sin tile Previa
  ok(vis('campo-estilo') && vis('fila-vip') && vis('campo-tipos'), 'fiesta: muestra estilo de música, lista VIP y tipos');
  const tp=w.document.querySelector('#tipos-grid [data-ocasion="previa"]'); ok(tp && tp.style.display!=='none', 'fiesta: "Previa" aparece entre los tipos');
  tp.click(); await sleep(30);
  ok($('op-previa').classList.contains('activo') && $('f-ocasion').value==='previa' && tp.classList.contains('on'), 'tocar "Previa" en los tipos la elige (Previa ahora es un tipo más del paso 2)');
  w.elegirTipo('fiesta');
  ok(txt($('op-previa'))==='Previa' || /^Previa\b/.test(txt($('op-previa'))) && !/en casa/i.test(txt($('op-previa'))), 'la opción de arriba dice "Previa" (sin "en casa")');
  // Previa: oculta estilo, VIP y tipos
  w.elegirTipo('previa');
  ok(!vis('campo-estilo') && !vis('fila-vip') && $('f-ocasion').value==='previa', 'previa: sin estilo de música, sin lista VIP y tipo = Previa');
  w.elegirTipo('fiesta');
  ok($('f-ocasion').value==='fiesta', 'volver a fiesta deja el tipo en Fiesta');
  // Escribir "previa" en el nombre redirige
  $('f-nombre').value='Previa del sábado'; $('f-nombre').dispatchEvent(new w.Event('input')); await sleep(750);
  ok($('op-previa').classList.contains('activo') && $('f-ocasion').value==='previa', 'escribir "previa" en el nombre pasa a la sección Previa');
  ok(/Previa/.test(txt($('toast'))), 'y avisa con un toast');
  w.elegirTipo('fiesta');
  // Sin estilo: se publica igual, previsualización primero
  llenar('Fiesta sin estilo');
  const p=w.publicarEvento(); await sleep(80);
  const hoja=txt($('hoja-contenido'));
  ok(/Así se va a ver tu publicación/.test(hoja) && /Fiesta sin estilo/.test(hoja), 'antes de publicar muestra la vista previa de la publicación');
  ok(/No subiste foto/.test(hoja), 'sin foto: lo avisa dentro de la vista previa');
  [...$('hoja-contenido').querySelectorAll('button')].find(b=>/Seguir editando/.test(b.textContent)).click(); await p; await sleep(60);
  ok(evs().length===0, '"Seguir editando" no publica');
  const p2=w.publicarEvento(); await sleep(80);
  $('btn-confirmar-publicar').click(); await p2; await sleep(150);
  const ev1=evs().find(([k,v])=>v.nombre==='Fiesta sin estilo');
  ok(ev1 && !ev1[1].categoria, 'estilo de música opcional: se publica sin estilo');
  // VIP con nombres
  w.ir('crear'); w.elegirTipo('fiesta'); llenar('Fiesta con VIP'); $('f-estilo').value='techno';
  w.toggleSwitch($('switch-vip')); w.actualizarCampoVip();
  ok(vis('campo-vip'), 'al activar Lista VIP aparece el campo para anotar los nombres');
  $('f-vip').value='Ivo Pérez\n  Sofi \n\nMartín';
  w.mostrarVistaPrevia=async()=>true; await w.publicarEvento(); await sleep(200);
  const ev2=evs().find(([k,v])=>v.nombre==='Fiesta con VIP');
  ok(ev2 && ev2[1].listaVip===true && ev2[1].categoria==='techno', 'se guarda con lista VIP y estilo');
  const lista=store.docs.get(ev2[0]+'/vip/lista');
  ok(lista && JSON.stringify(lista.nombres)===JSON.stringify(['Ivo Pérez','Sofi','Martín']), 'los nombres VIP quedan guardados: '+JSON.stringify(lista&&lista.nombres));
  const id2=ev2[0].split('/')[1];
  w.abrirDetalle(id2); await sleep(300);
  ok(/Lista VIP \(3\)/.test(txt($('bloque-vip'))) && /Sofi/.test(txt($('bloque-vip'))), 'quien organiza ve la lista VIP en el evento');
  // Previa: no guarda VIP ni estilo aunque haya algo cargado
  w.ir('crear'); w.elegirTipo('previa'); llenar('Juntada'); $('f-lugar').value='Güemes'; $('f-direccion').value='Belgrano 120'; $('f-estilo').value='cumbia';
  await w.publicarEvento(); await sleep(200);
  const ev3=evs().find(([k,v])=>v.nombre==='Juntada');
  ok(ev3 && ev3[1].ocasion==='previa' && !ev3[1].categoria && !ev3[1].listaVip, 'previa: se guarda sin estilo ni VIP');
  // Vista rápida en tarjetas
  w.ir('home'); w.renderHome(); await sleep(80);
  const b=w.document.querySelector(`.btn-vista[data-vista="${id2}"]`);
  ok(!!b, 'las tarjetas tienen el botón "Vista previa"');
  if(b){ b.click(); await sleep(60); const h=txt($('hoja-contenido')); ok(/Fiesta con VIP/.test(h) && /Techno/i.test(h), 'la vista previa muestra el tipo de música y los datos: '+h.slice(0,120)); }
  w.cerrarHoja(); await sleep(30);
  // Footer
  const pie=w.document.querySelector('.pie-ig');
  ok(pie && /instagram\.com\/partazy/.test(pie.getAttribute('href')), 'footer con el logo de Instagram que lleva a @partazy');
  ok(w.document.querySelectorAll('[data-idioma]').length>=3 && [...w.document.querySelectorAll('[data-idioma]')].some(x=>x.dataset.idioma==='pt'), 'selector de idioma (español / inglés / portugués)');
  const logos=[...w.document.querySelectorAll('.lv')]; ok(logos.length>=3 && logos.every(m=>m.querySelector('.lv-ico .lv-b') && m.querySelector('.lv-punto') && m.querySelector('.lv-txt').textContent==='artazy') && w.document.getElementById('ptz-p'), 'el logo nuevo (la P tornasol + "artazy" + punto verde) está en la carga, el inicio y el menú');
  ok(!w.document.querySelector('#loader .spinner'), 'en la carga se anima el logo en vez de la ruedita');
  console.log(f?'\nFALLAS: '+f:'\nTODO OK'); process.exit(f?1:0);
})();
