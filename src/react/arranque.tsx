// Monta React adentro de cada pantalla prendida. La app vieja sigue mostrando y ocultando la pantalla
// con ir(); lo de adentro pasa a ser de React y el código viejo no lo toca más.
//
// Cuidados (revisión de paridad):
// - Si la pantalla está abierta cuando llega React, se espera a que la persona salga de ella para no
//   borrarle lo que estaba escribiendo.
// - Si React falla al dibujar, se vuelve a poner la versión vieja tal cual estaba.
// - El contenedor usa display:contents; app.css aplica a sus hijos las mismas reglas de "hijo directo".
import { StrictMode } from 'react';
import type { ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import Ayuda from './pantallas/Ayuda';
import CrearPasos from './pantallas/CrearPasos';

const PANTALLAS: Record<string, ComponentType> = { ayuda: Ayuda, crear: CrearPasos };
// Dónde se dibuja cada una, si no es en su pantalla de siempre (pantalla-<nombre>).
// "crear" tiene pantalla propia: editar un evento sigue usando el formulario de siempre.
const CONTENEDOR: Record<string, string> = { crear: 'pantalla-crear-pasos' };
const raices = new Map<string, Root>();

export function arrancar(nombres: string[]){
  for(const n of nombres){
    const el = document.getElementById(CONTENEDOR[n] || 'pantalla-' + n);
    if(!PANTALLAS[n] || !el || raices.has(n)) continue;
    if(el.classList.contains('activa')) esperarQueSeCierre(el, () => montar(n, el));
    else montar(n, el);
  }
}

function esperarQueSeCierre(el: HTMLElement, fn: () => void){
  const obs = new MutationObserver(() => { if(!el.classList.contains('activa')){ obs.disconnect(); fn(); } });
  obs.observe(el, { attributes: true, attributeFilter: ['class'] });
}

function montar(n: string, el: HTMLElement){
  const C = PANTALLAS[n];
  // Lo que había era la versión vieja: se guarda (por si React falla) y desde acá el dueño es React.
  // El pie legal (si hay) queda de la app vieja, porque lo comparten varias pantallas.
  const pie = el.querySelector(':scope > footer.pie-legal');
  const viejos: ChildNode[] = [];
  while(el.firstChild && el.firstChild !== pie){ viejos.push(el.firstChild); el.removeChild(el.firstChild); }
  const host = document.createElement('div');
  host.style.display = 'contents';
  host.dataset.react = n;
  el.insertBefore(host, pie);
  const restaurar = (error: unknown) => {
    console.error('La pantalla "' + n + '" en React falló; vuelve la versión vieja', error);
    queueMicrotask(() => {
      raices.get(n)?.unmount(); raices.delete(n);
      host.remove();
      for(const v of viejos) el.insertBefore(v, pie);
      window.__pantallasReact?.delete(n);
    });
  };
  const r = createRoot(host, { onUncaughtError: restaurar });
  r.render(<StrictMode><C /></StrictMode>);
  raices.set(n, r);
}

export function desmontar(n: string){ raices.get(n)?.unmount(); raices.delete(n); }
