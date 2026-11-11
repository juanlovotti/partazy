// Interruptores de la migración a React (fase 2 en adelante).
//
// Cada pantalla que ya tiene versión React se puede prender o apagar sin publicar código nuevo:
//   - Para probar: en el link de prueba (no en partazy.com), abrí la app con ?react=ayuda (o varias:
//     ?react=ayuda,guia). Queda guardado en ese navegador; ?react=0 lo apaga.
//     En partazy.com esto se ignora: ahí solo cuenta PUBLICADAS (así nadie puede prender una pantalla
//     a otra persona mandándole un link).
//   - Para todos: agregá el nombre a PUBLICADAS (y publicá). Sacarlo de la lista vuelve a la versión vieja.
// Si no hay ninguna pantalla prendida, React ni se descarga: la app pesa lo mismo que antes.
export const PUBLICADAS: string[] = [];          // ej.: ['ayuda'] cuando Juan dé el OK para partazy.com
export const DISPONIBLES = ['ayuda'];  // pantallas que ya tienen versión React

const CLAVE = 'partazy_react';
const ES_PRODUCCION = location.hostname === 'partazy.com' || location.hostname === 'www.partazy.com';
function leerPrueba(): string[] {
  if(ES_PRODUCCION) return [];
  try{
    const q = new URLSearchParams(location.search).get('react');
    if(q !== null){
      const lista = q === '0' ? [] : q.split(',').map(s => s.trim()).filter(Boolean);
      if(lista.length) localStorage.setItem(CLAVE, lista.join(',')); else localStorage.removeItem(CLAVE);
      return lista;
    }
    return (localStorage.getItem(CLAVE) || '').split(',').filter(Boolean);
  } catch(e){ return []; }
}

export const pantallasReact = new Set([...PUBLICADAS, ...leerPrueba()].filter(p => DISPONIBLES.includes(p)));
// La app vieja lo consulta para no tocar lo que ahora dibuja React
window.__pantallasReact = pantallasReact;

if(pantallasReact.size){
  window.__reactListo = import('./arranque').then(m => m.arrancar([...pantallasReact]))
    .catch(e => { console.error('React no pudo arrancar; queda la versión vieja', e); pantallasReact.clear(); });
}
