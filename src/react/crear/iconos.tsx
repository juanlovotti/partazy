// Íconos de trazo del Crear por pasos (mismo estilo que los de la app: 24x24, trazo 2, puntas redondeadas).
import { crearLegado } from '../legado';

const TRAZOS: Record<string, string> = {
  cerrar: '<path d="M18 6 6 18M6 6l12 12"/>',
  atras: '<path d="m15 18-6-6 6-6"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  menos: '<path d="M5 12h14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  pin: '<path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z"/><circle cx="12" cy="10" r="2.5"/>',
  foto: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  calendario: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  entrada: '<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"/><path d="M13 6v2M13 11v2M13 16v2"/>',
  billete: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  remera: '<path d="M20.4 7.4 16 4a4 4 0 0 1-8 0L3.6 7.4a1 1 0 0 0-.2 1.4l1.8 2.4a1 1 0 0 0 1.4.2L8 10.6V20h8v-9.4l1.4.8a1 1 0 0 0 1.4-.2l1.8-2.4a1 1 0 0 0-.2-1.4z"/>',
  musica: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  lista: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  reglas: '<path d="M8 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M10 8h6M10 12h6M10 16h4"/>',
  pregunta: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M9.6 9.5a2.5 2.5 0 0 1 4.8 1c0 1.6-2.4 2-2.4 3.5M12 17h.01"/>',
  corona: '<path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5z"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  candado: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  mover: '<path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>',
};

export function Icono({ n, tam = 20 }: { n: string; tam?: number }){
  return <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: TRAZOS[n] || '' }} />;
}
// Ícono del tipo de evento (los mismos dibujos de la app vieja).
export function IconoTipo({ k, tam = 28 }: { k: string; tam?: number }){
  return <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: crearLegado.ICONOS_TIPO[k] || crearLegado.ICONOS_TIPO.fiesta || '' }} />;
}
