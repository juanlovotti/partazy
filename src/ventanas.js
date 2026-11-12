// =========================================================
//  Ventanas accesibles con teclado y lector de pantalla (11/11/2026)
//  Vale para todas las hojas y ventanas: .hoja-bg, .modal-bg, .tuto-bg y .mapa-bg.
//  No cambia nada a la vista:
//  - al abrir una ventana, el foco entra en ella (el lector de pantalla la anuncia);
//  - con Tab el foco no se va a la pantalla de atrás;
//  - Escape la cierra, igual que el "atrás" del celular;
//  - al cerrarla, el foco vuelve a donde estaba.
// =========================================================
const VENTANAS = '.hoja-bg, .modal-bg, .tuto-bg, .mapa-bg';
const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

// Estas ya se cierran solas con Escape (confirmar, pedir un texto, elegir amigos): no se les agrega otro.
const CON_ESCAPE_PROPIO = ['modal-bg', 'hoja-amigos'];

let ultimoAfuera = null;             // último elemento con foco fuera de las ventanas
const origen = new WeakMap();         // ventana → elemento que tenía el foco antes de abrirla

const esVisible = el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
const abiertas = () => [...document.querySelectorAll(VENTANAS)].filter(v => v.classList.contains('show'));
// La de más arriba: la de mayor z-index (si empatan, la última en la página)
function deArriba(){
  let top = null, z = -Infinity;
  for(const v of abiertas()){ const zi = parseInt(getComputedStyle(v).zIndex, 10) || 0; if(zi >= z){ z = zi; top = v; } }
  return top;
}
const enfocablesDe = v => [...v.querySelectorAll(ENFOCABLES)].filter(esVisible);

function enfocar(el){ try{ el.focus({ preventScroll: true }); } catch(e){ try{ el.focus(); } catch(_){} } }

function alAbrir(v){
  origen.set(v, ultimoAfuera);
  if(v.contains(document.activeElement)) return;   // la ventana ya puso el foco donde quería (por ejemplo, en "Aceptar")
  if(!v.hasAttribute('tabindex')) v.setAttribute('tabindex', '-1');
  enfocar(v);
}
function alCerrar(v){
  const a = document.activeElement;
  if(a && a !== document.body && !v.contains(a)) return;   // el foco ya está en otro lado: no se toca
  const o = origen.get(v); origen.delete(v);
  const otra = deArriba();
  if(otra){ if(!otra.contains(a)) enfocar(otra); return; }   // quedó otra ventana abierta debajo
  if(o && o.isConnected && esVisible(o)) enfocar(o);
}

function vigilar(){
  const obs = new MutationObserver(cambios => {
    for(const c of cambios){
      const v = c.target, ahora = v.classList.contains('show'), antes = /(^|\s)show(\s|$)/.test(c.oldValue || '');
      if(ahora && !antes) alAbrir(v);
      else if(!ahora && antes) alCerrar(v);
    }
  });
  for(const v of document.querySelectorAll(VENTANAS)) obs.observe(v, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
}

document.addEventListener('focusin', e => { if(!e.target.closest || !e.target.closest(VENTANAS)) ultimoAfuera = e.target; }, true);

document.addEventListener('keydown', e => {
  const v = deArriba();
  if(!v) return;
  if(e.key === 'Escape'){
    if(e.defaultPrevented || CON_ESCAPE_PROPIO.includes(v.id)) return;
    if(typeof window.cerrarModalAbierto === 'function'){ e.preventDefault(); window.cerrarModalAbierto(); }
    return;
  }
  if(e.key !== 'Tab') return;
  const lista = enfocablesDe(v);
  if(!lista.length){ e.preventDefault(); enfocar(v); return; }
  const primero = lista[0], ultimo = lista[lista.length - 1], a = document.activeElement;
  if(!v.contains(a) || a === v){ e.preventDefault(); enfocar(e.shiftKey ? ultimo : primero); }
  else if(e.shiftKey && (a === primero || a === v)){ e.preventDefault(); enfocar(ultimo); }
  else if(!e.shiftKey && a === ultimo){ e.preventDefault(); enfocar(primero); }
});

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', vigilar); else vigilar();
