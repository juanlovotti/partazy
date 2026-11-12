// Hooks para que las pantallas React lean el estado de la app vieja (state y NAV de src/app.js)
// y se vuelvan a pintar cuando cambia. Usa el puente de src/estado.js (temporal, u07).
import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { Perfil } from './legado';

// Lo que React lee hoy de `state`. Se completa con los tipos de los documentos en u08.
export type Coords = { lat: number; lng: number };
export type Amistad = { users: string[]; de: string; para: string; estado: string; [k: string]: unknown };
export type EventoResumen = { id: string; nombre?: string; fechaTs?: number; creador?: string; [k: string]: unknown };
export type Red = { amigosVan: Record<string, string[]>; compartidoPor: Record<string, string[]>; fof: Record<string, unknown>; notas: Record<string, unknown>; planes: Record<string, unknown>; listo: boolean };
export type EstadoApp = {
  uid: string | null;
  perfil: Perfil | null;
  invitado?: boolean;
  esAdmin: boolean;
  eventos: EventoResumen[];
  userCoords: Coords | null;
  ciudadActual?: string;
  radioKm?: number;
  amistades: Amistad[];
  red?: Red;
  [k: string]: unknown;
};
export type EstadoNav = { actual: string | null; clave: string | null; [k: string]: unknown };

type Puente = { suscribir(fn: (ids: Set<string>) => void): () => void; version(id: string): number };
type Ventana = { __puenteEstado?: Puente; state?: EstadoApp; NAV?: EstadoNav };
const w = () => window as unknown as Ventana;
const SIN_PUENTE: Puente = { suscribir: () => () => {}, version: () => 0 };
const puente = () => w().__puenteEstado || SIN_PUENTE;

// Lee una clave y vuelve a pintar solo cuando esa clave cambia.
function useClave<T>(prefijo: 'estado' | 'nav', clave: string, leer: () => T): T {
  const id = prefijo + '.' + clave;
  const cache = useRef<{ v: number; valor: T } | null>(null);
  const suscribir = useCallback((avisar: () => void) => puente().suscribir(ids => { if(ids.has(id)) avisar(); }), [id]);
  const foto = () => {
    const v = puente().version(id);
    if(!cache.current || cache.current.v !== v) cache.current = { v, valor: leer() };
    return cache.current;
  };
  return useSyncExternalStore(suscribir, foto, foto).valor;
}

export function useEstado<K extends keyof EstadoApp & string>(clave: K): EstadoApp[K] {
  return useClave('estado', clave, () => w().state?.[clave] as EstadoApp[K]);
}

export function useNav<K extends keyof EstadoNav & string>(clave: K): EstadoNav[K] {
  return useClave('nav', clave, () => w().NAV?.[clave] as EstadoNav[K]);
}

// Atajos para lo que van a usar casi todas las pantallas
export function useSesion(){
  const uid = useEstado('uid'), perfil = useEstado('perfil'), invitado = useEstado('invitado'), esAdmin = useEstado('esAdmin');
  return { uid, perfil, invitado: !!invitado || !uid, esAdmin: !!esAdmin };
}
export function useUbicacion(){
  const coords = useEstado('userCoords'), ciudad = useEstado('ciudadActual'), radioKm = useEstado('radioKm');
  return { coords, ciudad: ciudad || '', radioKm: typeof radioKm === 'number' ? radioKm : 0 };
}
export const useEventos = () => useEstado('eventos');
export const useAmistades = () => useEstado('amistades');
export function usePlanes(){ const red = useEstado('red'); return red?.planes || {}; }
export const usePantallaActual = () => useNav('actual');
