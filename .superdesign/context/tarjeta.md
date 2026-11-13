# Tarjeta de evento de Partazy (Inicio y Explorar)

## tarjetaHTML (src/app.js)
```js
function tarjetaHTML(ev, _dist, razon){
  const amigos = amigosVanHTML(ev, false);
  const candado = ev.privacidad==='privada' ? `<div class="candado-badge">${svgLock}</div>` : '';
  return `
   <div class="tarjeta" role="button" tabindex="0" data-abrir="${esc(ev.id)}" aria-label="${esc(ev.nombre)}">
     ${candado}
     <div class="foto"><div class="foto-img" style="background-image:${cssFoto(ev)}"></div></div>
     <div class="info">
       <div class="cat">${iconoTipo(ev)}${esc(etiquetaTipo(ev))}</div>
       <h3>${esc(ev.nombre)}</h3>
       ${lineaMetaHTML(ev)}
       ${amigos || (razon && /^[🎧👥📈]/u.test(razon) ? `<div class="razon-tarjeta">${esc(razon)}</div>` : '')}
     </div>
   </div>`;
}

// Tarjeta de evento horizontal (listas).
function tarjetaHorizontalHTML(ev, razon){
  const amigos = amigosVanHTML(ev, false);
  if(!(razon && /^[🎧👥📈]/u.test(razon)) && afinidad(ev).puntos === 2) razon = `🎧 ${afinidad(ev).motivo}`;   // en Explorar también se ve si va con tu música
  const candado = ev.privacidad==='privada' ? ' 🔒' : '';
  return `
   <div class="tarjeta-h" role="button" tabindex="0" data-abrir="${esc(ev.id)}" aria-label="${esc(ev.nombre)}">
     <div class="foto-h"><div class="foto-img" style="background-image:${cssFoto(ev)}"></div></div>
     <div class="info-h">
       <div class="cat">${iconoTipo(ev)}${esc(etiquetaTipo(ev))}${candado}</div>
       <h4>${esc(ev.nombre)}</h4>
       ${lineaMetaHTML(ev)}
       ${amigos || (razon && /^[🎧👥📈]/u.test(razon) ? `<div class="razon-tarjeta">${esc(razon)}</div>` : '')}
     </div>
   </div>`;
}

```

## lineaMetaHTML
```js
function lineaMetaHTML(ev){
  const dist = distanciaDe(ev);
  const cuando = esCancelado(ev) ? '<span class="cancelado-txt">Cancelado</span>' : `<span>${esc(fechaCorta(ev.fechaTs))}</span>`;
  return `<div class="meta-limpia">${dist ? `<span class="dist">${PIN_MINI}${esc(dist)}</span>` : ''}${cuando}</div>`;
}
const PIN_MINI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z"/><circle cx="12" cy="10" r="2.5"/></svg>';
// Tarjeta de evento (vertical) para las filas del inicio.
function tarjetaHTML(ev, _dist, razon){
  const amigos = amigosVanHTML(ev, false);
  const candado = ev.privacidad==='privada' ? `<div class="candado-badge">${svgLock}</div>` : '';
  return `
   <div class="tarjeta" role="button" tabindex="0" data-abrir="${esc(ev.id)}" aria-label="${esc(ev.nombre)}">
     ${candado}
     <div class="foto"><div class="foto-img" style="background-image:${cssFoto(ev)}"></div></div>
     <div class="info">
       <div class="cat">${iconoTipo(ev)}${esc(etiquetaTipo(ev))}</div>
       <h3>${esc(ev.nombre)}</h3>
       ${lineaMetaHTML(ev)}
       ${amigos || (razon && /^[🎧👥📈]/u.test(razon) ? `<div class="razon-tarjeta">${esc(razon)}</div>` : '')}
     </div>
   </div>`;
}

// Tarjeta de evento horizontal (listas).
function tarjetaHorizontalHTML(ev, razon){
```

## CSS
```css
  .tarjeta{flex:0 0 auto; width:230px; background:var(--negro-2); border:1px solid var(--gris-linea); border-radius:var(--radius-card); overflow:hidden; cursor:pointer; position:relative; box-shadow:var(--sombra); transition:transform var(--t-rapida), box-shadow var(--t-rapida), border-color var(--t-rapida);}
  .tarjeta:active{transform:scale(.97);}
  .tarjeta .foto{aspect-ratio:16/10; position:relative; display:flex; align-items:flex-end; padding:10px; overflow:hidden; background-color:var(--negro-3);}
  .foto-img{position:absolute; inset:0; background-size:cover; background-position:center; transition:transform .45s var(--ease); will-change:transform;}
  .tarjeta .foto::after{content:""; position:absolute; inset:0; background:linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,.75) 100%);}
  .tarjeta .info{padding:12px 13px 14px;}
  .tarjeta .info .cat{font-family:var(--font-mono); font-size:10px; letter-spacing:1.5px; text-transform:uppercase; color:var(--rojo); font-weight:700;}
  .tarjeta .info h3{font-family:var(--font-display); text-transform:uppercase; font-weight:700; font-size:19px; letter-spacing:.3px; margin-top:3px; line-height:1.05;}
  .tarjeta .meta{display:flex; justify-content:space-between; align-items:center; margin-top:9px; font-size:12px; color:var(--gris);}
  .tarjeta .precio{color:var(--hueso); font-weight:700;}
  .candado-badge{position:absolute; top:10px; right:10px; z-index:2; background:rgba(2,7,10,0.75); width:26px;height:26px; border-radius:50%; display:flex;align-items:center;justify-content:center;}
  .tarjeta-h{display:flex; gap:12px; background:var(--negro-2); border:1px solid var(--gris-linea); border-radius:16px; padding:10px; cursor:pointer; box-shadow:var(--sombra); transition:transform var(--t-rapida), box-shadow var(--t-rapida), border-color var(--t-rapida);}
  .tarjeta-h:active{transform:scale(.98);}
  .tarjeta-h .foto-h{width:84px; aspect-ratio:1/1; align-self:flex-start; border-radius:12px; flex:0 0 auto; position:relative; overflow:hidden; background-color:var(--negro-3);}
  .tarjeta-h .info-h{flex:1; min-width:0;}
  .tarjeta-h .cat{font-family:var(--font-mono); font-size:9.5px; letter-spacing:1.2px; color:var(--rojo); font-weight:700; text-transform:uppercase;}
  .tarjeta-h h4{font-family:var(--font-display); text-transform:uppercase; font-weight:700; font-size:17px; margin-top:2px; letter-spacing:.2px;}
  .tarjeta-h .sub{font-size:11.5px; color:var(--gris); margin-top:3px;}
  .tarjeta-h .fila-bottom{display:flex; align-items:center; gap:8px; margin-top:7px;}
  .hero-bottom .cat{font-family:var(--font-mono); font-size:11px; color:var(--rojo); font-weight:700; letter-spacing:1.5px; text-transform:uppercase;}
  .item-simple .foto-mini{width:44px; height:44px; border-radius:10px; background-size:cover; background-position:center; flex:0 0 auto; background-color:var(--negro-3);}
  .foto-perfil-edit{display:flex; flex-direction:column; align-items:center; gap:4px;}
  .foto-perfil-edit .avatar-grande{cursor:pointer; overflow:hidden; margin-bottom:4px;}
  .foto-perfil-edit .ayuda{text-align:center;}
  .campo .ayuda.mal, .foto-perfil-edit .ayuda.mal{color:var(--peligro);}
  .foto-perfil-edit .ayuda.ok{color:var(--verde);}
  .tarjeta-verif{background:var(--negro-2); border:1px solid var(--gris-linea); border-radius:16px; padding:16px; display:flex; flex-direction:column; gap:8px; align-items:flex-start;}
  .tarjeta-verif b{font-size:14.5px;}
  .tarjeta-verif span{font-size:12.5px; color:var(--gris); line-height:1.5;}
  .tarjeta-verif .btn{width:100%;}
  .info-util{margin:0 20px 18px; background:var(--negro-2); border:1px solid var(--gris-linea); border-radius:16px; padding:6px 14px;}
  .info-fila{display:flex; gap:12px; align-items:flex-start; padding:10px 0; font-size:13.5px; border-bottom:1px solid var(--gris-linea);}
  .info-fila:last-child{border-bottom:none;}
  .info-fila > span{font-size:16px; line-height:1.2;}
  .info-fila b{display:block; margin-bottom:2px;}
  .tarjeta .foto .pill-cupo{position:absolute; top:10px; left:10px; z-index:2;}
  .persona .meta-chat{display:flex; flex-direction:column; align-items:flex-end; gap:5px; font-size:10.5px; color:var(--gris); flex:0 0 auto;}
  .msj-evento .foto-mini{width:48px; height:48px; border-radius:9px; background-size:cover; background-position:center; flex:0 0 auto;}
  .bloque,.tarjeta-verif,.ticket{box-shadow:var(--sombra);}
    .tarjeta:hover,.tarjeta-h:hover{transform:translateY(-3px); box-shadow:var(--sombra-alta); border-color:rgba(252,115,77,.45);}
    .tarjeta:hover .foto-img,.tarjeta-h:hover .foto-img{transform:scale(1.07);}
  @media (prefers-reduced-motion: reduce){ *{transition:none !important;} .tarjeta:hover,.tarjeta-h:hover{transform:none;} }
  .screen.entrando .tarjeta-h,.screen.entrando .item-simple,.screen.entrando .bloque,.screen.entrando .campo,.screen.entrando .switch-row{animation:subir .6s var(--ease) both;}
  .screen.entrando :is(.tarjeta-h,.item-simple,.bloque,.campo,.switch-row):nth-child(2){animation-delay:.06s;}
  .screen.entrando :is(.tarjeta-h,.item-simple,.bloque,.campo,.switch-row):nth-child(3){animation-delay:.12s;}
  .screen.entrando :is(.tarjeta-h,.item-simple,.bloque,.campo,.switch-row):nth-child(4){animation-delay:.18s;}
  .screen.entrando :is(.tarjeta-h,.item-simple,.bloque,.campo,.switch-row):nth-child(5){animation-delay:.24s;}
  .screen.entrando :is(.tarjeta-h,.item-simple,.bloque,.campo,.switch-row):nth-child(6){animation-delay:.30s;}
  .screen.entrando :is(.tarjeta-h,.item-simple,.bloque,.campo,.switch-row):nth-child(n+7){animation-delay:.36s;}
  .fila-scroll > .tarjeta{scroll-snap-align:start;}
    .screen:not(.entrando) .fila-scroll > .tarjeta{animation:borde-x linear both; animation-timeline:view(inline); animation-range:cover;}
    .screen:not(.entrando) :is(.tarjeta-h,.bloque,.item-simple){animation:aparecer linear both; animation-timeline:view(); animation-range:entry 0% entry 70%;}
  .tarjeta{transform:perspective(700px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg)); }
  .tarjeta::before{content:""; position:absolute; inset:0; z-index:3; pointer-events:none; border-radius:inherit;
    .tarjeta:hover{transform:perspective(700px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg)) translateY(-4px);}
    .tarjeta:hover::before,.tarjeta-h:hover .foto-h::after{transform:translateX(120%);}
  .tarjeta-h .foto-h::after{content:""; position:absolute; inset:0; pointer-events:none; background:linear-gradient(115deg, transparent 35%, rgba(255,255,255,.14) 48%, transparent 60%); transform:translateX(-120%); transition:transform .8s var(--ease);}
    .tarjeta{transform:none !important;}
  .tarjeta .razon{position:absolute; top:10px; right:10px; z-index:2; background:rgba(2,7,10,.82); backdrop-filter:blur(4px); border:1px solid rgba(252,115,77,.4); color:var(--hueso); font-size:10px; font-weight:700; padding:4px 8px; border-radius:var(--radius-pill); max-width:70%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
    .fila-scroll > .tarjeta{width:250px;}
    .fila-scroll > .tarjeta{width:auto;}
    .screen:not(.entrando) .fila-scroll > .tarjeta{animation:none;}
  .tarjeta .info{padding:12px 14px 14px;}
  .tarjeta .info h3{font-size:20px; margin-top:4px;}
  .tarjeta .cat, .tarjeta-h .cat{display:flex; align-items:center;}
  .meta-limpia{display:flex; align-items:center; gap:10px; margin-top:8px; font-size:12px; color:var(--gris);}
  .meta-limpia .dist{display:inline-flex; align-items:center; gap:4px; color:var(--hueso); font-weight:700;}
  .meta-limpia .dist svg{width:12px; height:12px; color:var(--rojo);}
  .meta-limpia span + span::before{content:"·"; margin-right:10px; color:var(--gris-linea);}
  .meta-limpia .dist + span::before{content:"·"; margin-right:10px; color:#4F5B64;}
  .tarjeta-h h4{margin-top:4px;}
  .tarjeta-h .meta-limpia{margin-top:6px;}
  .entrada-mini .foto-mini{width:58px; height:58px; border-radius:12px; flex-shrink:0; background-size:cover; background-position:center; background-repeat:no-repeat; background-color:var(--negro-3);}
  .hoja .cuerpo .cat{font-family:var(--font-mono); font-size:10.5px; letter-spacing:1.5px; text-transform:uppercase; color:var(--rojo); font-weight:700; display:flex; align-items:center;}
  .hoja .muestra .tarjeta{width:220px; pointer-events:none; animation:none;}
.info-lista{display:flex; flex-direction:column;}
.info-item{display:flex; align-items:flex-start; gap:14px; padding:13px 0; border-bottom:1px solid rgba(31,44,53,.55);}
.info-item:first-child{padding-top:2px;}
.info-item:last-child{border-bottom:none; padding-bottom:4px;}
.info-item .barra-cupo{margin-top:8px; height:6px;}
  .info-lista{display:grid; grid-template-columns:1fr 1fr; column-gap:28px;}
  .info-item:last-child{border-bottom:1px solid rgba(31,44,53,.55);}
  .info-item:nth-last-child(-n+2){border-bottom:none;}
.razon-tarjeta{margin-top:9px; font-size:11.5px; color:var(--hueso); opacity:.85;}
.info-item.insc-cerrada .ii-ico{color:var(--peligro);}
.foto-mini.foto-mini-tipo{display:flex; align-items:center; justify-content:center; color:var(--ac);
.foto-mini-tipo .ico-tipo{width:50%; height:50%; margin:0; vertical-align:0;}
.tarjeta .info .cat{font-size:12px; letter-spacing:1.2px;}
.tarjeta-h .cat{font-size:12px; letter-spacing:1px;}
```
