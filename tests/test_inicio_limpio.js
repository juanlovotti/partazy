// Prueba: Inicio más limpio (revisión 10/11). Sin cartel al abrir, una línea de ubicación, "Hoy" honesto,
// cada evento una sola vez, tarjetas sin "Vista previa" y textos nuevos.
const { JSDOM } = require('jsdom');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put=(p,v)=>store.docs.set(p,v); const H=36e5;
const dia = d => { const x = new Date(); x.setHours(23,30,0,0); x.setDate(x.getDate()+d); return x.getTime(); };
put('users/O',{nombre:'Vortex',usuario:'vortex',iniciales:'V',tipoCuenta:'organizacion',ciudad:'Córdoba',intereses:[],foto:''});
const ev=(id,o)=>put('events/'+id,Object.assign({creador:'O',creadorNombre:'Vortex',organizador:'Vortex',categoria:'techno',tipo:'fiesta',ocasion:'fiesta',privacidad:'publica',hora:'23:30',lugar:'Güemes',lat:-31.42,lng:-64.19,precio:0,capacidad:200,confirmadosCount:2,edadMinima:18,imagen:'',descripcion:'x'},o));
ev('jue',{nombre:'Noche del Jueves',fechaTs:dia(2)});
const mk=()=>new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://partazy.com/',beforeParse(w){ w.firebase=makeFirebase(store,()=>null); w.navigator.geolocation=undefined; w.addEventListener('error',e=>console.error('ERROR JS',e.message)); }}).window;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const txt=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();
let f=0; const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m); if(!c) f++;};
(async()=>{
  const w=mk(); const $=id=>w.document.getElementById(id);
  await sleep(2200); w.renderHome(); await sleep(30);
  const home=$('pantalla-home');
  ok(!$('hoja-cuenta').classList.contains('show'), 'al abrir no sale el cartel "Sumate"');
  ok(/^Mostrando todo Córdoba\. Elegir zona$/.test(txt($('home-ubic-linea')).trim()) && !$('home-ubic-linea').hidden, 'una sola línea chica: "Mostrando todo Córdoba. Elegir zona"');
  ok(!txt($('home-aviso-rango')) && !w.document.querySelector('.barra-invitado'), 'sin el aviso grande de ubicación ni la barra "Estás mirando sin cuenta"');
  ok(/Elegí tu ciudad ▾/.test(txt(home.querySelector('.ubic-btn'))) && !/km/.test(txt(home.querySelector('.ubic-btn'))), 'el selector dice "Elegí tu ciudad ▾" sin los km');
  // "Hoy" honesto
  ok(home.querySelector('#chips-home .chip.activo')?.textContent==='Hoy' && /Esta semana/.test(txt($('titulo-fila-1'))), 'con "Hoy" marcado y nada hoy, la primera fila es "Esta semana"');
  ok(/^Hoy no hay nada cargado\. Mirá lo que viene esta semana$/.test(txt($('nota-fila-1'))) && !$('nota-fila-1').hidden, 'y avisa: "Hoy no hay nada cargado. Mirá lo que viene esta semana"');
  // Una sola vez
  const veces=[...home.querySelectorAll('.tarjeta h3, .tarjeta-h h4')].filter(h=>txt(h)==='Noche del Jueves').length;
  ok(veces===1, 'el único evento aparece una sola vez en Inicio ('+veces+')');
  ok($('lista-cerca').style.display==='none' && $('titulo-cerca').parentElement.style.display==='none', '"Próximos eventos" queda vacío y se oculta');
  // Tarjetas
  ok(!home.querySelector('.btn-vista') && !/Vista previa/.test(txt(home)), 'las tarjetas no tienen la etiqueta "Vista previa"');
  home.querySelector('.tarjeta[data-abrir="jue"]').click(); await sleep(300);
  ok(w.document.querySelector('.screen.activa')?.id==='pantalla-detalle' && !$('hoja-cuenta').classList.contains('show'), 'tocar la tarjeta abre el evento (sin pedir cuenta)');
  $('btn-accion-detalle').click(); await sleep(50);
  ok($('hoja-cuenta').classList.contains('show'), 'la cuenta se pide recién al querer sumarse');
  w.cerrarPedirCuenta(); w.ir('home'); await sleep(50);
  // Textos
  ok(w.document.title==='Partazy | Todo lo que pasa cerca tuyo', 'título de la pestaña: "Partazy | Todo lo que pasa cerca tuyo"');
  ok(/Buscar fiestas, peñas, talleres…/.test(txt(home.querySelector('.buscador'))) && $('input-buscar').placeholder==='Buscar fiestas, peñas, talleres…', 'buscador: "Buscar fiestas, peñas, talleres…"');
  ok([...home.querySelectorAll('#chips-home .chip')].some(c=>c.textContent==='Talleres y ferias') && !/Charlas/.test(txt($('chips-home'))), 'chip "Talleres y ferias"');
  w.pedirCuenta(); await sleep(30); const hoja=txt($('hoja-cuenta')); w.cerrarPedirCuenta();
  ok(/fiestas, recitales, talleres y todo lo que pasa cerca tuyo/.test(hoja) && /Crear mi cuenta/.test(hoja) && /Ya tengo cuenta/.test(hoja) && !/·|Iniciar sesión|Crear cuenta gratis/.test(hoja), 'cartel de registro: talleres, "Crear mi cuenta" y "Ya tengo cuenta"');
  const cuerpo=w.document.body.cloneNode(true); cuerpo.querySelectorAll('script, style').forEach(x=>x.remove());
  const etiquetas=[...w.document.querySelectorAll('[aria-label]')].map(x=>x.getAttribute('aria-label')).join(' ');
  ok(!/PARTAZY/.test(cuerpo.textContent + etiquetas + w.document.title), 'dice "Partazy" (no "PARTAZY") en textos, títulos y etiquetas');
  ok(!/·/.test(txt(home.querySelector('.pie-legal'))), 'el pie del Inicio no tiene "·"');
  console.log(f?'\nFALLAS: '+f:'\nTODO OK'); process.exit(f?1:0);
})();
