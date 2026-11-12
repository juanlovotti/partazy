// Lo que la app vieja y la nueva comparten a través de window mientras convivan.
declare global {
  interface Window {
    __pantallasReact?: Set<string>;
    __reactListo?: Promise<void>;
    // Puente de estado (src/estado.js): avisa qué claves de state y NAV cambiaron
    __puenteEstado?: { suscribir(fn: (ids: Set<string>) => void): () => void; version(id: string): number };
  }
}
export {};
