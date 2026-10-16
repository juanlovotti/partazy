// Prueba: Modo sin cuenta: qué se puede mirar y qué pide registrarse.
const { JSDOM } = require('jsdom'); const fs = require('fs');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); store.estricto = true; const put=(p,v)=>store.docs.set(p,v); const T=Date.now();
put('users/A',{nombre:'Juan',usuario:'juan',iniciales:'J',ciudad:'Córdoba',intereses:[],foto:'',nombreBusqueda:'juan',palabras:['juan']}); put('users/A/privado/datos',{nacimiento:'1998-01-01'});
put('users/O',{nombre:'Vortex',usuario:'vortex',iniciales:'V',tipoCuenta:'organizacion',ciudad:'Córdoba',intereses:[],foto:''});
const ev=(id,o)=>put('events/'+id,Object.assign({creador:'O',creadorNombre:'Vortex',organizador:'Vortex',categoria:'techno',tipo:'fiesta',ocasion:'fiesta',privacidad:'publica',fechaTs:T+2*864e5,hora:'23:30',lugar:'Güemes',lat:-31.42,lng:-64.19,precio:5000,capacidad:200,confirmadosCount:20,edadMinima:18,imagen:'',descripcion:'Techno toda la noche',fotoGrande:true},o));
ev('e1',{nombre:'Noche Vortex'}); ev('e2',{nombre:'Previa privada',tipo:'previa',ocasion:'previa',privacidad:'privada',lugar:'Nueva Córdoba'});
put('events/e1/media/foto',{imagen:'data:image/jpeg;base64,AAA',ts:1});
put('events/e2/private/datos',{direccion:'Calle Secreta 123'});
let usuario=null, disparar;
const mk=(url)=>new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url,beforeParse(w){ w.firebase=makeFirebase(store,()=>usuario,f=>{disparar=f;}); w.navigator.geolocation=undefined; w.addEventListener('error',e=>console.error('ERROR JS',e.message)); w.console.error=(...a)=>console.log('console.error',...a.map(String)); }}).window;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const txt=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();
let f=0; const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m); if(!c) f++;};
(async()=>{
  const w=mk('https://partazy.web.app/'); const $=id=>w.document.getElementById(id); const act=()=>w.document.querySelector('.screen.activa')?.id;
  const cuenta=()=>$('hoja-cuenta').classList.contains('show');
  await sleep(600);
  ok(act()==='pantalla-home' && !$('app').classList.contains('sin-nav'), 'sin cuenta: entra directo a la app (inicio con la barra de abajo)');
  ok(w.document.body.classList.contains('modo-invitado') && /Noche Vortex/.test(txt($('pantalla-home'))), 'se ven los eventos');
  ok(!cuenta(), 'la ventana de registro todavía no salta');
  await sleep(1300);
  ok(cuenta() && /Sumate a la noche/.test(txt($('hoja-cuenta'))), 'a los segundos salta "Registrate o iniciá sesión"');
  w.cerrarPedirCuenta(); await sleep(50);
  ok(!cuenta() && act()==='pantalla-home', 'se puede cerrar y seguir mirando');
  // chips: libres
  const chip=[...w.document.querySelectorAll('#chips-home .chip')][1]; chip.click(); await sleep(50);
  ok(!cuenta() && chip.classList.contains('activo'), 'filtros (chips): se pueden usar sin cuenta');
  // crear: pide cuenta
  w.document.querySelector('[data-nav="crear"]').click(); await sleep(50);
  ok(cuenta() && /publicar/.test(txt($('cuenta-texto'))) && act()==='pantalla-home', 'tocar Crear pide cuenta y no cambia de pantalla');
  w.cerrarPedirCuenta(); await sleep(30);
  w.document.querySelector('[data-nav="perfil"]').click(); await sleep(30);
  ok(cuenta() && act()==='pantalla-home', 'Perfil pide cuenta'); w.cerrarPedirCuenta(); await sleep(30);
  w.document.querySelector('[data-nav="chats"]').click(); await sleep(30);
  ok(cuenta(), 'Chats pide cuenta'); w.cerrarPedirCuenta(); await sleep(30);
  w.document.querySelector('#pantalla-home .topbar [aria-label="Notificaciones"]').click(); await sleep(30);
  ok(cuenta(), 'Notificaciones pide cuenta'); w.cerrarPedirCuenta(); await sleep(30);
  // explorar libre
  w.document.querySelector('[data-nav="explorar"]').click(); await sleep(80);
  ok(act()==='pantalla-explorar' && !cuenta(), 'Explorar se puede usar');
  $('seg-personas').click(); await sleep(30); ok(cuenta(), 'buscar Personas pide cuenta'); w.cerrarPedirCuenta(); await sleep(30);
  // abrir evento desde tarjeta
  const card=[...w.document.querySelectorAll('#pantalla-explorar .tarjeta, #pantalla-explorar .tarjeta-h')].find(c=>/Noche Vortex/.test(c.textContent));
  card.click(); await sleep(300);
  ok(act()==='pantalla-detalle' && /Noche Vortex/.test(txt($('detalle-contenido'))) && !cuenta(), 'tocar una tarjeta abre el evento');
  ok(/Techno toda la noche/.test(txt($('detalle-contenido'))), 'se ven los detalles del evento');
  $('btn-accion-detalle').click(); await sleep(50);
  ok(cuenta() && /confirmar/.test(txt($('cuenta-texto'))), 'confirmar asistencia pide cuenta'); w.cerrarPedirCuenta(); await sleep(30);
  w.document.querySelector('.organizador[data-usuario]').click(); await sleep(50);
  ok(cuenta() && act()==='pantalla-detalle', 'ver el perfil del organizador pide cuenta'); w.cerrarPedirCuenta(); await sleep(30);
  $('btn-enviar-amigos').click(); await sleep(30); ok(cuenta(), 'enviar a amigos pide cuenta'); w.cerrarPedirCuenta(); await sleep(30);
  // privada: sin dirección
  w.abrirDetalle('e2'); await sleep(300);
  ok(!/Calle Secreta/.test(txt($('detalle-contenido'))) && /Nueva Córdoba/.test(txt($('detalle-contenido'))), 'previa privada: sin cuenta no se ve la dirección');
  // ir a iniciar sesión y volver a mirar
  w.abrirDetalle('e1'); await sleep(300);
  w.pedirCuenta(); await sleep(20); [...$('hoja-cuenta').querySelectorAll('button')].find(b=>/Crear cuenta/.test(b.textContent)).click(); await sleep(150);
  ok(act()==='pantalla-bienvenida' && /Creá|Crear/.test(txt($('btn-auth-principal'))), '"Crear cuenta" lleva al registro');
  ok(w.sessionStorage.getItem('partazy_ruta')==='#/evento/e1', 'recuerda el evento que estaba mirando');
  const seguir=w.document.querySelector('.btn-seguir-mirando'); ok(seguir && w.getComputedStyle(seguir).display!=='none', 'en la pantalla de ingreso aparece "Seguir mirando sin cuenta"');
  seguir.click(); await sleep(80); ok(act()==='pantalla-home' && !$('app').classList.contains('sin-nav'), 'y vuelve a la app');
  // inicia sesión: vuelve al evento
  w.irALogin('ingresar'); await sleep(120);
  usuario={uid:'A',email:'a@t.com'}; disparar(usuario); await sleep(900);
  ok(!w.document.body.classList.contains('modo-invitado') && w.eval('state.invitado')===false, 'al iniciar sesión deja el modo invitado');
  ok(act()==='pantalla-detalle' && /Noche Vortex/.test(txt($('detalle-contenido'))), 'y lo lleva al evento que estaba mirando');
  ok(!cuenta(), 'la ventana de registro ya no aparece');
  // link compartido directo
  usuario=null;
  const w2=mk('https://partazy.web.app/#/evento/e1'); await sleep(900);
  ok(w2.document.querySelector('.screen.activa')?.id==='pantalla-detalle' && /Noche Vortex/.test(txt(w2.document.getElementById('detalle-contenido'))), 'link compartido sin cuenta: abre la fiesta directo');
  await sleep(3000);
  ok(w2.document.getElementById('hoja-cuenta').classList.contains('show'), 'y después ofrece registrarse');
  const den=[...new Set((store.denegados||[]))];
  console.log('lecturas denegadas (invitado):', JSON.stringify(den));
  console.log(f?'\nFALLAS: '+f:'\nTODO OK'); process.exit(f?1:0);
})();
