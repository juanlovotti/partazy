// Tipos de src/geo.js (servicio de direcciones de OpenStreetMap).
export type Punto = { lat: number; lng: number };
export type DireccionOSM = {
  lat: string; lon: string; name?: string; display_name?: string;
  address?: Partial<Record<'road' | 'house_number' | 'suburb' | 'neighbourhood' | 'quarter' | 'city' | 'town' | 'village' | 'municipality' | 'county' | 'state_district' | 'state' | 'postcode', string>>;
};
export const NOMINATIM: string;
export function cajaCerca(c: Punto | null | undefined, radio?: number, acotada?: boolean): string;
export function buscarDireccion(q: string, opts?: { limite?: number; caja?: string; signal?: AbortSignal }): Promise<DireccionOSM[]>;
export function direccionDePunto(lat: number, lng: number, opts?: { zoom?: number; detalles?: boolean }): Promise<DireccionOSM>;
