// Tipos de src/estado.js (puente de estado entre la app vieja y React)
export function observar<T extends object>(nombre: string, obj: T): T;
export function avisarEstado(clave: string, nombre?: string): void;
export const puenteEstado: {
  suscribir(fn: (ids: Set<string>) => void): () => void;
  version(id: string): number;
  cantidadOyentes(): number;
};
