// Interruptores de la migración a React (fase 2 en adelante).
//
// Cada pantalla que ya tiene versión React se puede prender o apagar sin publicar código nuevo:
//   - Para probar: en el link de prueba (no en partazy.com), abrí la app con ?react=ayuda (o varias:
//     ?react=ayuda,guia). Queda guardado en ese navegador.
//     En partazy.com eso se ignora: ahí solo cuenta PUBLICADAS (así nadie puede prender una pantalla
//     a otra persona mandándole un link).
//   - Para todos: agregá el nombre a PUBLICADAS (y publicá). Sacarlo de la lista vuelve a la versión vieja.
//   - ?react=0 apaga TODAS (también las publicadas) en ese navegador, en cualquier dirección, incluso
//     partazy.com: es la salida de emergencia ("abrí partazy.com/?react=0") y lo que usan las pruebas de la
//     versión vieja. En partazy.com, cualquier otro ?react=... vuelve a lo normal.
// Si no hay ninguna pantalla prendida, React ni se descarga: la app pesa lo mismo que antes.
export const PUBLICADAS: string[] = ['crear'];   // prendidas para todos en partazy.com ("crear": OK de Juan el 12/11)
export const DISPONIBLES = ['ayuda', 'crear'];  // pantallas que ya tienen versión React ("crear" = Crear por pasos, solo eventos nuevos)
// Pantallas que solo usa alguien con cuenta: React se baja recién cuando hay sesión (y el navegador está libre).
// Así quien entra a mirar sin cuenta (la mayoría de las primeras visitas) no gasta esos KB.
export const CON_CUENTA = new Set(['crear']);

const CLAVE = 'partazy_react';
const ES_PRODUCCION = location.hostname === 'partazy.com' || location.hostname === 'www.partazy.com';
// Devuelve las pantallas prendidas a mano en este navegador, o 'ninguna' si se apagó todo con ?react=0.
function leerPrueba(): string[] | 'ninguna' {
  try{
    const q = new URLSearchParams(location.search).get('react');
    if(q !== null){
      if(q.trim() === '0'){ localStorage.setItem(CLAVE, '0'); return 'ninguna'; }
      const lista = ES_PRODUCCION ? [] : q.split(',').map(s => s.trim()).filter(Boolean);
      if(lista.length) localStorage.setItem(CLAVE, lista.join(',')); else localStorage.removeItem(CLAVE);
      return lista;
    }
    const guardado = localStorage.getItem(CLAVE) || '';
    if(guardado === '0') return 'ninguna';
    return ES_PRODUCCION ? [] : guardado.split(',').filter(Boolean);
  } catch(e){ return []; }
}

const prueba = leerPrueba();
export const pantallasReact = new Set(prueba === 'ninguna' ? [] : [...PUBLICADAS, ...prueba].filter(p => DISPONIBLES.includes(p)));
// La app vieja lo consulta para no tocar lo que ahora dibuja React
window.__pantallasReact = pantallasReact;

type Ventana = { state?: { uid?: string | null; invitado?: boolean } };
const hayCuenta = () => { const s = (window as unknown as Ventana).state; return !!(s && s.uid && !s.invitado); };
// Espera a que alguien entre con su cuenta (se entera por el puente de estado; si no, revisa cada tanto)
function cuandoHayCuenta(): Promise<void> {
  return new Promise(listo => {
    if(hayCuenta()) return listo();
    let salir: (() => void) | undefined;
    const revisar = () => { if(hayCuenta()){ clearInterval(reloj); salir?.(); listo(); } };
    const reloj = setInterval(revisar, 1500);
    queueMicrotask(() => {
      salir = window.__puenteEstado?.suscribir(ids => { if(ids.has('estado.uid') || ids.has('estado.invitado')) revisar(); });
      revisar();
    });
  });
}
const cuandoEsteLibre = () => new Promise<void>(r => {
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
  if(ric) ric(() => r(), { timeout: 2500 }); else setTimeout(r, 300);
});

if(pantallasReact.size){
  const soloConCuenta = [...pantallasReact].every(p => CON_CUENTA.has(p));
  const antes = soloConCuenta ? cuandoHayCuenta().then(cuandoEsteLibre) : Promise.resolve();
  window.__reactListo = antes.then(() => import('./arranque')).then(m => m.arrancar([...pantallasReact]))
    .catch(e => { console.error('React no pudo arrancar; queda la versión vieja', e); pantallasReact.clear(); });
}
