// Datos para las pantallas React (u08): una capa tipada sobre DataService de la app vieja.
// Las pantallas importan de acá, nunca de window.DataService: cuando u03 pase Firebase al SDK modular,
// se cambia esta capa y las pantallas quedan igual. Por ahora solo están los métodos que van a usar
// las próximas pantallas (perfil, entradas, social); se suman a medida que hacen falta.
import type { Evento, Perfil, Privado, Asistencia, Notificacion, Verificacion } from './tipos';

export type AsistenciaDe = Asistencia & { eventId: string };
export type Cortar = () => void;
type Servicio = {
  getEvento(id: string): Promise<Evento | null>;
  eventosDe(uid: string): Promise<Evento[]>;
  listAsistenciasDe(uid: string): Promise<AsistenciaDe[]>;
  getPerfil(uid: string): Promise<Perfil | null>;
  getPrivado(uid: string): Promise<Privado | null>;
  usuarioDisponible(handle: string, uid: string): Promise<boolean>;
  amigosDe(uid: string): Promise<string[]>;
  siguiendo(org: string, uid: string): Promise<boolean>;
  listarFans(org: string): Promise<string[]>;
  getVerificacion(uid: string): Promise<Verificacion | null>;
  escucharEventos(onData: (lista: Evento[]) => void, onErr?: (e: unknown) => void): Cortar;
  escucharNotificaciones(uid: string, onData: (lista: Notificacion[]) => void, onErr?: (e: unknown) => void): Cortar;
  escucharBloqueos(uid: string, onData: (uids: string[]) => void, onErr?: (e: unknown) => void): Cortar;
};
const ds = (): Servicio => (window as unknown as { DataService: Servicio }).DataService;

export const datos = {
  evento: (id: string) => ds().getEvento(id),
  eventosDe: (uid: string) => ds().eventosDe(uid),
  asistenciasDe: (uid: string) => ds().listAsistenciasDe(uid),
  perfil: (uid: string) => ds().getPerfil(uid),
  privado: (uid: string) => ds().getPrivado(uid),
  usuarioDisponible: (handle: string, uid: string) => ds().usuarioDisponible(handle, uid),
  amigosDe: (uid: string) => ds().amigosDe(uid),
  siguiendo: (org: string, uid: string) => ds().siguiendo(org, uid),
  fans: (org: string) => ds().listarFans(org),
  verificacion: (uid: string) => ds().getVerificacion(uid),
  // Escuchas en vivo: devuelven la función para cortarlas (los hooks de abajo la llaman al desmontar)
  escucharNotificaciones: (uid: string, fn: (l: Notificacion[]) => void, err?: (e: unknown) => void) => ds().escucharNotificaciones(uid, fn, err),
  escucharBloqueos: (uid: string, fn: (l: string[]) => void, err?: (e: unknown) => void) => ds().escucharBloqueos(uid, fn, err),
};
