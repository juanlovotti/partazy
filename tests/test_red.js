// Prueba: Red de amigos: quién va, sugerencias y compartir.
const { JSDOM } = require('jsdom'); const fs = require('fs');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put=(p,v)=>store.docs.set(p,v); const H=36e5, ahora=Date.now(), f=ahora+2*864e5;
const perfil=(uid,nombre,usuario,extra)=>{ put('users/'+uid,{nombre,usuario,iniciales:nombre[0],ciudad:'Córdoba',intereses:[],foto:'',nombreBusqueda:nombre.toLowerCase(),palabras:nombre.toLowerCase().split(' '),...(extra||{})}); put(`users/${uid}/privado/datos`,{nacimiento:'1998-01-01'}); };
perfil('A','Juan Lovotti','juan',{intereses:['House']});
perfil('B','Sofia Gomez','sofi',{ultimaConexion:ahora-60e3});
perfil('C','Ivo Paz','ivo',{ultimaConexion:ahora-30*60e3});
perfil('O','Vortex Club','vortex',{tipoCuenta:'organizacion'});
put('friendships/A_B',{users:['A','B'],de:'A',para:'B',estado:'aceptada'});
put('friendships/A_C',{users:['A','C'],de:'C',para:'A',estado:'aceptada'});
const base={creador:'O',creadorNombre:'Vortex Club',organizador:'Vortex Club',categoria:'techno',tipoLugar:'Fiesta',tipo:'fiesta',privacidad:'publica',hora:'23:00',lugar:'Güemes',lat:-31.42,lng:-64.19,precio:0,capacidad:100,confirmadosCount:3,edadMinima:18,dresscode:'Libre',musica:'Techno',imagen:'',descripcion:'x',reglas:'x',estado:'publicado',fechaTs:f,createdAt:ahora-72*H};
put('events/E1',{...base,nombre:'Noche Uno'});
put('events/E2',{...base,nombre:'Noche Dos',fechaTs:f+H});
put('events/E3',{...base,nombre:'Noche Tres',fechaTs:f+2*H});
put('events/E4',{...base,nombre:'Noche House',categoria:'house',musica:'House',fechaTs:f+3*H});
put('events/E5',{...base,nombre:'Sin relacion',categoria:'rock',musica:'Rock',fechaTs:f+4*H});
put('planes/B',{eventos:['E1'],compartidos:['E2'],red:{E3:2},ts:ahora});
put('planes/C',{eventos:['E1'],compartidos:[],red:{},ts:ahora});
const w = new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://partazy.web.app/',
  beforeParse(w){ w.firebase = makeFirebase(store,()=>({uid:'A',email:'a@t.com'})); w.navigator.geolocation=undefined; w.addEventListener('error',e=>console.error('ERROR JS',e.message)); }}).window;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const $=id=>w.document.getElementById(id); const txt=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();
let fallas=0; const ok=(c,m)=>{ console.log((c?'✔ ':'✘ ')+m); if(!c) fallas++; };
(async()=>{
  await sleep(700); w.cerrarTutorial(); await sleep(2600);
  const sem = txt($('lista-semana'));
  ok(/Sofia y Ivo van/.test(sem), 'las tarjetas dicen "Sofia y Ivo van"');
  const sug = txt($('lista-sugeridos'));
  ok($('lista-sugeridos').style.display !== 'none' && /Noche Uno/.test(sug), 'aparece "Tal vez te interese" con lo que van tus amigos');
  ok(/Noche Dos/.test(sug) && /Sofia lo compartió/.test(sug), 'sugiere lo que compartió un amigo');
  ok(/Noche Tres/.test(sug), 'sugiere a donde van amigos de amigos');
  ok(/Noche House/.test(sug), 'sugiere por tus gustos');
  ok(!/Sin relacion/.test(sug), 'no sugiere eventos sin relación');
  const orden = [...$('lista-sugeridos').querySelectorAll('h3')].map(h=>h.textContent);
  ok(orden[0]==='Noche Uno', 'primero lo que tiene más amigos');
  const pl = store.docs.get('planes/A');
  ok(pl && pl.red && pl.red.E1===2 && Array.isArray(pl.eventos), 'guarda mis planes con la cuenta anónima de mis amigos (red)');

  w.abrirDetalle('E1'); await sleep(300);
  ok(/Sofia y Ivo van a esta fiesta/.test(txt($('detalle-contenido'))), 'el detalle dice "Sofia y Ivo van a esta fiesta"');
  ok(!!w.document.querySelector('#detalle-contenido .organizador[data-usuario="O"]'), 'tocar al organizador lleva a su perfil');
  w.document.querySelector('#detalle-contenido .organizador').click(); await sleep(200);
  ok(w.document.querySelector('.screen.activa').id==='pantalla-usuario', 'y abre el perfil');

  w.abrirDetalle('E5'); await sleep(300);
  ok(/Compartir con mis amigos/.test($('btn-repost').textContent), 'botón para compartir con mis amigos');
  $('btn-repost').click(); await sleep(300); $('modal-ok').click(); await sleep(400); // ventana del comentario opcional: compartir sin comentario
  ok(store.docs.has('events/E5/reposts/A') && store.docs.get('events/E5').repostsCount===1, 'compartir guarda el registro y suma 1');
  const nB=[...store.docs.entries()].find(([k,v])=>k.startsWith('notificaciones/B/items/') && v.tipo==='evento_compartido');
  ok(!!nB, 'a mis amigos les llega "Juan compartió..."');
  await sleep(1000);
  ok((store.docs.get('planes/A').compartidos||[]).includes('E5'), 'queda en mis compartidos (lo ven mis amigos)');
  ok(/Compartido ✓/.test($('btn-repost').textContent) && /Lo compartiste vos/.test(txt($('detalle-contenido'))), 'se ve como compartido y el contador');
  $('btn-repost').click(); await sleep(400);
  ok(!store.docs.has('events/E5/reposts/A') && store.docs.get('events/E5').repostsCount===0, 'se puede deshacer');

  // En línea
  w.abrirAmigos(); await sleep(300);
  const am = $('lista-amigos');
  ok(am.querySelectorAll('.punto-linea').length===1 && /En línea/.test(txt(am)), 'Sofi aparece "En línea" (Ivo no)');
  ok(store.docs.get('users/A').ultimaConexion > ahora-5000, 'mi última conexión se guarda');
  w.abrirUsuario('C'); await sleep(250);
  ok(/Activo hace 30 min/.test(txt($('usuario-contenido'))), 'el perfil de Ivo dice "Activo hace 30 min"');

  // Bio
  w.ir('perfil'); w.editarPerfil(); $('ep-bio').value='Techno y amigos 🎧'; await w.guardarPerfil(); await sleep(300);
  ok(store.docs.get('users/A').bio==='Techno y amigos 🎧' && /Techno y amigos/.test(txt($('perfil-bio'))), 'biografía guardada y visible');
  ok(!!w.document.querySelector('#pantalla-perfil .pie-legal') && /Todos los derechos reservados/.test(txt(w.document.querySelector('#pantalla-perfil .pie-legal'))), 'pie con derechos reservados en el perfil');
  w.abrirTerminos(); ok(w.document.querySelector('.screen.activa').id==='pantalla-terminos', 'pantalla de términos');
  ok(!!w.document.querySelector('#pantalla-perfil .fila-botones') && /Buscar amigos/.test(txt(w.document.querySelector('#pantalla-perfil .fila-botones'))), 'botón "Buscar amigos" visible en el perfil');

  // Buscar personas desde Explorar
  w.ir('explorar'); $('input-buscar').value='sofia'; $('input-buscar').dispatchEvent(new w.Event('input')); await sleep(700);
  ok(/Personas/.test(txt($('explorar-personas'))) && /Sofia Gomez/.test(txt($('explorar-personas'))), 'Explorar también encuentra personas');

  // Egresados + mapa + aviso a amigos
  w.ir('crear');
  $('f-nombre').value='Egresados 2026'; $('f-fecha').value=new Date(f).toISOString().slice(0,10); $('f-hora').value='23:00'; $('f-capacidad').value='200'; $('f-estilo').value='cachengue'; $('f-ocasion').value='egresados';
  const M=w.eval('MAPA'); M.punto={lat:-31.4123,lng:-64.1876}; M.dir={corta:'Salón Ejemplo, Av. Colón 1234, Alberdi',barrio:'Alberdi',completa:'Av. Colón 1234, Alberdi, Córdoba'}; M.pin={setLatLng(){}}; 
  w.confirmarMapa(); await sleep(50);
  ok($('f-lugar').value==='Salón Ejemplo, Av. Colón 1234, Alberdi' && /marcada/.test($('mapa-elegido').textContent), 'elegir en el mapa completa el lugar');
  const c0=w.confirmar; w.confirmar=async()=>true; w.mostrarVistaPrevia=async()=>true; await w.publicarEvento(); w.confirmar=c0; await sleep(300);
  const [k,ev]=[...store.docs.entries()].find(([k,v])=>/^events\/[^/]+$/.test(k)&&v.nombre==='Egresados 2026');
  ok(ev.ocasion==='egresados' && ev.lat===-31.4123 && ev.ubicacionExacta===true, 'guarda tipo "egresados" y el punto exacto del mapa');
  const nA=[...store.docs.entries()].filter(([k,v])=>/^notificaciones\/(B|C)\/items\//.test(k) && v.tipo==='amigo_evento');
  ok(nA.length===2, 'a mis amigos les llega "Juan publicó..."');
  w.ir('home'); w.elegirChipHome([...w.document.querySelectorAll('#chips-home .chip')].find(c=>c.textContent==='Egresados'),'egresados'); await sleep(50);
  ok(/Egresados 2026/.test(txt($('lista-esta-noche'))) && /Egresados/.test(txt(w.document.querySelector('#lista-esta-noche .cat'))), 'el filtro "Egresados" la muestra con su etiqueta');
  ok([...w.document.querySelectorAll('#chips-home .chip')].some(c=>c.textContent==='Peñas'), 'chip "Peñas"');

  // Mensaje nuevo: aviso dentro de la app
  w.ir('home'); put('dms/A_B',{miembros:['A','B'],ultimoMsg:'¿Vamos?',ultimoTs:Date.now(),ultimoDe:'B',vistoPor:{}});
  await w.eval("DataService").enviarDM('A_B',['A','B'],'B',{de:'B',texto:'¿Vamos?',ts:Date.now()+5},'¿Vamos?'); await sleep(200);
  ok(/Mensaje nuevo de Sofia/.test($('toast').textContent), 'llega aviso de mensaje nuevo');
  console.log(fallas ? '\nFALLAS: '+fallas : '\nTODO OK'); process.exit(fallas?1:0);
})();
