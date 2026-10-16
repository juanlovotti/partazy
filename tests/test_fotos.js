// Prueba: Fotos de eventos: miniatura en la tarjeta y foto grande aparte.
// En jsdom no hay canvas real: simulamos la miniatura para probar el flujo de datos
const { JSDOM } = require('jsdom'); const fs = require('fs');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put=(p,v)=>store.docs.set(p,v); const T=Date.now();
put('users/A',{nombre:'Juan',usuario:'juan',iniciales:'J',ciudad:'Córdoba',intereses:[],foto:'',nombreBusqueda:'juan',palabras:['juan']}); put('users/A/privado/datos',{nacimiento:'1998-01-01'});
const GRANDE='data:image/jpeg;base64,'+'A'.repeat(300000), MINI='data:image/jpeg;base64,'+'B'.repeat(30000);
put('events/viejo',{creador:'A',creadorNombre:'Juan',organizador:'Juan',nombre:'Evento viejo',categoria:'techno',tipoLugar:'Fiesta',tipo:'fiesta',privacidad:'publica',hora:'23:00',lugar:'Güemes',lat:-31.42,lng:-64.19,precio:0,capacidad:50,confirmadosCount:1,edadMinima:18,dresscode:'Libre',musica:'Techno',imagen:GRANDE,descripcion:'x',reglas:'x',estado:'publicado',fechaTs:T+2*864e5,createdAt:T-864e5});
const w=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://partazy.web.app/',beforeParse(w){ w.firebase=makeFirebase(store,()=>({uid:'A',email:'a@t.com'})); w.navigator.geolocation=undefined; w.addEventListener('error',e=>console.error('ERROR JS',e.message)); }}).window;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const $=id=>w.document.getElementById(id);
let f=0; const ok=(c,m)=>{console.log((c?'✔ ':'✘ ')+m); if(!c) f++;};
(async()=>{
  await sleep(300); w.eval("miniaturaDe = async () => '"+MINI+"'");
  await sleep(500); w.cerrarTutorial(); await sleep(4500);
  const v=store.docs.get('events/viejo');
  ok(v.imagen===MINI && v.fotoGrande===true, 'evento viejo: la tarjeta pasa a usar la miniatura');
  ok(store.docs.get('events/viejo/media/foto')?.imagen===GRANDE, 'la foto grande queda guardada aparte');
  // nuevo evento
  w.ir('crear'); w.eval("state.imagenNueva='"+GRANDE+"'; state.imagenMini='"+MINI+"'");
  $('f-nombre').value='Con foto'; $('f-lugar').value='Belgrano 800, Güemes'; $('f-fecha').value=new Date(T+3*864e5).toISOString().slice(0,10); $('f-hora').value='23:00'; $('f-capacidad').value='40'; $('f-estilo').value='house';
  w.mostrarVistaPrevia=async()=>true; await w.publicarEvento(); await sleep(300);
  const [k,ev]=[...store.docs.entries()].find(([k,v])=>/^events\/[^/]+$/.test(k)&&v.nombre==='Con foto');
  ok(ev.imagen===MINI && ev.fotoGrande===true && store.docs.get(k+'/media/foto')?.imagen===GRANDE, 'evento nuevo: miniatura en la tarjeta y grande aparte');
  ok(ev.imagen.length < 80000, 'el evento pesa menos de 80 KB');
  // el detalle carga la grande
  w.eval("fotosGrandes.clear()"); w.abrirDetalle(k.split('/')[1]); await sleep(500);
  ok(/BBBB/.test($('hero-img').style.backgroundImage) || /AAAA/.test($('hero-img').style.backgroundImage), 'el detalle muestra la foto (primero la chica, después la grande)');
  ok(w.eval("fotosGrandes.has('"+k.split('/')[1]+"')"), 'la grande se bajó al abrir el evento y queda en memoria');
  // editar sin tocar la foto: "No cambiaste nada"
  $('btn-editar-evento').click(); await sleep(100); await w.publicarEvento(); await sleep(50);
  ok($('toast').textContent==='No cambiaste nada', 'editar sin cambios no toca la foto');
  console.log(f?'\nFALLAS: '+f:'\nTODO OK'); process.exit(f?1:0);
})();
