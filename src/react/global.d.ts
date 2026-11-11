// Lo que la app vieja y la nueva comparten a través de window mientras convivan.
declare global {
  interface Window {
    __pantallasReact?: Set<string>;
    __reactListo?: Promise<void>;
  }
}
export {};
