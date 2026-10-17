// Genera las páginas públicas con dirección propia (partazy.com/privacidad, /terminos, /soporte,
// /eliminar-cuenta y /organizadores) a partir de los textos que ya están en la app.
//
// La fuente de verdad sigue siendo la app:
//   - Privacidad y Términos salen de index.html (#pantalla-privacidad y #pantalla-terminos).
//   - Las preguntas de Soporte salen de AYUDA en js/app.js.
// Si cambiás alguno de esos textos, corré:  npm run paginas
// (la prueba tests/test_paginas.js avisa si las páginas quedaron desactualizadas).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PUB = path.join(__dirname, '..', 'public');
const MAIL = 'partazycontacto@gmail.com';
const ANIO = 2026;

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------- Logo (la P tornasol + "artazy" + el punto verde), fijo, sin animación ----------
const PF = 'M20 13a2 2 0 0 1 2-2h12a14 14 0 0 1 0 28h-4v12a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2z';
const OJO = 'M34 19.5a5.5 5.5 0 1 1 0 11h-4v-11z';
const LOGO = `<span class="lv" role="img" aria-label="PARTAZY">
  <svg class="lv-ico" viewBox="17.5 10.5 31 43" aria-hidden="true"><defs><clipPath id="pp"><path d="${PF} ${OJO}" clip-rule="evenodd"/></clipPath>
  <linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E8B411"/><stop offset=".55" stop-color="#F26A1B"/><stop offset="1" stop-color="#4CB944"/></linearGradient>
  <filter id="pb" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4.5"/></filter></defs>
  <g clip-path="url(#pp)"><rect width="64" height="64" fill="url(#pg)"/><g filter="url(#pb)"><circle cx="24" cy="14" r="11" fill="#4CB944"/><circle cx="24" cy="48" r="11" fill="#E8B411"/><circle cx="44" cy="26" r="9" fill="#F26A1B"/></g></g></svg><span class="lv-txt">artazy</span><svg class="lv-punto" viewBox="0 0 20 20" aria-hidden="true"><defs><clipPath id="pc"><circle cx="10" cy="10" r="10"/></clipPath><filter id="pb2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter></defs><g clip-path="url(#pc)"><rect width="20" height="20" fill="#4CB944"/><g filter="url(#pb2)"><circle cx="15" cy="15" r="6" fill="#F26A1B" opacity=".75"/><circle cx="4" cy="5" r="6" fill="#8BD44A"/></g></g></svg></span>`;

// ---------- Esqueleto común ----------
function pagina({ ruta, titulo, descripcion, cuerpo, scripts = '' }){
  return `<!DOCTYPE html>
<!-- Página generada por herramientas/generar-paginas.js: no la edites a mano, corré "npm run paginas". -->
<html lang="es-AR">
<head>
<meta charset="UTF-8">
<script>(function(){var h=location.hostname;if(h==='partazy.web.app'||h==='partazy.firebaseapp.com'||h==='www.partazy.com'){location.replace('https://partazy.com'+location.pathname+location.search+location.hash);}})();</script>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark only">
<meta name="theme-color" content="#141214">
<title>${esc(titulo)} · PARTAZY</title>
<meta name="description" content="${esc(descripcion)}">
<link rel="canonical" href="https://partazy.com/${ruta}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="PARTAZY">
<meta property="og:title" content="${esc(titulo)} · PARTAZY">
<meta property="og:description" content="${esc(descripcion)}">
<meta property="og:url" content="https://partazy.com/${ruta}">
<meta property="og:image" content="https://partazy.com/og-partazy.png?v=3">
<link rel="icon" href="/favicon.svg?v=3" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icono-180.png?v=3">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Unbounded:wght@800&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/paginas.css">
</head>
<body>
<header class="cab">
  <a class="marca" href="/" aria-label="Ir a Partazy">${LOGO}</a>
  <a class="btn-app" href="/">Abrir la app</a>
</header>
<main class="contenido">
${cuerpo}
</main>
<footer class="pie">
  <nav class="pie-links" aria-label="Páginas de Partazy">
    <a href="/organizadores">Para organizadores</a><a href="/soporte">Soporte</a><a href="/privacidad">Privacidad</a><a href="/terminos">Términos</a><a href="/eliminar-cuenta">Eliminar cuenta</a>
  </nav>
  <div class="pie-redes"><a href="https://www.instagram.com/partazy/" target="_blank" rel="noopener noreferrer">Instagram</a> · <a href="https://www.facebook.com/share/1EkgZmHUXT/" target="_blank" rel="noopener noreferrer">Facebook</a> · <a href="mailto:${MAIL}">${MAIL}</a></div>
  <div>© ${ANIO} PARTAZY · Hecho en Córdoba, Argentina · Solo para mayores de 18 años.</div>
</footer>
${scripts}
</body>
</html>
`;
}

// ---------- Textos que ya están en la app ----------
function textosDeLaApp(){
  const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  const doc = new JSDOM(html).window.document;
  const legal = id => {
    const el = doc.querySelector(`#${id} .texto-legal`).cloneNode(true);
    el.querySelectorAll('[onclick]').forEach(b => b.removeAttribute('onclick'));
    el.querySelectorAll('.mail-contacto').forEach(s => { s.outerHTML = `<a href="mailto:${MAIL}">${MAIL}</a>`; });
    return el.innerHTML.trim();
  };
  const js = fs.readFileSync(path.join(PUB, 'js', 'app.js'), 'utf8');
  const m = js.match(/const AYUDA = (\[[\s\S]*?\n\]);/);
  if(!m) throw new Error('No encontré AYUDA en app.js');
  const ayuda = vm.runInNewContext(m[1]);
  return { privacidad: legal('pantalla-privacidad'), terminos: legal('pantalla-terminos'), ayuda };
}

function generar(){
  const t = textosDeLaApp();
  const P = {};

  P['privacidad.html'] = pagina({
    ruta: 'privacidad', titulo: 'Política de privacidad',
    descripcion: 'Qué datos guarda Partazy, para qué, quién los ve y cómo ejercer tus derechos según la Ley 25.326.',
    cuerpo: `<h1>Política de privacidad</h1>
<div class="legal">${t.privacidad}
<p>Para borrar tu cuenta paso a paso, mirá <a href="/eliminar-cuenta">Eliminar mi cuenta</a>. Las reglas de uso están en los <a href="/terminos">Términos y condiciones</a>.</p></div>`
  });

  P['terminos.html'] = pagina({
    ruta: 'terminos', titulo: 'Términos y condiciones',
    descripcion: 'Términos y condiciones de uso y de intermediación de Partazy.',
    cuerpo: `<h1>Términos y condiciones</h1>\n<div class="legal terminos">${t.terminos}</div>`
  });

  const faq = t.ayuda.map(([grupo, preguntas]) => `<h2>${esc(grupo)}</h2>
${preguntas.map(([q, r]) => `<details class="faq"><summary>${esc(q)}</summary><p>${esc(r)}</p></details>`).join('\n')}`).join('\n');
  P['soporte.html'] = pagina({
    ruta: 'soporte', titulo: 'Ayuda y soporte',
    descripcion: 'Preguntas frecuentes de Partazy y cómo contactarnos si tenés un problema.',
    cuerpo: `<h1>Ayuda y soporte</h1>
<p class="bajada">Si algo no te funciona o tenés una duda, primero fijate en las preguntas de abajo. Si no está, escribinos.</p>
<section class="tarjeta contacto">
  <h2>Cómo contactarnos</h2>
  <p>Escribinos a <a href="mailto:${MAIL}"><b>${MAIL}</b></a> <b>desde el mail de tu cuenta</b>. Contanos qué pasó y, si es sobre un evento, decinos su nombre y la fecha.</p>
  <p>Te respondemos dentro de las <b>48 horas hábiles</b>. También podés escribirnos desde la app, en <b>Perfil → ☰ → Ayuda</b>.</p>
  <p class="nota">¿Querés borrar tu cuenta? Mirá <a href="/eliminar-cuenta">cómo eliminarla</a>.</p>
</section>
<h2 class="titulo-faq">Preguntas frecuentes</h2>
${faq}
<p class="nota">Más información: <a href="/privacidad">Política de privacidad</a> · <a href="/terminos">Términos y condiciones</a>.</p>`
  });

  P['eliminar-cuenta.html'] = pagina({
    ruta: 'eliminar-cuenta', titulo: 'Eliminar mi cuenta',
    descripcion: 'Cómo borrar tu cuenta de Partazy y qué datos se eliminan.',
    cuerpo: `<h1>Eliminar mi cuenta</h1>
<p class="bajada">Podés borrar tu cuenta de Partazy cuando quieras. Es para siempre y no se puede deshacer.</p>
<section class="tarjeta">
  <h2>Desde la app</h2>
  <ol class="pasos">
    <li>Entrá a <a href="/">partazy.com</a> e iniciá sesión.</li>
    <li>Andá a <b>Perfil</b> y tocá el menú <b>☰</b>.</li>
    <li>Tocá <b>Eliminar mi cuenta</b> y escribí <b>ELIMINAR</b> para confirmar.</li>
  </ol>
  <p class="nota">Si organizás eventos con gente confirmada, primero cancelalos: así a todos les llega el aviso.</p>
</section>
<section class="tarjeta">
  <h2>Si no podés entrar</h2>
  <p>Escribinos a <a href="mailto:${MAIL}?subject=${encodeURIComponent('Eliminar mi cuenta')}"><b>${MAIL}</b></a> desde el mail de tu cuenta, con el asunto <b>"Eliminar mi cuenta"</b>. La borramos dentro de los <b>5 días hábiles</b>.</p>
</section>
<h2>Qué se borra</h2>
<ul class="lista">
  <li>Tu perfil, tu @usuario, tu foto, tu email y tu fecha de nacimiento.</li>
  <li>Tus amistades, bloqueos y notificaciones, y lo que compartiste con tus amigos.</li>
  <li>Los eventos que organizaste sin otros confirmados, y tus pedidos de verificación.</li>
</ul>
<h2>Qué puede quedar</h2>
<ul class="lista">
  <li>Tu nombre en la lista de eventos ajenos a los que confirmaste, porque esa lista es de quien organiza.</li>
  <li>Los mensajes que mandaste, en el chat de la otra persona.</li>
  <li>Las denuncias y consultas, el tiempo necesario para resolverlas.</li>
</ul>
<p class="nota">Más detalle en la <a href="/privacidad">Política de privacidad</a>.</p>`
  });

  P['organizadores.html'] = pagina({
    ruta: 'organizadores', titulo: 'Para organizadores',
    descripcion: 'Publicá tus fiestas, recitales, charlas o ferias en Partazy y llegá a la gente de tu zona. Publicar sale cero.',
    cuerpo: `<section class="hero">
  <span class="kicker">Para organizadores</span>
  <h1>Tu evento, donde está la gente.</h1>
  <p class="bajada">Fiestas, recitales, charlas, ferias o partidos: publicalo en Partazy y llegá a la gente de tu zona. <b>Publicar sale cero.</b></p>
  <div class="acciones"><a class="btn btn-primario" href="/#/crear">Publicar mi evento</a><a class="btn btn-secundario" href="#contacto">Quiero que me contacten</a></div>
</section>
<section class="tres">
  <div class="tarjeta"><span class="ico">💸</span><h3>Sin comisiones</h3><p>Partazy no cobra comisiones por tus entradas: la plata va directo a vos, por transferencia o con tu link de venta.</p></div>
  <div class="tarjeta"><span class="ico">⚡</span><h3>En 3 pasos</h3><p>Lo básico, el tipo de evento y los detalles. Cada tipo pide lo suyo: un torneo no pide lo mismo que una charla.</p></div>
  <div class="tarjeta"><span class="ico">🎯</span><h3>Llega a quien le interesa</h3><p>Tu evento aparece en "Para vos" de quien tiene esos gustos, y sus amigos ven que va.</p></div>
</section>
<section class="banda">
  <span class="sello">✓ Verificado</span>
  <div><h2>La gente sabe con quién trata</h2><p>Las organizaciones verificadas llevan el ✓ verde en su perfil y en cada evento. Pedilo gratis desde tu perfil, en Partazy.</p></div>
</section>
<h2>Todo lo que tenés para tu evento</h2>
<ul class="herramientas">
  <li><b>🎟️ Entradas con QR</b> y control en la puerta desde el celular.</li>
  <li><b>📋 Lista de asistentes</b>, lista de espera y fecha límite para anotarse.</li>
  <li><b>⭐ Lista VIP</b> para tus invitados.</li>
  <li><b>🔒 Eventos con invitación:</b> vos aprobás quién entra y la dirección solo la ven los aprobados.</li>
  <li><b>📈 Métricas:</b> cuánta gente vio tu evento y cuántos se anotaron.</li>
  <li><b>💬 Grupo del evento</b> para hablar con los asistentes.</li>
  <li><b>🤝 Publicás para otros:</b> si cobra otra persona, indicás el titular de la cuenta.</li>
</ul>
<section class="tarjeta form-org" id="contacto">
  <h2>¿Querés que te ayudemos a arrancar?</h2>
  <p>Dejanos tus datos y te escribimos para ayudarte a publicar tu primer evento.</p>
  <form id="form-org" novalidate>
    <label>Tu nombre<input id="o-nombre" maxlength="60" autocomplete="name" required></label>
    <label>Mail<input id="o-email" type="email" maxlength="100" autocomplete="email" required></label>
    <label>Organización o evento<input id="o-org" maxlength="80" placeholder="Ej: Productora Luna, Bar El Patio"></label>
    <div class="fila">
      <label>¿Qué organizás?<select id="o-tipo"><option>Fiestas o boliche</option><option>Recitales o música en vivo</option><option>Charlas, talleres o cursos</option><option>Ferias o gastronomía</option><option>Deportes</option><option>Otro</option></select></label>
      <label>Ciudad<input id="o-ciudad" maxlength="60" placeholder="Ej: Córdoba"></label>
    </div>
    <label>WhatsApp (opcional)<input id="o-wa" maxlength="30" inputmode="tel"></label>
    <label>Contanos algo más (opcional)<textarea id="o-msg" maxlength="500" rows="3"></textarea></label>
    <button class="btn btn-primario" type="submit" id="o-enviar">Quiero que me contacten</button>
    <p class="estado" id="o-estado" role="status" aria-live="polite"></p>
  </form>
</section>
<h2>Preguntas de organizadores</h2>
<details class="faq"><summary>¿Cuesta algo publicar?</summary><p>No. Publicar eventos en Partazy es gratis y no cobramos comisiones por las entradas.</p></details>
<details class="faq"><summary>¿Cómo cobro las entradas?</summary><p>Directo a vos: indicás cómo se paga (por ejemplo, transferencia a tu alias) o ponés tu link de venta de otra plataforma. La gente ve un botón para copiar el alias.</p></details>
<details class="faq"><summary>¿Puedo publicar el evento de otra persona?</summary><p>Sí. Al cargar el pago elegís "Otra persona" y ponés el titular de la cuenta, así los asistentes saben a quién le pagan.</p></details>
<details class="faq"><summary>¿Qué necesito para el ✓ de verificado?</summary><p>Tener una cuenta de organización y pedir la verificación desde tu perfil. La revisa el equipo de Partazy.</p></details>`,
    scripts: `<script src="https://cdn.jsdelivr.net/npm/firebase@10.12.0/firebase-app-compat.js"></script>
<script src="https://cdn.jsdelivr.net/npm/firebase@10.12.0/firebase-firestore-compat.js"></script>
<script src="https://cdn.jsdelivr.net/npm/firebase@10.12.0/firebase-app-check-compat.js"></script>
<script src="/js/organizadores.js"></script>`
  });
  // Página de prelanzamiento: "Próximamente", sin ninguna fecha (como certifix.com.ar).
  const letras = [...'artazy'].map((c, i) => `<i style="--i:${i}">${c}</i>`).join('');
  const logoAnimado = LOGO.replace('class="lv"', 'class="lv lv-grande lv-anim"').replace('<span class="lv-txt">artazy</span>', `<span class="lv-txt">${letras}</span>`)
    .replace('<circle cx="24" cy="14" r="11" fill="#4CB944"/><circle cx="24" cy="48" r="11" fill="#E8B411"/><circle cx="44" cy="26" r="9" fill="#F26A1B"/>',
             '<circle class="b1" cx="24" cy="14" r="11" fill="#4CB944"/><circle class="b2" cx="24" cy="48" r="11" fill="#E8B411"/><circle class="b3" cx="44" cy="26" r="9" fill="#F26A1B"/>')
    .replace(/id="(p[pgbc]2?)"/g, 'id="g$1"').replace(/url\(#(p[pgbc]2?)\)/g, 'url(#g$1)');
  P['lanzamiento.html'] = pagina({
    ruta: 'lanzamiento', titulo: 'Próximamente',
    descripcion: 'Todo lo que pasa cerca tuyo, en un solo lugar. Sumate antes del lanzamiento y quedás como Fundador.',
    cuerpo: `<section class="lanz">
  <span class="kicker">Próximamente</span>
  <div class="lanz-logo">${logoAnimado}</div>
  <h1>Todo lo que pasa cerca tuyo, <em>en un solo lugar.</em></h1>
  <p class="bajada">Fiestas, previas, recitales, charlas, ferias y partidos. Mirá a dónde van tus amigos, anotate en un toque y armá tus propios eventos.</p>
</section>
<section class="tarjeta fundador">
  <span class="tag-fundador">✦ Fundador</span>
  <h2>Sumate antes que nadie</h2>
  <p>Los que se registren antes del lanzamiento oficial llevan la insignia <b>✦ Fundador</b> en su perfil. Para siempre.</p>
  <div class="acciones"><a class="btn btn-primario" href="/">Crear mi cuenta gratis</a><a class="btn btn-secundario" href="/">Ya tengo cuenta</a></div>
</section>
<section class="tres">
  <div class="tarjeta"><span class="ico">🎧</span><h3>Para vos</h3><p>Elegís tus gustos una vez y te mostramos los planes que van con vos.</p></div>
  <div class="tarjeta"><span class="ico">👥</span><h3>Tus amigos</h3><p>Ves quién va, quién está en un evento ahora y quién es el host. Sin preguntar en el grupo.</p></div>
  <div class="tarjeta"><span class="ico">🔒</span><h3>Con invitación</h3><p>En los eventos privados, la dirección la ven solo los invitados.</p></div>
</section>
<section class="banda">
  <span class="sello">🎪 Organizadores</span>
  <div><h2>¿Organizás eventos?</h2><p>Sumate ahora y llegá al lanzamiento con tu evento publicado. <a href="/organizadores">Ver cómo funciona →</a></p></div>
</section>
<p class="nota centro">Seguinos para enterarte primero: <a href="https://www.instagram.com/partazy/" target="_blank" rel="noopener noreferrer">Instagram</a> · <a href="https://www.facebook.com/share/1EkgZmHUXT/" target="_blank" rel="noopener noreferrer">Facebook</a></p>`

  });
  return P;
}

if(require.main === module){
  const P = generar();
  for(const [nombre, html] of Object.entries(P)){
    fs.writeFileSync(path.join(PUB, nombre), html);
    console.log('✔ public/' + nombre);
  }
}
module.exports = { generar };
