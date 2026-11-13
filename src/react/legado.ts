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
  ir(nombre: string, opts?: { clave?: string; abrir?: () => void }): void;
  abrirDetalle(id: string): void;
  abrirTicket(id: string): void;
  abrirUsuario(uid: string): void;
  abrirChats(): void;
  abrirNotificaciones(): void;
  pedirCuenta(motivo?: string): void;
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

// ---------- Crear un evento (Crear por pasos) ----------
// Los datos que entiende publicarConDatos() de la app vieja (los mismos que lee del formulario de siempre).
export type Faq = { p: string; r: string };
export type ConfigEquipos = { porEquipos: boolean; jugadoresPorEquipo?: number | null; maxEquipos?: number | null; error?: string; foco?: string };
export type Punto = { lat: number; lng: number };
export type DatosCrear = {
  tipo: 'fiesta' | 'previa'; privada: boolean; ocasion: string;
  nombre: string; descripcion: string;
  lugar: string; direccion: string; ubicacionMapa: Punto | null;
  fecha: string; hora: string; horaFin: string; inscFecha: string; inscHora: string;
  capacidad: string; edad: string;
  pago: boolean; precio: string; pagoInfo: string; cobraOtro: boolean; pagoTitular: string; linkEntradas: string; comprobante: boolean;
  estilo: string; estiloOtro: string; musica: string;
  lineup: string; dresscode: string; reglas: string;
  faq: Faq[]; equipos: ConfigEquipos; extras: Record<string, string>;
  vipOn: boolean; vip: string[]; bebida: boolean; qr: boolean;
  imagenNueva: string | null; imagenMini: string | null;
  editando: null;
};
// Cómo le habla la app vieja a la pantalla mientras publica.
export type UiPublicar = { vistaPrevia: boolean; enfocar(campo: string): void; ocupado(on: boolean): void; listo(id: string): void };
export type CampoExtra = { k: string; l: string; t?: 'text' | 'num' | 'sel' | 'multi'; ph?: string; ops?: string[]; si?: [string, string] };
export type LugarSugerido = { nombre: string; detalle: string; lat: number; lng: number; ciudad: string };
export type DirMapa = { corta?: string; barrio?: string; completa?: string; calle?: string };

type LegadoCrear = {
  OCASIONES: Record<string, string>;
  TIPOS_NUEVOS: string[];
  ICONOS_TIPO: Record<string, string>;
  EXTRAS_TIPO: Record<string, CampoExtra[]>;
  ESTILOS: Record<string, string>;
  OCASIONES_FIESTA: Set<string>;
  FAQ_SUGERIDAS: Record<string, string[]>;
  MAX_FAQ: number;
  publicarConDatos(d: DatosCrear, ui: UiPublicar): Promise<string | undefined>;
  prepararFoto(file: File, maxLado: number, cuadrada: boolean): Promise<string>;
  miniaturaDe(dataUrl: string): Promise<string>;
  buscarLugares(q: string, limite?: number, cerca?: boolean): Promise<LugarSugerido[] | null>;
  abrirMapa(opts: { inicio: Punto | null; alConfirmar(p: Punto, dir: DirMapa): void }): Promise<void>;
  tarjetaHTML(ev: Record<string, unknown>): string;
  verNormas(): void;
  esOrganizacion(perfil: unknown): boolean;
  pareceDireccion(t: string): boolean;
  datoPago(t: string): string;
  linkWeb(v: string, soloHttps?: boolean): { url: string; texto: string } | null;
};
const wc = () => window as unknown as LegadoCrear;
export const crearLegado = {
  get OCASIONES(){ return wc().OCASIONES; },
  get TIPOS_NUEVOS(){ return wc().TIPOS_NUEVOS; },
  get ICONOS_TIPO(){ return wc().ICONOS_TIPO; },
  get EXTRAS_TIPO(){ return wc().EXTRAS_TIPO; },
  get ESTILOS(){ return wc().ESTILOS; },
  get OCASIONES_FIESTA(){ return wc().OCASIONES_FIESTA; },
  get FAQ_SUGERIDAS(){ return wc().FAQ_SUGERIDAS; },
  get MAX_FAQ(){ return wc().MAX_FAQ; },
  publicar: (d: DatosCrear, ui: UiPublicar) => wc().publicarConDatos(d, ui),
  prepararFoto: (file: File) => wc().prepararFoto(file, 800, false),
  miniaturaDe: (dataUrl: string) => wc().miniaturaDe(dataUrl),
  buscarLugares: (q: string) => wc().buscarLugares(q, 5, true),
  abrirMapa: (inicio: Punto | null, alConfirmar: (p: Punto, dir: DirMapa) => void) => wc().abrirMapa({ inicio, alConfirmar }),
  tarjetaHTML: (ev: Record<string, unknown>) => wc().tarjetaHTML(ev),
  verNormas: () => wc().verNormas(),
  esOrganizacion: (perfil: unknown) => wc().esOrganizacion(perfil),
  pareceDireccion: (t: string) => wc().pareceDireccion(t),
  datoPago: (t: string) => wc().datoPago(t),
  linkWeb: (v: string) => wc().linkWeb(v, true),
};

// Navegar desde React a través de la app vieja (mismo historial, mismo "atrás" del celular,
// mismas reglas de invitado). Cuando la navegación pase a React, esto cambia por el router.
export const navegar = {
  ir: (nombre: string, opts?: { clave?: string; abrir?: () => void }) => w().ir(nombre, opts),
  volver: (destino?: string) => w().volver(destino),
  evento: (id: string) => w().abrirDetalle(id),
  entrada: (id: string) => w().abrirTicket(id),
  persona: (uid: string) => w().abrirUsuario(uid),
  chats: () => w().abrirChats(),
  avisos: () => w().abrirNotificaciones(),
  pedirCuenta: (motivo?: string) => w().pedirCuenta(motivo),
};

// La app vieja avisa con este evento cuando abre una pantalla que dibuja React
export function alAbrirPantalla(nombre: string, fn: () => void){
  const h = (e: Event) => { if((e as CustomEvent<string>).detail === nombre) fn(); };
  document.addEventListener('partazy:abrir-pantalla', h);
  return () => document.removeEventListener('partazy:abrir-pantalla', h);
}
