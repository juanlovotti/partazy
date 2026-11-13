// /lanzamiento: animaciones suaves, la demo "¿Qué hacés este sábado?" y el botón para compartir.
(function(){
  var raiz = document.documentElement;
  var quieto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Avisos tipo toast
  var caja = document.querySelector('.lz-toasts');
  function toast(msj){
    if(!caja) return;
    var el = document.createElement('div'); el.className = 'lz-toast'; el.textContent = msj; caja.appendChild(el);
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ el.classList.add('on'); }); });
    setTimeout(function(){ el.classList.remove('on'); el.classList.add('off'); setTimeout(function(){ el.remove(); }, 400); }, 2600);
  }

  // Compartir
  var url = 'https://partazy.com/lanzamiento';
  var btnComp = document.getElementById('lz-compartir');
  if(btnComp) btnComp.addEventListener('click', function(){
    var datos = { title: 'Partazy', text: 'Todo lo que pasa cerca tuyo, en un solo lugar. Sumate antes del lanzamiento:', url: url };
    if(navigator.share){ navigator.share(datos).catch(function(){}); return; }
    if(navigator.clipboard){ navigator.clipboard.writeText(url).then(function(){ toast('Link copiado. Pasáselo a quien quieras.'); }, function(){ toast(url); }); }
    else toast(url);
  });

  // El título entra palabra por palabra, como en los videos
  var titulo = document.querySelector('[data-palabras]');
  if(titulo && !quieto){
    var n = 0;
    (function partir(nodo){
      Array.prototype.slice.call(nodo.childNodes).forEach(function(h){
        if(h.nodeType === 3){
          var frag = document.createDocumentFragment();
          h.textContent.split(/(\s+)/).forEach(function(w){
            if(!w) return;
            if(/^\s+$/.test(w)){ frag.appendChild(document.createTextNode(w)); return; }
            var s = document.createElement('span'); s.className = 'lz-w'; s.style.setProperty('--n', n++); s.textContent = w; frag.appendChild(s);
          });
          nodo.replaceChild(frag, h);
        } else if(h.nodeType === 1) partir(h);
      });
    })(titulo);
    titulo.classList.add('lz-partido');
  }

  // Lo que entra al hacer scroll
  var revelar = document.querySelectorAll('.lz-rev');
  if('IntersectionObserver' in window && !quieto){
    var io = new IntersectionObserver(function(entradas){
      entradas.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('visto'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -12% 0px', threshold: .12 });
    revelar.forEach(function(el){ io.observe(el); });
  } else revelar.forEach(function(el){ el.classList.add('visto'); });

  // Los objetos 3D de los pasos flotan un poco al hacer scroll
  var objetos = document.querySelectorAll('.lz-vis');
  if(objetos.length && !quieto){
    var pendiente = false;
    function mover(){
      pendiente = false; var alto = window.innerHeight;
      objetos.forEach(function(img){
        var r = img.getBoundingClientRect(); if(r.bottom < -100 || r.top > alto + 100) return;
        var k = Math.max(-1, Math.min(1, (r.top + r.height / 2 - alto / 2) / alto)); img.style.setProperty('--py', (k * (window.innerWidth < 860 ? -12 : -24)).toFixed(1) + 'px');
      });
    }
    window.addEventListener('scroll', function(){ if(!pendiente){ pendiente = true; requestAnimationFrame(mover); } }, { passive: true });
    mover();
  }

  // Video de la portada: si el usuario prefiere menos movimiento, queda la imagen fija
  var video = document.querySelector('.lz-ciudad video');
  if(video && quieto){ video.removeAttribute('autoplay'); video.pause(); }

  // Íconos de línea por tipo (los mismos de la app)
  var ICO = {"fiesta": "<svg width=\"40\" height=\"40\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"13\" r=\"7\"/><path d=\"M12 6V2M5.5 10.5h13M5.5 15.5h13M12 6c-2 2.2-2.8 4.6-2.8 7s.8 4.8 2.8 7M12 6c2 2.2 2.8 4.6 2.8 7s-.8 4.8-2.8 7\"/></svg>", "pena": "<svg width=\"40\" height=\"40\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M14 3l4 4-2 2-4-4z\"/><path d=\"M13.5 7.5 9 12\"/><path d=\"M10.5 10.5c-2.5-1-5 0-6 2.5s0 5.5 2.5 6.5 5.5 0 6.5-2.5c.6-1.5.3-3-.5-4.2\"/><circle cx=\"8.5\" cy=\"15.5\" r=\"1.4\"/></svg>", "recital": "<svg width=\"40\" height=\"40\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"6\" y=\"3\" width=\"5\" height=\"10\" rx=\"2.5\"/><path d=\"M3.5 10.5a5 5 0 0 0 10 0M8.5 15.5V20M6 20h5\"/><path d=\"M17 11V4l4-1v6\"/><circle cx=\"16\" cy=\"11.2\" r=\"1.6\"/><circle cx=\"20\" cy=\"9.2\" r=\"1.6\"/></svg>", "futbol": "<svg width=\"40\" height=\"40\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"m12 7 4 3-1.5 4.5h-5L8 10z\"/><path d=\"M12 3v4M21 10l-5 0M17.5 19l-3-4.5M6.5 19l3-4.5M3 10l5 0\"/></svg>", "taller": "<svg width=\"40\" height=\"40\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z\"/></svg>", "feria": "<svg width=\"40\" height=\"40\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 9l2-5h14l2 5\"/><path d=\"M3 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3\"/><path d=\"M5 12v8h14v-8M10 20v-5h4v5\"/></svg>"};
  // Demo: ¿Qué hacés este sábado?
  var PLANES = {
    fiesta: [
      { t: 'Noche Vortex', h: 'Hoy, 23:30', l: 'Güemes', i: ICO.fiesta, c: ['#0297DE', '#7A8BE0'], a: ['Sofi', 'Ivo'], m: 38 },
      { t: 'Terraza Ámbar', h: 'Sábado, 00:30', l: 'Nueva Córdoba', i: ICO.fiesta, c: ['#FC734D', '#FFA98C'], a: ['Male'], m: 21 }
    ],
    pena: [
      { t: 'Peña El Patio', h: 'Hoy, 21:00', l: 'Cofico', i: ICO.pena, c: ['#FC734D', '#E8B411'], a: ['Agus', 'Cami'], m: 54 },
      { t: 'Guitarreada en la plaza', h: 'Sábado, 19:00', l: 'General Paz', i: ICO.pena, c: ['#0B6FA8', '#0297DE'], a: ['Ivo'], m: 17 }
    ],
    recital: [
      { t: 'Banda Eléctrica en vivo', h: 'Hoy, 22:00', l: 'Centro', i: ICO.recital, c: ['#7A8BE0', '#FC734D'], a: ['Sofi', 'Male'], m: 120 },
      { t: 'Acústico en la terraza', h: 'Domingo, 20:30', l: 'Güemes', i: ICO.recital, c: ['#0297DE', '#6CCBF5'], a: ['Cami'], m: 32 }
    ],
    futbol: [
      { t: 'Torneo Relámpago', h: 'Sábado, 16:00', l: 'Alta Córdoba', i: ICO.futbol, c: ['#2E9B5B', '#6CCBF5'], a: ['Ivo', 'Agus'], m: 9 },
      { t: 'Picado de los sábados', h: 'Sábado, 18:30', l: 'Cerro de las Rosas', i: ICO.futbol, c: ['#0B6FA8', '#2E9B5B'], a: ['Male'], m: 7 }
    ],
    taller: [
      { t: 'Taller de cerámica', h: 'Sábado, 11:00', l: 'Güemes', i: ICO.taller, c: ['#FFA98C', '#FC734D'], a: ['Cami'], m: 11 },
      { t: 'Taller de cócteles', h: 'Viernes, 20:00', l: 'Nueva Córdoba', i: ICO.taller, c: ['#7A8BE0', '#0297DE'], a: ['Sofi', 'Agus'], m: 14 }
    ],
    feria: [
      { t: 'Feria de diseño', h: 'Sábado, 17:00', l: 'Paseo del Buen Pastor', i: ICO.feria, c: ['#E8B411', '#FC734D'], a: ['Male', 'Sofi'], m: 86 },
      { t: 'Feria vintage', h: 'Domingo, 15:00', l: 'Centro', i: ICO.feria, c: ['#0297DE', '#FFA98C'], a: ['Ivo'], m: 43 }
    ]
  };
  var COLOR_AMIGO = { Sofi: ICO.feria, Ivo: '#FC734D', Male: '#7A8BE0', Agus: '#2E9B5B', Cami: ICO.feria };
  var cartas = document.getElementById('lz-cartas');
  var chips = document.querySelectorAll('.lz-chip');
  function esc(s){ return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function quienes(a, m, yo){
    var nombres = yo ? ['Vos'].concat(a) : a.slice();
    return nombres.join(', ') + ' <span>y ' + m + ' más</span> van';
  }
  function carta(ev, k){
    var av = ev.a.map(function(n){ return '<i style="background:' + COLOR_AMIGO[n] + '">' + n.charAt(0) + '</i>'; }).join('');
    return '<article class="lz-carta" style="--k:' + k + '">' +
      '<div class="lz-tapa" style="background:linear-gradient(135deg,' + ev.c[0] + ',' + ev.c[1] + ')"><span>' + ev.i + '</span></div>' +
      '<div class="lz-cuerpo"><h3>' + esc(ev.t) + '</h3><p class="lz-cuando">' + esc(ev.h) + '<br>' + esc(ev.l) + '</p>' +
      '<div class="lz-van"><span class="lz-avs">' + av + '</span><span class="lz-quien">' + quienes(ev.a, ev.m) + '</span></div>' +
      '<button type="button" class="lz-sumo">Me sumo</button></div></article>';
  }
  function mostrar(plan){
    if(!cartas || !PLANES[plan]) return;
    chips.forEach(function(c){ var on = c.dataset.plan === plan; c.classList.toggle('on', on); c.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    cartas.classList.remove('entra'); cartas.innerHTML = PLANES[plan].map(carta).join('');
    cartas.dataset.plan = plan; void cartas.offsetWidth; cartas.classList.add('entra');
  }
  chips.forEach(function(c){ c.addEventListener('click', function(){ mostrar(c.dataset.plan); }); });
  if(cartas) cartas.addEventListener('click', function(e){
    var b = e.target.closest('.lz-sumo'); if(!b) return;
    var art = b.closest('.lz-carta'), i = Array.prototype.indexOf.call(cartas.children, art), ev = PLANES[cartas.dataset.plan][i];
    var yo = !b.classList.contains('vas'); b.classList.toggle('vas', yo); b.textContent = yo ? '✓ Vas' : 'Me sumo';
    art.querySelector('.lz-quien').innerHTML = quienes(ev.a, ev.m, yo);
    if(yo){ var av = art.querySelector('.lz-avs'); var yoI = document.createElement('i'); yoI.className = 'yo'; yoI.textContent = 'V'; av.insertBefore(yoI, av.firstChild); }
    else { var q = art.querySelector('.lz-avs .yo'); if(q) q.remove(); }
  });
  mostrar('fiesta');
  raiz.classList.add('lz-listo');
})();
