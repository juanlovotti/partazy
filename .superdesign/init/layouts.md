# Layouts — Partazy

- Contenedor: `.phone` (max-width 420px en celular, ocupa 100dvh). Cada pantalla es `<div class="screen" id="pantalla-X">` y scrollea adentro con padding-bottom 92px para la barra de abajo.
- En compu (≥900px) la barra de abajo pasa a ser una barra lateral izquierda de 256px con el logo arriba y "Crear evento" como botón naranja.

## Encabezado de la pantalla Crear (index.html 293-309)
```html
  <div class="screen" id="pantalla-crear">
    <div class="topbar">
      <div class="logo" style="font-size:24px;" id="crear-titulo">Crear</div>
      <div class="icon-btn" onclick="cerrarCrear()" aria-label="Cerrar">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </div>
    </div>
    <div class="crear-cab">
      <div class="pasos-barra" id="pasos-barra" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="resumen-pasos" id="resumen-pasos"></div>
      <p style="font-size:12.5px; color:var(--gris);" id="crear-intro">Fiestas, previas, recitales, charlas, ferias, talleres, partidos… cualquier evento donde vaya gente.</p>
    </div>
    <div class="toggle-tipo" id="crear-tipo" hidden style="display:none;">
      <div class="op activo" id="op-fiesta" onclick="elegirTipo('fiesta')">Evento</div>
      <div class="op" id="op-previa" onclick="elegirTipo('previa')">Previa</div>
    </div>
    <div class="form form-pasos" id="form-crear">
```

## Barra de navegación (index.html 990-1033)
```html
  <nav class="navbar" aria-label="Navegación principal">
    <div class="nav-marca solo-escritorio" role="button" tabindex="0" onclick="ir('home')" aria-label="Partazy, Inicio"><span class="lv lv-nav"><svg class="lv-ico" viewBox="17.5 10.5 31 43" aria-hidden="true"><g clip-path="url(#ptz-p)"><rect width="64" height="64" fill="url(#ptz-base)"/><g filter="url(#ptz-blur)"><circle class="lv-b b1" cx="24" cy="14" r="11" fill="#0297DE"/><circle class="lv-b b2" cx="24" cy="48" r="11" fill="#FFA98C"/><circle class="lv-b b3" cx="44" cy="26" r="9" fill="#FC734D"/></g></g></svg><span class="lv-txt notranslate" translate="no"><i style="--i:0">a</i><i style="--i:1">r</i><i style="--i:2">t</i><i style="--i:3">a</i><i style="--i:4">z</i><i style="--i:5">y</i></span><svg class="lv-punto" viewBox="0 0 20 20" aria-hidden="true"><g clip-path="url(#ptz-c)"><rect width="20" height="20" fill="#0297DE"/><g filter="url(#ptz-blur2)"><circle class="lv-q q1" cx="15" cy="15" r="6" fill="#FC734D" opacity=".75"/><circle class="lv-q q2" cx="4" cy="5" r="6" fill="#6CCBF5"/><circle cx="12" cy="4" r="4" fill="#FFA98C" opacity=".6"/></g></g></svg></span></div>
    <button class="nav-toggle solo-escritorio" id="nav-toggle" onclick="alternarNav()" aria-label="Achicar el menú" title="Achicar el menú"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>
    <button class="nav-item activo" data-nav="home" onclick="ir('home')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/></svg>
      Inicio
    </button>
    <button class="nav-item" data-nav="explorar" onclick="ir('explorar')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      Explorar
    </button>
    <button class="nav-item crear" data-nav="crear" onclick="ir('crear')">
      <div class="circulo">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
      </div>
      <span class="txt-crear">Crear</span>
    </button>
    <button class="nav-item" data-nav="chats" onclick="abrirChats()">
      <span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/></svg><span class="badge" id="badge-chats"></span></span>
      Chats
    </button>
    <button class="nav-item solo-escritorio" data-nav-esc="notificaciones" onclick="abrirNotificaciones()">
      <span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg><span class="badge" id="badge-notif-side"></span></span>
      Notificaciones
    </button>
    <button class="nav-item solo-escritorio" data-nav-esc="amigos" onclick="abrirAmigos()">
      <span class="nav-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/></svg><span class="badge" id="badge-amigos-side"></span></span>
      Amigos
    </button>
    <button class="nav-item solo-escritorio" data-nav-esc="ticket" onclick="irAMisEntradas()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"/><path d="M13 6v12" stroke-dasharray="2 2"/></svg>
      Mis entradas
    </button>
    <button class="nav-item" data-nav="perfil" onclick="ir('perfil')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 21a8 8 0 1 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>
      Perfil
    </button>
    <div class="nav-pie solo-escritorio">
      <div class="pie-redes"><a class="pie-ig" href="https://www.instagram.com/partazy/" target="_blank" rel="noopener noreferrer" aria-label="Partazy en Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg><span class="notranslate" translate="no">@partazy</span></a><a class="pie-ig pie-fb" href="https://www.facebook.com/share/1EkgZmHUXT/" target="_blank" rel="noopener noreferrer" aria-label="Partazy en Facebook"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H7.9v3h2.6V21z"/></svg><span>Facebook</span></a></div>
      <div class="links"><button onclick="abrirTutorial()">Tutorial</button><button onclick="abrirAyuda()">Ayuda</button><button onclick="abrirTerminos()">Términos</button><a href="/organizadores">Organizadores</a><button onclick="abrirPrivacidad()">Privacidad</button></div>
      <div class="idiomas notranslate" translate="no" role="group" aria-label="Idioma"><button data-idioma="es">ES</button><button data-idioma="en">EN</button><button data-idioma="pt">PT</button></div>
      <div>© <span class="anio-actual">2026</span> Partazy. Todos los derechos reservados</div>
    </div>
  </nav>
```
CSS de `.navbar`/`.nav-item`: ver components.md.
