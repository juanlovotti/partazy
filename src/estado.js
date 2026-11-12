// =========================================================
//  Puente de estado entre la app vieja y React (u07 de la migración, 12/11/2026)
//
//  `state` y `NAV` de app.js pasan por observar(): siguen siendo los mismos objetos de siempre
//  (la app vieja los lee y los escribe igual), pero cada vez que se reemplaza una clave de primer
//  nivel (state.perfil = ..., NAV.actual = ...) el puente anota qué cambió y avisa a React.
//  Si la app vieja cambia algo por dentro (state.eventos.push, Object.assign(state.perfil, ...)),
//  tiene que llamar a avisarEstado('eventos') después. Los lugares donde pasa ya lo hacen.
//
//  Los avisos se juntan y salen una sola vez al final de cada tanda (microtarea): React no se entera
//  a medias. Temporal: se borra cuando todas las pantallas sean React.
// =========================================================
const oyentes = new Set();
const versiones = new Map();   // 'estado.perfil' → número de cambios
let pendientes = new Set(), programado = false;

function marcar(id){
  versiones.set(id, (versiones.get(id) || 0) + 1);
  pendientes.add(id);
  if(!programado){ programado = true; queueMicrotask(avisarTodos); }
}
function avisarTodos(){
  programado = false;
  const ids = pendientes; pendientes = new Set();
  for(const fn of [...oyentes]){ try{ fn(ids); } catch(e){ console.error('puente de estado:', e); } }
}

// Devuelve el mismo objeto, observado. `nombre` es el prefijo de las claves ('estado' o 'nav').
export function observar(nombre, obj){
  return new Proxy(obj, {
    set(t, k, v, r){
      const antes = t[k], ok = Reflect.set(t, k, v, r);
      if(ok && typeof k === 'string' && !Object.is(antes, v)) marcar(nombre + '.' + k);
      return ok;
    },
    deleteProperty(t, k){
      const habia = Object.prototype.hasOwnProperty.call(t, k), ok = Reflect.deleteProperty(t, k);
      if(ok && habia && typeof k === 'string') marcar(nombre + '.' + k);
      return ok;
    },
  });
}

// Para cambios por dentro de una clave, que el Proxy no ve
export function avisarEstado(clave, nombre = 'estado'){ marcar(nombre + '.' + clave); }

export const puenteEstado = {
  suscribir(fn){ oyentes.add(fn); return () => { oyentes.delete(fn); }; },
  version(id){ return versiones.get(id) || 0; },
  cantidadOyentes(){ return oyentes.size; },   // para las pruebas
};
if(typeof window !== 'undefined') window.__puenteEstado = puenteEstado;
