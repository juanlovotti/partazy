// Genera las páginas públicas con dirección propia (partazy.com/privacidad, /terminos, /soporte,
// /eliminar-cuenta y /organizadores) a partir de los textos que ya están en la app.
//
// La fuente de verdad sigue siendo la app:
//   - Privacidad y Términos salen de index.html, en la raíz del proyecto (#pantalla-privacidad y #pantalla-terminos).
//   - Las preguntas de Soporte salen de AYUDA en src/app.js.
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
const LOGO = `<span class="lv" role="img" aria-label="Partazy">
  <svg class="lv-ico" viewBox="17.5 10.5 31 43" aria-hidden="true"><defs><clipPath id="pp"><path d="${PF} ${OJO}" clip-rule="evenodd"/></clipPath>
  <linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFA98C"/><stop offset=".55" stop-color="#FC734D"/><stop offset="1" stop-color="#0297DE"/></linearGradient>
  <filter id="pb" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4.5"/></filter></defs>
  <g clip-path="url(#pp)"><rect width="64" height="64" fill="url(#pg)"/><g filter="url(#pb)"><circle cx="24" cy="14" r="11" fill="#0297DE"/><circle cx="24" cy="48" r="11" fill="#FFA98C"/><circle cx="44" cy="26" r="9" fill="#FC734D"/></g></g></svg><span class="lv-txt">artazy</span><svg class="lv-punto" viewBox="0 0 20 20" aria-hidden="true"><defs><clipPath id="pc"><circle cx="10" cy="10" r="10"/></clipPath><filter id="pb2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter></defs><g clip-path="url(#pc)"><rect width="20" height="20" fill="#0297DE"/><g filter="url(#pb2)"><circle cx="15" cy="15" r="6" fill="#FC734D" opacity=".75"/><circle cx="4" cy="5" r="6" fill="#6CCBF5"/></g></g></svg></span>`;

// ---------- Esqueleto común ----------
function pagina({ ruta, titulo, descripcion, cuerpo, scripts = '', clase = '', imagen = 'https://partazy.com/og-partazy.png?v=4' }){
  return `<!DOCTYPE html>
<!-- Página generada por herramientas/generar-paginas.js: no la edites a mano, corré "npm run paginas". -->
<html lang="es-AR">
<head>
<meta charset="UTF-8">
<script>(function(){var h=location.hostname;if(h==='partazy.web.app'||h==='partazy.firebaseapp.com'||h==='www.partazy.com'){location.replace('https://partazy.com'+location.pathname+location.search+location.hash);}})();</script>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark only">
<meta name="theme-color" content="#02070A">
<title>${esc(titulo)} | Partazy</title>
<meta name="description" content="${esc(descripcion)}">
<link rel="canonical" href="https://partazy.com/${ruta}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Partazy">
<meta property="og:title" content="${esc(titulo)} | Partazy">
<meta property="og:description" content="${esc(descripcion)}">
<meta property="og:url" content="https://partazy.com/${ruta}">
<meta property="og:image" content="${imagen}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg?v=4" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icono-180.png?v=4">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Unbounded:wght@800&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/paginas.css">
</head>
<body${clase ? ` class="${clase}"` : ''}>
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
  <div class="pie-redes"><a href="https://www.instagram.com/partazy/" target="_blank" rel="noopener noreferrer">Instagram</a><a href="https://www.facebook.com/share/1EkgZmHUXT/" target="_blank" rel="noopener noreferrer">Facebook</a><a href="mailto:${MAIL}">${MAIL}</a></div>
  <div>© ${ANIO} Partazy. Hecho en Córdoba, Argentina. Solo para mayores de 18 años.</div>
</footer>
${scripts}
</body>
</html>
`;
}

// ---------- Textos que ya están en la app ----------
function textosDeLaApp(){
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');   // la página de la app (Vite la toma de la raíz)
  const doc = new JSDOM(html).window.document;
  const legal = id => {
    const el = doc.querySelector(`#${id} .texto-legal`).cloneNode(true);
    el.querySelectorAll('[onclick]').forEach(b => b.removeAttribute('onclick'));
    el.querySelectorAll('.mail-contacto').forEach(s => { s.outerHTML = `<a href="mailto:${MAIL}">${MAIL}</a>`; });
    return el.innerHTML.trim();
  };
  const js = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');
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
  <div class="tarjeta"><span class="ico"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg></span><h3>Sin comisiones</h3><p>Partazy no cobra comisiones por tus entradas: la plata va directo a vos, por transferencia o con tu link de venta.</p></div>
  <div class="tarjeta"><span class="ico"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 3 14h9l-1 8 10-12h-9z"/></svg></span><h3>En 3 pasos</h3><p>Lo básico, el tipo de evento y los detalles. Cada tipo pide lo suyo: un torneo no pide lo mismo que una charla.</p></div>
  <div class="tarjeta"><span class="ico"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></span><h3>Llega a quien le interesa</h3><p>Partazy le muestra tu evento a la gente de tu zona a la que le gustan ese tipo de planes.</p></div>
</section>
<section class="banda">
  <span class="sello">✓ Verificado</span>
  <div><h2>La gente sabe con quién trata</h2><p>Las organizaciones verificadas llevan el ✓ verde en su perfil y en cada evento. Pedilo gratis desde tu perfil, en Partazy.</p></div>
</section>
<h2>Todo lo que tenés para tu evento</h2>
<ul class="herramientas">
  <li><b>Entradas con QR</b> y control en la puerta desde el celular.</li>
  <li><b>Lista de asistentes</b>, lista de espera y fecha límite para anotarse.</li>
  <li><b>Lista VIP</b> para tus invitados.</li>
  <li><b>Eventos con invitación:</b> vos aprobás quién entra y la dirección solo la ven los aprobados.</li>
  <li><b>Métricas:</b> cuánta gente vio tu evento y cuántos se anotaron.</li>
  <li><b>Grupo del evento</b> para hablar con los asistentes.</li>
  <li><b>Publicás para otros:</b> si cobra otra persona, indicás el titular de la cuenta.</li>
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
  // Página de prelanzamiento: "Lanzamiento oficial muy pronto", sin ninguna fecha (como certifix.com.ar).
  // El titular y "Crear mi cuenta" se ven de entrada; lo único que se anima al cargar es la ciudad.
  const letras = [...'artazy'].map((c, i) => `<i style="--i:${i}">${c}</i>`).join('');
  const logoAnimado = LOGO.replace('class="lv"', 'class="lv lv-grande lv-anim"').replace('<span class="lv-txt">artazy</span>', `<span class="lv-txt">${letras}</span>`)
    .replace('<circle cx="24" cy="14" r="11" fill="#0297DE"/><circle cx="24" cy="48" r="11" fill="#FFA98C"/><circle cx="44" cy="26" r="9" fill="#FC734D"/>',
             '<circle class="b1" cx="24" cy="14" r="11" fill="#0297DE"/><circle class="b2" cx="24" cy="48" r="11" fill="#FFA98C"/><circle class="b3" cx="44" cy="26" r="9" fill="#FC734D"/>')
    .replace(/id="(p[pgbc]2?)"/g, 'id="g$1"').replace(/url\(#(p[pgbc]2?)\)/g, 'url(#g$1)');
  // QR de muestra (no es un código real), siempre igual
  const qrFalso = () => { let sem = 7; const r = () => (sem = (sem * 16807) % 2147483647) / 2147483647; const n = 21; let cel = '';
    const esq = (i, j) => (i < 8 && j < 8) || (i > 12 && j < 8) || (i < 8 && j > 12);
    for(let i = 0; i < n; i++) for(let j = 0; j < n; j++) if(!esq(i, j) && r() < .5) cel += `<rect x="${i}" y="${j}" width="1" height="1"/>`;
    for(const [x, y] of [[0, 0], [14, 0], [0, 14]]) cel += `<path d="M${x} ${y}h7v7h-7zM${x + 1} ${y + 1}v5h5v-5z" fill-rule="evenodd"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`;
    return `<svg class="lz-qr" viewBox="-1 -1 23 23" aria-hidden="true"><rect x="-1" y="-1" width="23" height="23" fill="#fff" rx="1.5"/><g fill="#02070A">${cel}</g></svg>`; };
  const evento = `<div class="lz-ev"><span class="lz-ev-tapa" style="background:linear-gradient(135deg,#0297DE,#7A8BE0)"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/></svg></span><span class="lz-ev-txt"><b>Noche Vortex</b><small>Hoy, 23:30<br>Güemes</small></span></div>`;
  const av = (l, c, i = 0) => `<i style="background:${c};--i:${i}">${l}</i>`;
  const PANT = {
    1: `<div class="lz-pant" aria-hidden="true">
        <div class="lz-busca"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/></svg>¿Qué querés hacer hoy?</div>
        <div class="lz-mapa">
          <svg viewBox="0 0 340 400" preserveAspectRatio="none" aria-hidden="true"><rect width="340" height="400" fill="#0C1720"/>
            <path d="M-10 268C70 238 150 300 230 270S330 246 360 256V300C300 292 250 318 220 314S90 282-10 312Z" fill="#0D2A3F"/>
            <rect x="214" y="46" width="88" height="62" rx="10" fill="#0F2430"/>
            <g stroke="#172936" stroke-width="9" stroke-linecap="round"><path d="M-10 92H350M-10 184H350M-10 362H350M64-10V410M170-10V410M276-10V410"/></g>
            <g stroke="#13222D" stroke-width="4"><path d="M-10 138H350M-10 230H350M117-10V410M223-10V410"/></g>
            <path d="M20 410 300-10" stroke="#1D3343" stroke-width="12" stroke-linecap="round"/></svg>
          <span class="lz-vos" style="--x:52%;--y:63%"></span>
          <span class="lz-pin" style="--x:25%;--y:20%;--i:0">Fiesta</span>
          <span class="lz-pin a" style="--x:72%;--y:15%;--i:1">Peña</span>
          <span class="lz-pin" style="--x:28%;--y:49%;--i:2">Recital</span>
          <span class="lz-pin a" style="--x:73%;--y:43%;--i:3">Fútbol 5</span>
          <span class="lz-pin" style="--x:27%;--y:83%;--i:4">Taller</span>
          <span class="lz-pin a" style="--x:73%;--y:80%;--i:5">Feria</span>
        </div>
      </div>`,
    2: `<div class="lz-pant" aria-hidden="true">${evento}
        <p class="lz-eti">Van 3 amigos</p>
        <ul class="lz-amigos">
          <li style="--i:0">${av('S', '#0297DE')}<b>Sofi</b><span class="lz-va">✓ va</span></li>
          <li style="--i:1">${av('I', '#FC734D')}<b>Ivo</b><span class="lz-va">✓ va</span></li>
          <li style="--i:2">${av('M', '#7A8BE0')}<b>Male</b><span class="lz-va">✓ va</span></li>
        </ul>
      </div>`,
    3: `<div class="lz-pant" aria-hidden="true">${evento}
        <div class="lz-avs-fila"><span class="lz-avs">${av('S', '#0297DE')}${av('I', '#FC734D')}${av('M', '#7A8BE0')}</span><span class="lz-quien">Sofi, Ivo, Male <span>y 38 más</span> van</span></div>
        <div class="lz-boton"><span class="a">Me sumo</span><span class="b">✓ Vas</span></div>
        <p class="lz-aviso">Listo, vas a Noche Vortex</p>
      </div>`,
    4: `<div class="lz-ticket" aria-hidden="true">
        <div class="lz-ticket-izq"><small>Tu entrada</small><b>Noche Vortex</b><span>Hoy 23:30 en Güemes</span><em>Lu Ferreyra</em></div>
        <div class="lz-ticket-der">${qrFalso()}</div>
        <span class="lz-sello">✓</span>
      </div>`,
    5: `<div class="lz-pant lz-pant-ahora" aria-hidden="true">
        <div class="lz-ahora"><span class="lz-vivo"></span>Ahora en <b>Noche Vortex</b></div>
        <div class="lz-grupo">${av('S', '#0297DE', 0)}${av('I', '#FC734D', 1)}${av('M', '#7A8BE0', 2)}<i class="yo" style="--i:3">Vos</i></div>
        <p class="lz-grupo-txt">Sofi, Ivo, Male y vos<br><span>están acá</span></p>
        <span class="lz-papel" aria-hidden="true">${Array.from({ length: 16 }, (_, k) => { const a = k / 16 * Math.PI * 2 + (k % 3) * .2, d = 95 + (k % 4) * 22; return `<i style="--dx:${Math.round(Math.cos(a) * d)}px;--dy:${Math.round(Math.sin(a) * d * .8 - 30)}px;--r:${(k * 47) % 360}deg;--c:${['#0297DE', '#FC734D', '#FFA98C', '#EDF1F4'][k % 4]}"></i>`; }).join('')}</span>
      </div>`
  };
  const paso = (n, titulo, texto) => `<li class="lz-paso lz-rev">
      <div class="lz-vis">${PANT[n]}</div>
      <div class="lz-paso-txt"><span class="lz-num${n % 2 ? ' n' : ''}" aria-hidden="true">${n}</span><h3>${titulo}</h3><p>${texto}</p></div>
    </li>`;
  const chip = (plan, txt) => `<button type="button" class="lz-chip" data-plan="${plan}" aria-pressed="false">${txt}</button>`;
  P['lanzamiento.html'] = pagina({
    ruta: 'lanzamiento', titulo: 'Lanzamiento oficial muy pronto', clase: 'p-lanz', imagen: 'https://partazy.com/img/og-lanzamiento.jpg?v=1',
    descripcion: 'Todo lo que pasa cerca tuyo, en un solo lugar. Sumate antes del lanzamiento y quedás como Fundador.',
    cuerpo: `<script>document.documentElement.classList.add('js');</script>
<div class="lz-fondo" aria-hidden="true"><i class="f1"></i><i class="f2"></i><i class="f3"></i></div>
<section class="lz-hero">
  <div class="lz-hero-txt">
    <span class="lz-pill"><span class="lz-punto" aria-hidden="true"></span>Lanzamiento oficial muy pronto</span>
    <div class="lz-logo">${logoAnimado}</div>
    <h1>Todo lo que pasa cerca tuyo, <span class="lz-gris">en un solo lugar.</span></h1>
    <p class="lz-sub">Fiestas, peñas, recitales, torneos, talleres y ferias. Mirá a dónde van tus amigos y sumate en un toque.</p>
    <div class="lz-acciones"><a class="lz-btn lz-btn-pri" href="/">Crear mi cuenta</a><button type="button" class="lz-btn lz-btn-sec" id="lz-compartir">Pasáselo a un amigo</button></div>
  </div>
  <figure class="lz-ciudad lz-in" style="--d:0">
    <video autoplay muted loop playsinline preload="metadata" poster="/media/ciudad.jpg" width="720" height="900" aria-label="Una ciudad de noche con carteles de fiestas, peñas, recitales, torneos, talleres y ferias">
      <source src="/media/ciudad.mp4?v=1" type="video/mp4">
    </video>
  </figure>
</section>
<section class="lz-problema lz-rev">
  <div class="lz-problema-txt">
    <span class="lz-kicker">Sábado, 22:47</span>
    <h2 class="lz-h lz-una">¿Qué hacemos <span>hoy?</span></h2>
    <p>Cerca tuyo están pasando mil cosas y casi siempre te enterás tarde. Partazy te las muestra todas juntas, con tus amigos adentro.</p>
  </div>
  <div class="lz-chat" aria-hidden="true">
    <div class="lz-chat-cab"><span class="lz-chat-av"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></svg></span><span class="lz-chat-nom"><b>Los del sábado</b><small>Agus, Cami, Ivo, Sofi y vos</small></span></div>
    <div class="lz-chat-cuerpo">
      <div class="lz-msj" style="--i:0"><small style="color:#6CCBF5">Agus</small><span>¿qué hacemos hoy?</span><time>22:41</time></div>
      <div class="lz-msj" style="--i:1"><small style="color:#FFA98C">Cami</small><span>ni idea</span><time>22:43</time></div>
      <div class="lz-msj" style="--i:2"><small style="color:#B9B3FF">Ivo</small><span>¿alguien sabe de algo?</span><time>22:45</time></div>
      <div class="lz-msj yo" style="--i:3"><span>yo tampoco</span><time>22:47</time></div>
      <div class="lz-escribe" style="--i:4"><i></i><i></i><i></i></div>
    </div>
  </div>
</section>
<section class="lz-pasos">
  <h2 class="lz-h lz-rev">Cinco pasos, <span>una&nbsp;noche.</span></h2>
  <ol>
    ${paso(1, 'Mirás', 'Todo lo que pasa cerca tuyo en un mapa: fiestas, peñas, recitales, torneos, talleres y ferias.')}
    ${paso(2, 'Ves quién&nbsp;va', 'Antes de decidir, ves a dónde van tus amigos.')}
    ${paso(3, 'Te sumás', 'Un toque y estás anotado. Sin preguntar en el grupo.')}
    ${paso(4, 'Tu entrada, en el&nbsp;celu', 'Te queda la entrada con QR. La mostrás en la puerta y pasás.')}
    ${paso(5, 'Llegás con tu&nbsp;gente', 'Y la noche arranca donde tenía que arrancar.')}
  </ol>
</section>
<section class="lz-demo lz-rev">
  <h2 class="lz-h">¿Qué hacés <span>este&nbsp;sábado?</span></h2>
  <p class="lz-bajada">Tocá un plan y mirá cómo se vería en Partazy.</p>
  <div class="lz-chips" role="group" aria-label="Planes">
    ${chip('fiesta', 'Fiesta')}${chip('pena', 'Peña')}${chip('recital', 'Recital')}${chip('futbol', 'Fútbol 5')}${chip('taller', 'Taller')}${chip('feria', 'Feria')}
  </div>
  <div class="lz-cartas" id="lz-cartas" aria-live="polite"></div>
  <p class="lz-nota">Son eventos de ejemplo, para que te des una idea.</p>
</section>
<section class="fundador lz-fund lz-rev">
  <div class="lz-emblema" aria-hidden="true"><span class="lz-emb-brillo"></span><span class="lz-emb-centro"><b>✦</b><small>Fundador</small></span></div>
  <div class="lz-fund-txt">
    <div class="lz-perfil" aria-hidden="true">
      <span class="lz-av">SG</span>
      <span class="lz-perfil-txt"><b>Sofi Gómez</b><small>@sofi.g en Córdoba</small></span>
      <span class="tag-fundador">✦ Fundador</span>
    </div>
    <h2 class="lz-h">Quedá&nbsp;como <span>Fundador.</span></h2>
    <p>Quienes se registran antes del lanzamiento oficial llevan la insignia <b>✦ Fundador</b> en su perfil. Para siempre.</p>
    <a class="lz-btn lz-btn-pri" href="/">Crear mi cuenta</a>
  </div>
</section>
<section class="lz-bloque lz-rev">
  <a class="lz-fila" href="/organizadores"><span><b>¿Organizás eventos?</b><small>Llegá al lanzamiento con tu evento ya publicado.</small></span><span class="lz-flecha" aria-hidden="true">→</span></a>
  <p class="lz-redes">Enterate primero en <a href="https://www.instagram.com/partazy/" target="_blank" rel="noopener noreferrer">Instagram</a> y <a href="https://www.facebook.com/share/1EkgZmHUXT/" target="_blank" rel="noopener noreferrer">Facebook</a>.</p>
</section>
<div class="lz-toasts" aria-live="polite"></div>`,
    scripts: `<script src="/js/lanzamiento.js?v=4" defer></script>`
  });
  return P;
}

if(require.main === module){
  const P = generar();
  for(const [nombre, html] of Object.entries(P)){
    fs.writeFileSync(path.join(PUB, nombre), html);
    console.log('public/' + nombre);
  }
}
module.exports = { generar };
