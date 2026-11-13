// Hooks de datos (u08): cargar una vez o escuchar en vivo, siempre con cierre al desmontar.
// Regla: ninguna pantalla React abre una escucha de Firestore sin estos hooks (así nunca queda una abierta).
import { useEffect, useRef, useState } from 'react';
import type { Cortar } from './api';

export type Carga<T> = { datos: T | undefined; cargando: boolean; error: unknown };

// Carga algo una vez (y de nuevo si cambian las dependencias). Si el componente se va antes de que
// llegue la respuesta, la descarta (no pisa una carga más nueva ni toca un componente que ya no está).
export function useCarga<T>(cargar: (() => Promise<T>) | null, deps: unknown[]): Carga<T> {
  const [estado, setEstado] = useState<Carga<T>>({ datos: undefined, cargando: !!cargar, error: null });
  useEffect(() => {
    if(!cargar){ setEstado({ datos: undefined, cargando: false, error: null }); return; }
    let vigente = true;
    setEstado(e => ({ ...e, cargando: true, error: null }));
    cargar().then(d => { if(vigente) setEstado({ datos: d, cargando: false, error: null }); },
                  err => { if(vigente) setEstado({ datos: undefined, cargando: false, error: err }); });
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return estado;
}

// Escucha en vivo (onSnapshot de la app vieja). `abrir` recibe a quién avisar y devuelve cómo cortar.
// Se corta al desmontar o al cambiar las dependencias. Un error deja `error` y el último dato bueno.
export function useEscucha<T>(abrir: ((avisar: (d: T) => void, fallo: (e: unknown) => void) => Cortar) | null, deps: unknown[]): Carga<T> {
  const [estado, setEstado] = useState<Carga<T>>({ datos: undefined, cargando: !!abrir, error: null });
  const ultimo = useRef<T | undefined>(undefined);
  useEffect(() => {
    if(!abrir){ setEstado({ datos: undefined, cargando: false, error: null }); return; }
    let vigente = true;
    setEstado({ datos: ultimo.current, cargando: true, error: null });
    let cortar: Cortar | undefined;
    try{
      cortar = abrir(d => { if(!vigente) return; ultimo.current = d; setEstado({ datos: d, cargando: false, error: null }); },
                     e => { if(vigente) setEstado({ datos: ultimo.current, cargando: false, error: e }); });
    } catch(e){ setEstado({ datos: undefined, cargando: false, error: e }); }
    return () => { vigente = false; try{ cortar?.(); } catch(e){ console.warn('cortar escucha', e); } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return estado;
}
