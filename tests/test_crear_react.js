// Prueba: Crear por pasos en React (interruptor ?react=crear), con la app completa y la base falsa.
// Sin interruptor sigue el formulario de siempre; editar siempre usa el de siempre; publicar pasa por las mismas
// reglas (publicarConDatos) y respeta la privacidad de las previas.
const { JSDOM } = require('jsdom');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put = (p, v) => store.docs.set(p, v);
put('users/A', { nombre: 'Lu Ferreyra', usuario: 'lu.ferreyra', iniciales: 'LF', ciudad: 'Córdoba', intereses: [], foto: '', nombreBusqueda: 'lu ferreyra', palabras: ['lu', 'ferreyra'] });
put('users/A/privado/datos', { nacimiento: '1998-01-01' });
const F = Date.now() + 5 * 864e5;
put('events/mio', { creador: 'A', creadorNombre: 'Lu Ferreyra', organizador: 'Lu Ferreyra', nombre: 'Mi Fiesta', tipo: 'fiesta', ocasion: 'fiesta', tipoLugar: 'Fiesta', privacidad: 'publica', hora: '23:00', lugar: 'Güemes 100', lat: -31.42, lng: -64.19, precio: 0, capacidad: 50, confirmadosCount: 1, edadMinima: 18, dresscode: 'Libre', musica: '', imagen: '', descripcion: 'x', reglas: 'x', estado: 'publicado', fechaTs: F });
const mk = (url, sinCuenta) => new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url, beforeParse(w){
  w.firebase = makeFirebase(store, () => sinCuenta ? null : ({ uid: 'A', email: 'lu@t.com' })); w.navigator.geolocation = undefined;
  w.addEventListener('error', e => console.log('ERROR JS', e.message)); } }).window;
const sleep = ms => new Promise(r => setTimeout(r, ms)); const txt = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
let f = 0; const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if(!c) f++; };
const escribir = (w, el, valor) => {
  const proto = el.tagName === 'TEXTAREA' ? w.HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? w.HTMLSelectElement.prototype : w.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, valor);
  el.dispatchEvent(new w.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
};

(async () => {
  // ---------- En partazy.com: publicado para todos ----------
  const inv = mk('https://partazy.com/', true); await sleep(2500);
  ok(inv.__pantallasReact.has('crear') && !inv.document.querySelector('#pantalla-crear-pasos [data-react]'), 'en partazy.com está publicado, pero quien mira sin cuenta no baja React');
  const prod = mk('https://partazy.com/'); await sleep(900); await prod.__reactListo; await sleep(50); try{ prod.cerrarTutorial(); } catch(e){}
  prod.ir('crear'); await sleep(30);
  ok(!!prod.document.querySelector('#pantalla-crear-pasos > [data-react="crear"]') && prod.NAV.actual === 'crear-pasos', 'con cuenta, en partazy.com "Crear" abre el Crear por pasos');
  prod.localStorage.setItem('partazy_idioma', JSON.stringify('en')); prod.ir('home'); await sleep(20);
  prod.ir('crear'); await sleep(30);
  ok(prod.idiomaActual() === 'en' && prod.NAV.actual === 'crear', 'con el sitio traducido usa el formulario de siempre (el traductor puede romper React)');
  prod.localStorage.setItem('partazy_idioma', JSON.stringify('es'));
  const viejo = mk('https://partazy.com/?react=0'); await sleep(1500); try{ viejo.cerrarTutorial(); } catch(e){}
  viejo.ir('crear'); await sleep(30);
  ok(!viejo.__pantallasReact.size && viejo.NAV.actual === 'crear', 'salida de emergencia: partazy.com/?react=0 vuelve al formulario de siempre');

  // ---------- Sin interruptor: el formulario de siempre ----------
  const v = mk('https://partazy--prueba-abc123.web.app/?react=0'); await sleep(900); try{ v.cerrarTutorial(); } catch(e){}
  v.ir('crear'); await sleep(30);
  ok(v.NAV.actual === 'crear' && v.document.querySelector('.screen.activa')?.id === 'pantalla-crear', 'sin interruptor, "Crear" abre el formulario de siempre');


  // ---------- Con interruptor ----------
  const w = mk('https://partazy--prueba-abc123.web.app/?react=crear'); const $ = id => w.document.getElementById(id);
  await sleep(900); await w.__reactListo; await sleep(50); try{ w.cerrarTutorial(); } catch(e){}
  const paso = () => txt(w.document.querySelector('.cp-num'));
  const sig = async () => { w.document.querySelector('.cp-siguiente').click(); await sleep(40); };
  const toast = () => txt($('toast'));
  ok(!!w.document.querySelector('#pantalla-crear-pasos > [data-react="crear"]'), 'con ?react=crear lo dibuja React, en su propia pantalla');
  w.document.querySelector('.nav-item.crear').click(); await sleep(40);
  ok(w.NAV.actual === 'crear-pasos' && w.document.querySelector('.screen.activa')?.id === 'pantalla-crear-pasos', 'el botón "+" abre el Crear por pasos');
  ok($('app').classList.contains('foco-crear') && w.document.querySelector('.nav-item.crear').classList.contains('activo'), 'en el celu se esconde la barra de abajo; "Crear" queda marcado');
  ok(paso() === '1 / 7' && w.document.querySelectorAll('.cp-tipo').length === 13, 'paso 1: los 13 tipos');
  await sig();
  ok(paso() === '1 / 7' && /Elegí qué tipo/.test(toast()), 'sin tipo no avanza y avisa');

  // Previa privada, gratis
  [...w.document.querySelectorAll('.cp-tipo')].find(b => /Previa/.test(b.textContent)).click(); await sleep(20);
  ok(w.document.querySelector('.cp-tipo.on')?.getAttribute('aria-pressed') === 'true', 'el tipo elegido queda marcado (aria-pressed)');
  await sig();
  ok(paso() === '2 / 7' && w.document.activeElement === w.document.querySelector('.cp-titulo h2'), 'paso 2, con el foco en el título (para lectores de pantalla)');
  await sig(); ok(paso() === '2 / 7' && w.document.activeElement === $('cp-nombre'), 'sin nombre no avanza y lleva el foco al campo');
  escribir(w, $('cp-nombre'), 'Previa de Lu'); await sleep(10); await sig();
  ok(paso() === '3 / 7', 'paso 3: cuándo');
  w.document.querySelectorAll('.cp-dia')[2].click(); await sleep(10);
  [...w.document.querySelectorAll('.cp-chips .chip')].find(b => b.textContent === '22:00').click(); await sleep(10);
  ok(/22:00/.test(txt($('cp-hora'))) && /a las 22:00/.test(txt(w.document.querySelector('.cp-resumen-linea'))), 'elige día y hora con un toque, y lo resume abajo');
  await sig(); ok(paso() === '4 / 7', 'paso 4: dónde');
  ok(!!w.document.querySelector('.cp-fila-switch [role=switch][aria-checked=true]') && /Barrio o zona/.test(txt(w.document.querySelector('label[for=cp-lugar]'))), 'previa: arranca privada y pide solo el barrio');
  escribir(w, $('cp-lugar'), 'Colón 1234, Alberdi'); await sleep(10); await sig();
  ok(paso() === '4 / 7' && /solo el barrio/.test(toast()), 'con calle y número en el barrio, no avanza');
  escribir(w, $('cp-lugar'), 'Alberdi'); await sleep(10); await sig();
  ok(paso() === '4 / 7' && /dirección exacta/.test(toast()) && w.document.activeElement === $('cp-direccion'), 'falta la dirección exacta: foco ahí');
  escribir(w, $('cp-direccion'), 'Colón 1234, Alberdi'); await sleep(10); await sig();
  ok(paso() === '5 / 7' && w.document.querySelector('.cp-opcion.on')?.textContent.includes('Gratis'), 'paso 5: arranca en Gratis');
  await sig();
  escribir(w, $('cp-capacidad'), '15'); await sleep(10);
  ok(!!w.document.querySelector('.cp-fila-switch') && /Llevar bebida/.test(txt(w.document.querySelector('.cp'))), 'previa: aparece "Llevar bebida"');
  ok(!/Lista VIP|Estilo de música/.test(txt(w.document.querySelector('.cp-extras'))), 'previa: sin lista VIP ni estilo de música');
  await sig(); ok(paso() === '7 / 7', 'paso 7: revisar');
  const muestra = w.document.querySelector('.cp-muestra');
  ok(muestra?.querySelector('.tarjeta') && txt(muestra.querySelector('.lugar-txt')) === 'Alberdi' && !/Colón|1234/.test(muestra.innerHTML), 'la tarjeta de muestra no muestra la dirección');
  ok(muestra.hasAttribute('inert'), 'la tarjeta de muestra no se puede tocar ni enfocar');
  await sig();
  ok(paso() === '7 / 7' && /normas/.test(toast()) && w.document.activeElement === $('cp-normas'), 'sin aceptar las normas no publica');
  $('cp-normas').click(); await sleep(10);
  let preguntas = 0; w.confirmar = async () => { preguntas++; return true; };
  await sig(); await sleep(250);
  const [idP, evP] = [...store.docs.entries()].find(([k, x]) => k.startsWith('events/') && k.split('/').length === 2 && x.nombre === 'Previa de Lu') || [];
  ok(evP && evP.privacidad === 'privada' && evP.tipo === 'previa' && evP.ocasion === 'previa' && evP.lugar === 'Alberdi' && evP.capacidad === 15 && evP.precio === 0 && evP.bebida === true, 'se publica la previa privada con sus datos');
  ok(evP && !JSON.stringify(evP).includes('Colón'), 'el documento público del evento no tiene la dirección');
  ok([...store.docs.entries()].some(([k, x]) => k.startsWith(idP + '/') && JSON.stringify(x).includes('Colón 1234')), 'la dirección exacta se guarda aparte (la privada)');
  ok(preguntas === 0 && w.NAV.actual === 'confirmacion', 'sin preguntas de más; muestra "¡Tu evento está publicado!"');
  ok(!$('app').classList.contains('foco-crear'), 'al salir vuelve la barra de abajo');
  w.ir('crear'); await sleep(40);
  ok(paso() === '1 / 7' && !w.document.querySelector('.cp-tipo.on') && txt(w.document.querySelector('.cp-mini-txt b')) === 'Tu evento', 'al volver a "Crear" arranca de cero');

  // Fiesta paga con comprobante
  [...w.document.querySelectorAll('.cp-tipo')].find(b => /^Fiesta$/.test(txt(b))).click(); await sleep(10); await sig();
  escribir(w, $('cp-nombre'), 'Noche Vortex'); await sleep(10); await sig();
  w.document.querySelectorAll('.cp-dia')[3].click(); await sleep(10); await sig();
  escribir(w, $('cp-lugar'), 'Belgrano 800, Güemes'); await sleep(10); await sig();
  [...w.document.querySelectorAll('.cp-opcion')].find(b => /Paga/.test(b.textContent)).click(); await sleep(10);
  escribir(w, $('cp-precio'), '7000'); escribir(w, $('cp-pago-info'), 'efectivo en la puerta'); await sleep(10); await sig();
  ok(paso() === '5 / 7' && /alias o CBU/.test(toast()) && w.document.activeElement === $('cp-pago-info'), 'con comprobante y sin alias, no avanza');
  escribir(w, $('cp-pago-info'), 'Alias: vortex.club'); await sleep(10); await sig();
  ok(paso() === '6 / 7', 'con alias avanza');
  escribir(w, $('cp-capacidad'), '1'); await sleep(10); await sig();
  ok(paso() === '6 / 7' && /Capacidad entre 2/.test(toast()), 'capacidad fuera de rango: no avanza');
  escribir(w, $('cp-capacidad'), '300'); await sleep(10);
  [...w.document.querySelectorAll('.cp-extra-cab')].find(b => /Estilo de música/.test(b.textContent)).click(); await sleep(10);
  escribir(w, $('cp-estilo'), 'techno'); await sleep(10);
  [...w.document.querySelectorAll('.cp-extra-cab')].find(b => /Lista VIP/.test(b.textContent)).click(); await sleep(10);
  w.document.querySelector('.cp-extra-cuerpo [role=switch]').click(); await sleep(10);
  escribir(w, $('cp-vip'), 'Sofía Gómez\nIvo Paz +1'); await sleep(10);
  await sig(); ok(paso() === '7 / 7', 'paso 7');
  const res = txt(w.document.querySelector('.cp-resumen'));
  ok(/\$7\.000, con comprobante a vortex\.club/.test(res) && /300 personas/.test(res) && /Techno/.test(res) && /Lista VIP/.test(res), 'el resumen dice lo que se cargó');
  ok(!/[·•]/.test(res), 'el resumen no usa "·" ni "•"');
  $('cp-normas').click(); await sleep(10); await sig(); await sleep(250);
  const evV = [...store.docs.values()].find(x => x.nombre === 'Noche Vortex');
  ok(evV && evV.precio === 7000 && evV.cobroComprobante === true && evV.pagoInfo === 'Alias: vortex.club' && evV.categoria === 'techno' && evV.listaVip === true && evV.capacidad === 300, 'se publica la fiesta paga con comprobante, estilo y lista VIP');

  // Un error que encuentra la app vieja al publicar lleva al paso y al campo
  w.ir('crear'); await sleep(30);
  [...w.document.querySelectorAll('.cp-tipo')].find(b => /^Fiesta$/.test(txt(b))).click(); await sleep(10); await sig();
  escribir(w, $('cp-nombre'), 'Fiesta sin número'); await sleep(10); await sig();
  w.document.querySelectorAll('.cp-dia')[3].click(); await sleep(10); await sig();
  escribir(w, $('cp-lugar'), 'Güemes'); await sleep(10); await sig(); await sig();
  escribir(w, $('cp-capacidad'), '40'); await sleep(10); await sig();
  $('cp-normas').click(); await sleep(10);
  w.confirmar = async (t) => { preguntas++; return !/completa/.test(t); };   // "¿La dirección está completa?" → No
  await sig(); await sleep(150);
  ok(paso() === '4 / 7' && w.document.activeElement === $('cp-lugar') && ![...store.docs.values()].some(x => x.nombre === 'Fiesta sin número'), 'si la dirección no está completa, vuelve a "¿Dónde es?" con el foco en el lugar');

  // Lugar elegido de una sugerencia: si después escribís otro (aunque sea volviendo de otro paso), la ubicación se borra
  w.buscarLugares = async () => [{ nombre: 'Club Paraguay, Güemes, Córdoba', detalle: 'Córdoba', lat: -31.4321, lng: -64.1987, ciudad: 'Córdoba' }];
  // (sigue el borrador de arriba, que quedó en "¿Dónde es?")
  ok(paso() === '4 / 7', 'el borrador sin publicar se conserva en el paso donde quedó');
  escribir(w, $('cp-lugar'), 'Club Para'); await sleep(600);
  const sug = w.document.querySelector('.cp-sug');
  ok(!!sug && /Club Paraguay/.test(txt(sug)), 'aparecen sugerencias de lugares');
  sug.click(); await sleep(20);
  ok($('cp-lugar').value === 'Club Paraguay, Güemes, Córdoba' && /Ubicado/.test(txt(w.document.querySelector('.cp-ok'))) && !!w.document.querySelector('.cp-mapa-teselas'), 'al elegirla queda ubicado y se ve el mapa chico');
  await sig(); ok(paso() === '5 / 7', 'sigue al paso 5');
  w.document.querySelector('.cp-cab-btn').click(); await sleep(30);
  ok(paso() === '4 / 7' && !!w.document.querySelector('.cp-mapa-teselas'), 'Atrás: vuelve a "¿Dónde es?" con la ubicación');
  escribir(w, $('cp-lugar'), 'Quality Espacio'); await sleep(20);
  ok(!w.document.querySelector('.cp-mapa-teselas') && !w.document.querySelector('.cp-ok'), 'escribir otro lugar borra la ubicación de la sugerencia (aunque hayas ido y vuelto)');
  w.buscarLugares = async () => null;

  // Editar sigue en el formulario de siempre
  await w.editarEvento(w.state.eventos.find(e => e.id === 'mio')); await sleep(60);
  ok(w.NAV.actual === 'crear' && w.document.querySelector('.screen.activa')?.id === 'pantalla-crear' && $('crear-titulo').textContent === 'Editar evento', 'editar un evento usa el formulario de siempre');
  w.document.querySelector('.nav-item.crear').click(); await sleep(40);
  ok(w.NAV.actual === 'crear-pasos' && !w.state.editandoId, 'y tocar "+" mientras editabas abre el Crear por pasos (sin quedar en modo edición)');

  console.log(f ? `\n${f} falla(s)` : '\nTodo OK'); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
