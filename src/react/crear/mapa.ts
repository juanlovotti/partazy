// Mapa chiquito del paso "¿Dónde es?": 3x3 teselas de OpenStreetMap con el punto en el centro
// (las mismas teselas que usa el mapa grande; sin cargar Leaflet).
import type { Punto } from '../legado';

export type Tesela = { url: string; left: number; top: number; key: string };
export function teselas(p: Punto, z = 16): Tesela[] {
  const n = 2 ** z;
  const x = (p.lng + 180) / 360 * n * 256;
  const lat = Math.max(-85, Math.min(85, p.lat)) * Math.PI / 180;
  const y = (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2 * n * 256;
  const tx = Math.floor(x / 256), ty = Math.floor(y / 256);
  const out: Tesela[] = [];
  for(let dy = -1; dy <= 1; dy++) for(let dx = -1; dx <= 1; dx++){
    const X = tx + dx, Y = ty + dy;
    if(Y < 0 || Y >= n) continue;
    out.push({ url: `https://tile.openstreetmap.org/${z}/${((X % n) + n) % n}/${Y}.png`, left: Math.round(X * 256 - x), top: Math.round(Y * 256 - y), key: `${X}-${Y}` });
  }
  return out;
}
