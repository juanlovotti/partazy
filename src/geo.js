// Servicio de direcciones (OpenStreetMap / Nominatim). u08 de la migración.
// Antes había seis pedidos armados a mano en app.js (buscar un lugar, sugerencias, la ciudad desde
// coordenadas, la dirección del punto del mapa...). Ahora pasan todos por acá: misma dirección base,
// mismo idioma (español) y país (Argentina), y el mismo formato de respuesta. Lo usan la app vieja y React.
// No guarda nada en memoria (cada búsqueda va a Nominatim, como antes) y los errores siguen llegando
// a quien llama, que ya tiene su try/catch.
export const NOMINATIM = 'https://nominatim.openstreetmap.org';

// Cuadro alrededor de un punto para priorizar resultados cercanos. acotada = solo dentro del cuadro.
export function cajaCerca(c, radio = 0.45, acotada = true){
  if(!c || typeof c.lat !== 'number' || typeof c.lng !== 'number') return '';
  return `&viewbox=${c.lng - radio},${c.lat + radio},${c.lng + radio},${c.lat - radio}${acotada ? '&bounded=1' : ''}`;
}
// Busca un texto. Devuelve la lista de Nominatim (con la dirección desglosada en `address`).
export async function buscarDireccion(q, { limite = 1, caja = '', signal } = {}){
  const url = `${NOMINATIM}/search?format=jsonv2&limit=${limite}&countrycodes=ar&addressdetails=1&accept-language=es${caja}&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, signal ? { signal } : {});
  return r.json();
}
// Dirección de un punto. zoom 12 = ciudad o barrio; 18 = calle y número.
export async function direccionDePunto(lat, lng, { zoom = 18, detalles = true } = {}){
  const r = await fetch(`${NOMINATIM}/reverse?format=jsonv2${detalles ? '&addressdetails=1' : ''}&zoom=${zoom}&accept-language=es&lat=${lat}&lon=${lng}`);
  return r.json();
}
