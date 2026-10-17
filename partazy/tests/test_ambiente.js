// Prueba: Estado automático de los eventos (recién creado, se llena, en vivo...) y tutorial.
const { JSDOM } = require('jsdom'); const fs = require('fs');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const H=36e5, ahora=Date.now();
store.docs.set('users/A',{nombre:'Marta Gómez',iniciales:'MG',ciudad:'Güemes',intereses:[],foto:'',nombreBusqueda:'marta',palabras:['marta']});
store.docs.set('users/A/privado/datos',{nacimiento:'1965-03-10'});
const base={creador:'O',creadorNombre:'Org',organizador:'Org',categoria:'techno',tipoLugar:'Fiesta',tipo:'fiesta',privacidad:'publica',hora:'23:00',lugar:'Güemes',lat:-31.42,lng:-64.19,precio:0,capacidad:100,edadMinima:18,dresscode:'Libre',musica:'Techno',imagen:'',descripcion:'x',reglas:'x',estado:'publicado'};
const ev=(id,o)=>store.docs.set('events/'+id,Object.assign({},base,o));
ev('nuevo',{nombre:'Nuevo',fechaTs:ahora+48*H,confirmadosCount:3,createdAt:ahora-H});
ev('hay',{nombre:'Hay',fechaTs:ahora+48*H,confirmadosCount:10,createdAt:ahora-72*H});
ev('llenando',{nombre:'Llenando',fechaTs:ahora+48*H,confirmadosCount:60,createdAt:ahora-72*H});
ev('ultimos',{nombre:'Ultimos',fechaTs:ahora+48*H,confirmadosCount:90,createdAt:ahora-72*H});
ev('lleno',{nombre:'Lleno',fechaTs:ahora+48*H,confirmadosCount:100,createdAt:ahora-72*H});
ev('vivo',{nombre:'Vivo',fechaTs:ahora-H,confirmadosCount:40,createdAt:ahora-72*H});
ev('fin',{nombre:'Fin',fechaTs:ahora-8*H,confirmadosCount:40,createdAt:ahora-72*H});
store.docs.set('events/vivo/attendees/A',{uid:'A',nombre:'Marta',estado:'confirmado',ts:1});
store.docs.set('events/vivo/votos/X',{voto:'explotado',ts:ahora-10*60e3});
store.docs.set('events/vivo/votos/Y',{voto:'explotado',ts:ahora-20*60e3});
store.docs.set('events/vivo/votos/Z',{voto:'tranqui',ts:ahora-5*H}); // viejo: no cuenta
const w = new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://partazy.web.app/',
  beforeParse(w){ w.firebase = makeFirebase(store,()=>({uid:'A',email:'m@t.com'})); w.navigator.geolocation=undefined; w.addEventListener('error',e=>console.error('ERROR JS',e.message)); }}).window;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const $=id=>w.document.getElementById(id);
let fallas=0; const ok=(c,m)=>{ console.log((c?'✔ ':'✘ ')+m); if(!c) fallas++; };
const get=id=>({id,...store.docs.get('events/'+id)});
(async()=>{
  await sleep(900);
  ok(!$('tutorial').classList.contains('show'), 'cuenta existente: el tutorial no aparece solo');
  w.abrirTutorial(); await sleep(40);
  ok(/Hola, Marta/.test($('tuto-slide').textContent), 'saluda por el nombre');
  for(let i=0;i<5;i++) w.pasoTutorial(1);
  ok($('tuto-sig').textContent==='¡Empezar!' && $('tuto-paso').textContent==='6 / 6', 'último paso con "¡Empezar!"');
  w.pasoTutorial(1);
  ok(!$('tutorial').classList.contains('show') && w.tutorialVisto(), 'se cierra y queda marcado como visto');
  const L=id=>w.ambienteAuto(get(id)).label, C=id=>w.amb(get(id));
  ok(L('nuevo')==='Recién creado' && C('nuevo')==='verde', 'recién creado (verde)');
  ok(L('hay')==='Hay lugar' && C('hay')==='verde', 'pasadas 24 h cambia a "Hay lugar"');
  ok(L('llenando')==='Se está llenando' && C('llenando')==='amarillo', 'más de la mitad: se está llenando (amarillo)');
  ok(L('ultimos')==='Últimos lugares' && C('ultimos')==='amarillo', '85%: últimos lugares');
  ok(L('lleno')==='Lleno' && C('lleno')==='rojo', 'lleno (rojo)');
  ok(L('vivo')==='En vivo' && C('vivo')==='verde amb-vivo', 'en vivo (late)');
  ok(L('fin')==='Terminó' && C('fin')==='gris', 'terminó (gris)');
  ok(w.ambienteAuto({...get('hay'),estado:'cancelado'}).label==='Cancelado', 'cancelado (rojo)');

  w.abrirDetalle('vivo'); await sleep(250);
  const blo=$('bloque-ambiente').textContent;
  ok(/En vivo · Explotado/.test(blo) && /2 personas/.test(blo), 'en el detalle muestra lo que vota la mayoría (votos de más de 3 h no cuentan)');
  ok($('bloque-ambiente').querySelectorAll('[data-votar]').length===3, 'el anotado ve los botones para votar');
  $('bloque-ambiente').querySelector('[data-votar="bueno"]').click(); await sleep(200);
  ok(store.docs.get('events/vivo/votos/A')?.voto==='bueno', 'el voto se guarda');
  ok($('bloque-ambiente').querySelector('[data-votar="bueno"]').classList.contains('elegido'), 'queda marcado su voto');

  w.abrirDetalle('hay'); await sleep(200);
  ok(!$('bloque-ambiente').querySelector('[data-votar]'), 'antes de empezar no se vota');
  $('bloque-ambiente').querySelector('.link-ref').click(); await sleep(20);
  ok($('modal-referencias').classList.contains('show') && /Se está llenando/.test($('ref-contenido').textContent) && /Terminó/.test($('ref-contenido').textContent), '"¿Qué significa?" abre la referencia de colores');
  w.cerrarReferencias();
  w.abrirAyuda(); await sleep(20);
  ok(/Colores y etiquetas/.test($('lista-ayuda').textContent), 'la ayuda tiene la sección de colores');
  console.log(fallas ? '\nFALLAS: '+fallas : '\nTODO OK'); process.exit(fallas?1:0);
})();
