// Acceso desde React a lo que todavía vive en la app vieja (src/app.js), a través del puente global.
// Todo lo que React usa de la app vieja pasa por acá: así se sabe qué falta migrar y está tipado.
export type Perfil = { nombre?: string; usuario?: string; [k: string]: unknown };
export type Consulta = { nombre: string; email: string; motivo: string; mensaje: string; uid: string; ts: number };
export type SeccionAyuda = [string, [string, string][]];

type Legado = {
  state: { uid: string | null; perfil: Perfil | null; [k: string]: unknown };
  DataService: { enviarConsulta(c: Consulta): Promise<unknown>; [k: string]: unknown };
  AYUDA: SeccionAyuda[];
  MAIL_CONTACTO: string;
  WHATSAPP_CONTACTO: string;
  toast(texto: string): void;
  volver(destino?: string | (() => void)): void;
  abrirTutorial(): void;
  abrirReferencias(): void;
  abrirPrivacidad(): void;
};
const w = () => window as unknown as Legado;

export const legado = {
  get state(){ return w().state; },
  get DataService(){ return w().DataService; },
  get AYUDA(){ return w().AYUDA; },
  get MAIL_CONTACTO(){ return w().MAIL_CONTACTO; },
  get WHATSAPP_CONTACTO(){ return w().WHATSAPP_CONTACTO; },
  toast: (texto: string) => w().toast(texto),
  volver: (destino?: string) => w().volver(destino),
  abrirTutorial: () => w().abrirTutorial(),
  abrirReferencias: () => w().abrirReferencias(),
  abrirPrivacidad: () => w().abrirPrivacidad(),
};

// La app vieja avisa con este evento cuando abre una pantalla que dibuja React
export function alAbrirPantalla(nombre: string, fn: () => void){
  const h = (e: Event) => { if((e as CustomEvent<string>).detail === nombre) fn(); };
  document.addEventListener('partazy:abrir-pantalla', h);
  return () => document.removeEventListener('partazy:abrir-pantalla', h);
}
