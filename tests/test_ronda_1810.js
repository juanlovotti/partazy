// Prueba: organizaciones (qué organizan, música solo si va, banner, nombre propio), géneros nuevos y "Otro",
// preguntas frecuentes de cada evento, torneos por equipos, "Organizando" sin duplicar y miniaturas sin foto.
const { JSDOM } = require('jsdom');
const { crearStore, makeFirebase } = require('./fakefb.js');
const html = require('./cargar-html.js')();
const store = crearStore(); const put = (p, v) => store.docs.set(p, v);
const GOOGLE = 'https://lh3.googleusercontent.com/a/foto-juan';
put('users/A', { nombre: 'Juan Lovotti', usuario: 'juan', iniciales: 'JL', ciudad: 'Córdoba', intereses: [], foto: GOOGLE, nombreBusqueda: 'juan lovotti', palabras: ['juan'] });
put('users/A/privado/datos', { nacimiento: '1998-01-01' }); put('usernames/juan', { uid: 'A' });
put('users/B', { nombre: 'Beto Paz', usuario: 'beto', iniciales: 'BP', ciudad: 'Córdoba', intereses: [], foto: '' });
put('users/B/privado/datos', { nacimiento: '1998-01-01' }); put('usernames/beto', { uid: 'B' });
put('users/O', { nombre: 'Productora Luna', usuario: 'luna', iniciales: 'P', ciudad: 'Córdoba', intereses: [], foto: GOOGLE, tipoCuenta: 'organizacion' });
put('users/O/privado/datos', { nacimiento: '1990-01-01' }); put('usernames/luna', { uid: 'O' });

const abrir = (usuario) => new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://partazy.com/',
  beforeParse(w){ w.firebase = makeFirebase(store, () => usuario); w.navigator.geolocation = undefined;
    w.fetch = async () => ({ json: async () => [] });
    w.addEventListener('error', e => console.error('ERROR JS', e.message)); } }).window;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const txt = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
let f = 0; const ok = (c, m) => { console.log((c ? '✔ ' : '✘ ') + m); if(!c) f++; };
const evs = () => [...store.docs.entries()].filter(([k]) => /^events\/[^/]+$/.test(k)).map(([k, v]) => ({ id: k.split('/')[1], ...v }));
const fecha = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);

(async () => {
  // ---------- Registro de una organización con la cuenta de Google "Contacto" ----------
  const N = abrir({ uid: 'N', email: 'contacto@productora.com', displayName: 'Contacto', photoURL: GOOGLE }); await sleep(400);
  const $N = id => N.document.getElementById(id);
  ok($N('rg-nombre').value === 'Contacto', 'registro: arranca con el nombre de la cuenta de Google');
  N.elegirTipoCuenta('rg-tipo', 'organizacion'); await sleep(20);
  ok($N('rg-nombre').value === '' && /Productora Luna/.test($N('rg-nombre').placeholder), 'organización: no usa el nombre de la cuenta de Google, pide el de la organización');
  ok(!N.document.querySelector('#rg-foto img'), 'organización: no usa la foto de la cuenta de Google');
  const tit = [...N.document.querySelectorAll('#rg-intereses .grupo-tit')].map(txt);
  ok(/¿Qué tipo de eventos organizás\?/.test(tit[0]) && N.document.querySelector('#rg-intereses [data-interes="Fiestas"]'), 'organización: en vez de "intereses" pregunta qué tipo de eventos organiza');
  $N('rg-nombre').value = 'Sala Norte'; $N('rg-nombre').dispatchEvent(new N.Event('input')); await sleep(500);
  ok($N('rg-usuario').value === 'sala.norte' || $N('rg-usuario').value === 'salanorte', 'el @usuario se sugiere con el nombre que escribió (' + $N('rg-usuario').value + ')');
  $N('rg-nacimiento').value = '1990-06-15'; $N('rg-normas').checked = true;
  N.document.querySelector('#rg-intereses [data-interes="Charlas y talleres"]').click();
  await N.completarRegistro(); await sleep(250);
  const regN = store.docs.get('users/N');
  ok(regN && regN.nombre === 'Sala Norte' && regN.foto === '' && regN.tipoCuenta === 'organizacion', 'se registra con el nombre elegido y sin la foto de Google');
  ok(N.pasosTutorial()[0].t === '¡Hola, Sala Norte!', 'el tutorial saluda con el nombre elegido (completo, por ser organización): ' + N.pasosTutorial()[0].t);

  // ---------- Organización: qué organiza, música solo si corresponde, banner ----------
  const O = abrir({ uid: 'O', email: 'o@t.com' }); await sleep(900); try{ O.cerrarTutorial(); }catch(e){}
  const $O = id => O.document.getElementById(id);
  O.editarPerfil(); await sleep(20);
  const ch = n => O.document.querySelector(`#ep-intereses [data-interes="${n}"]`);
  ok(O.document.getElementById('ep-intereses').classList.contains('es-org') && ch('Fiestas') && ch('Ferias'), 'editar perfil (organización): elige qué tipo de eventos organiza');
  ch('Charlas y talleres').click(); ch('Techno').click();
  ok(JSON.stringify(O.interesesElegidos('ep-intereses')) === '["Charlas y talleres"]', 'si no organiza nada con música, la música no se guarda');
  ch('Peñas').click(); ch('Folklore').click(); ch('Techno').click(); ch('__otro').click();
  O.document.querySelector('#ep-intereses .otro-musica').value = 'chamamé, candombe';
  const el = O.interesesElegidos('ep-intereses');
  ok(el.includes('Peñas') && el.includes('Folklore') && el.includes('Chamamé') && el.includes('Candombe') && !el.includes('__otro'), 'peñas → aparece la música; "Otro" guarda lo que escribió: ' + JSON.stringify(el));
  ok($O('ep-banner-input') && $O('ep-org').style.display === 'flex', 'la organización puede subir un banner');
  await O.guardarPerfil(); await sleep(150);
  const uO = store.docs.get('users/O');
  ok(uO.intereses.includes('Chamamé') && uO.foto === '', 'guarda los tipos y la música; la foto de Google se saca (no es de la organización)');
  O.renderPerfilVista(); await sleep(30);
  const pi = txt($O('perfil-intereses'));
  ok(/^Organiza/.test(pi) && /Música/.test(pi) && !/Intereses/.test(pi), 'el perfil muestra "Organiza" y "Música" en vez de "Intereses": ' + pi.slice(0, 80));
  ok(O.bannerHTML({ tipoCuenta: 'organizacion', banner: 'data:image/jpeg;base64,AAAA' }).includes('banner-org') && O.bannerHTML({ tipoCuenta: 'persona', banner: 'data:image/jpeg;base64,AAAA' }) === '', 'el banner solo se muestra en perfiles de organización');

  // ---------- Persona: géneros nuevos, "Otro", foto que sigue al nombre ----------
  const A = abrir({ uid: 'A', email: 'a@t.com' }); await sleep(900); try{ A.cerrarTutorial(); }catch(e){}
  const $A = id => A.document.getElementById(id);
  A.editarPerfil(); await sleep(20);
  ok(['R&B', 'Folklore', 'Tango', '__otro'].every(n => A.document.querySelector(`#ep-intereses [data-interes="${n}"]`)), 'gustos: están R&B, Folklore, Tango y "Otro"');
  ok($A('ep-org').style.display === 'none', 'una persona no tiene banner');
  $A('ep-nombre').value = 'Julián Lovotti'; await A.guardarPerfil(); await sleep(150);
  ok(store.docs.get('users/A').foto === GOOGLE, 'si cambia el nombre pero la inicial es la misma, queda su foto');
  A.editarPerfil(); await sleep(20); $A('ep-nombre').value = 'Pedro Lovotti'; await A.guardarPerfil(); await sleep(150);
  ok(store.docs.get('users/A').foto === '' && store.docs.get('users/A').iniciales === 'PL', 'si cambia la inicial, la foto de Google se va y pasa a la nueva inicial');
  ok(A.afinidad({ categoria: 'rnb' }, ['r&b']).puntos === 2 && A.afinidad({ categoria: 'otro', estiloOtro: 'Jazz' }, ['jazz']).puntos === 2, '"Para vos": R&B y los estilos escritos en "Otro" también cuentan');

  // ---------- Crear: estilo "Otro", preguntas frecuentes, sin duplicar en "Organizando" ----------
  const S = A.eval('state'), D = A.eval('DataService');
  const llenar = n => { $A('f-nombre').value = n; $A('f-lugar').value = 'Belgrano 800, Güemes'; $A('f-fecha').value = fecha; $A('f-hora').value = '23:00'; $A('f-capacidad').value = '40'; };
  A.mostrarVistaPrevia = async () => true;
  A.ir('crear'); A.resetFormularioCrear(); A.elegirTipo('fiesta'); A.elegirOcasion('fiesta'); llenar('Jazz en la terraza');
  ok(['rnb', 'folklore', 'tango', 'otro'].every(v => $A('f-estilo').querySelector(`option[value="${v}"]`)), 'estilo del evento: R&B, Folklore, Tango y "Otro"');
  $A('f-estilo').value = 'otro'; A.actualizarEstiloOtro();
  ok($A('f-estilo-otro').style.display !== 'none', '"Otro" pide escribir cuál');
  await A.publicarEvento(); await sleep(60);
  ok(!evs().length && /estilo de música/.test(txt($A('toast'))), 'con "Otro" vacío no publica y avisa');
  $A('f-estilo-otro').value = 'Jazz';
  const sug = () => [...A.document.querySelectorAll('#faq-sug [data-faq-sug]')].map(b => b.dataset.faqSug);
  ok(sug().includes('¿Hay guardarropa?'), 'preguntas frecuentes: sugiere las típicas de una fiesta');
  A.document.querySelector('#faq-sug [data-faq-sug="¿Hay guardarropa?"]').click();
  A.document.querySelector('#f-faq .faq-fila .faq-r').value = 'Sí, sin cargo.';
  A.agregarFaq(); A.document.querySelectorAll('#f-faq .faq-p')[1].value = '¿Pregunta sin respuesta?';
  ok(!sug().includes('¿Hay guardarropa?'), 'la sugerencia usada desaparece');
  for(let i = 0; i < 5; i++) A.agregarFaq();
  ok(A.document.querySelectorAll('#f-faq .faq-fila').length === 5 && $A('btn-faq-mas').style.display === 'none', 'hasta 5 preguntas');
  // La escucha en vivo trae el evento nuevo antes de que termine de guardarse (lo que pasaba con "Organizando 2")
  const crear = D.crearEvento; D.crearEvento = async function(...a){ const r = await crear.apply(D, a); await sleep(30); return r; };
  const p1 = A.publicarEvento(), p2 = A.publicarEvento(); await p1; await p2; await sleep(250);
  D.crearEvento = crear;
  const e1 = evs().filter(e => e.nombre === 'Jazz en la terraza');
  ok(e1.length === 1, 'tocar "Publicar" dos veces crea un solo evento');
  ok(e1[0] && e1[0].categoria === 'otro' && e1[0].estiloOtro === 'Jazz' && e1[0].musica === 'Jazz', 'se guarda el estilo escrito en "Otro" (Jazz)');
  ok(e1[0] && e1[0].faq.length === 1 && e1[0].faq[0].p === '¿Hay guardarropa?' && e1[0].faq[0].r === 'Sí, sin cargo.', 'se guardan las preguntas con respuesta (las vacías no)');
  ok(S.eventos.filter(e => e.id === e1[0]?.id).length === 1, 'el evento queda una sola vez en la lista');
  A.renderPerfilVista(); await sleep(60);
  ok($A('stat-organizados').textContent === '1', '"Organizando" dice 1 con un solo evento creado (' + $A('stat-organizados').textContent + ')');
  A.abrirDetalle(e1[0].id); await sleep(250);
  const det = txt($A('detalle-contenido'));
  ok(/Jazz/.test(det) && A.document.querySelectorAll('#detalle-contenido .bloque-faq details.faq').length === 1 && /¿Hay guardarropa\?/.test(det), 'el evento muestra "Jazz" y sus preguntas frecuentes');
  A.editarEvento(e1[0]); await sleep(60);
  ok($A('f-estilo').value === 'otro' && $A('f-estilo-otro').value === 'Jazz' && A.document.querySelectorAll('#f-faq .faq-fila').length === 1, 'al editar vuelven el estilo "Otro" y las preguntas');
  A.resetFormularioCrear();
  ok(!A.document.querySelector('#f-faq .faq-fila') && $A('f-estilo-otro').value === '', 'un evento nuevo arranca sin preguntas ni estilo');

  // ---------- Torneo por equipos ----------
  A.ir('crear'); A.resetFormularioCrear(); A.elegirTipo('fiesta'); A.elegirOcasion('deportivo'); llenar('Torneo de fútbol 5');
  const vis = id => $A(id) && $A(id).closest('.campo').style.display !== 'none';
  ok(!vis('fx-porEquipos') && !vis('f-equipos'), 'deporte: "¿por equipos?" no aparece si no es un torneo');
  $A('fx-modalidad').value = 'Torneo / competencia'; $A('fx-modalidad').dispatchEvent(new A.Event('change', { bubbles: true }));
  ok(vis('fx-porEquipos') && !vis('f-equipos'), 'torneo: pregunta si se juega por equipos');
  $A('fx-porEquipos').value = 'Sí'; $A('fx-porEquipos').dispatchEvent(new A.Event('change', { bubbles: true }));
  ok(vis('f-equipos'), 'por equipos: pide los nombres de los equipos');
  $A('f-equipos').value = 'Los Halcones';
  await A.publicarEvento(); await sleep(60);
  ok(!evs().some(e => e.nombre === 'Torneo de fútbol 5') && /al menos 2 equipos/.test(txt($A('toast'))), 'con un solo equipo no publica y avisa');
  $A('fx-modalidad').value = 'Recreativo'; A.actualizarCondicionalesTipo();
  ok(!('porEquipos' in A.leerExtras()) && JSON.stringify(A.leerEquipos()) === '[]', 'si deja de ser torneo, los equipos no se guardan');
  $A('fx-modalidad').value = 'Torneo / competencia'; A.actualizarCondicionalesTipo();
  $A('f-equipos').value = 'Los Halcones\n  La Naranja \n\nlos halcones';
  await A.publicarEvento(); await sleep(250);
  const t = evs().find(e => e.nombre === 'Torneo de fútbol 5');
  ok(t && JSON.stringify(t.equipos) === '["Los Halcones","La Naranja"]' && t.extras.porEquipos === 'Sí', 'se guardan los equipos (sin repetidos ni renglones vacíos)');
  ok(/Equipos \(2\)/.test(A.extrasHTML(t).replace(/<[^>]+>/g, ' ')), 'el evento muestra los equipos');

  // Alguien se anota y elige su equipo
  const B = abrir({ uid: 'B', email: 'b@t.com' }); await sleep(900); try{ B.cerrarTutorial(); }catch(e){}
  const $B = id => B.document.getElementById(id);
  B.abrirDetalle(t.id); await sleep(300);
  $B('btn-accion-detalle').click(); await sleep(80);
  const ops = [...B.document.querySelectorAll('#hoja-contenido [data-equipo-i]')].map(txt);
  ok(/¿En qué equipo jugás\?/.test(txt($B('hoja-contenido'))) && ops.includes('La Naranja') && ops.some(o => /Voy a mirar/.test(o)), 'al anotarse elige su equipo (o "Voy a mirar")');
  B.document.querySelector('#hoja-contenido [data-equipo-i="1"]').click(); await sleep(250);
  const at = store.docs.get(`events/${t.id}/attendees/B`);
  ok(at && at.estado === 'confirmado' && at.equipo === 'La Naranja', 'queda confirmado en "La Naranja"');
  // Quien organiza ve una lista por equipo
  A.abrirDetalle(t.id); await sleep(250); await A.cargarConfirmados(evs().find(e => e.id === t.id), A.eval('state').tok); await sleep(30);
  const tits = [...A.document.querySelectorAll('#lista-confirmados .equipo-tit')].map(txt);
  ok(tits.some(x => /^La Naranja\s*1 persona/.test(x)) && tits.some(x => /^Los Halcones\s*0 personas/.test(x)), 'quien organiza ve cuántos hay en cada equipo: ' + JSON.stringify(tits));

  // ---------- Miniaturas sin foto ----------
  const mini = A.fotoMiniHTML({ id: 'x', ocasion: 'deportivo', imagen: '' });
  ok(/foto-mini-tipo/.test(mini) && /<svg/.test(mini) && !/data:image\/svg/.test(mini), 'sin foto: la miniatura es el ícono del tipo (no la portada recortada)');
  ok(/background-image:url/.test(A.fotoMiniHTML({ id: 'y', imagen: 'https://example.com/a.jpg' })), 'con foto: muestra la foto');
  A.ir('perfil'); A.renderPerfilVista(); await sleep(120);
  ok(A.document.querySelector('#perfil-proximos .foto-mini-tipo .ico-tipo'), 'en "Próximos" del perfil se usa la miniatura nueva');

  console.log(f ? '\nFALLAS: ' + f : '\nTODO OK'); process.exit(f ? 1 : 0);
})();
