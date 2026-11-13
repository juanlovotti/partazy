// Tipos de los documentos de Firestore que usa Partazy (u08). Salen de lo que guarda y lee src/app.js.
// Los campos marcados como opcionales pueden no estar en documentos viejos: siempre hay que contemplarlo.
// [k: string]: unknown deja pasar campos nuevos sin romper, pero los que se usan tienen que estar acá.

export type Punto = { lat: number; lng: number };
export type TipoCuenta = 'persona' | 'organizacion';

// users/{uid}: lo público de una cuenta
export type Perfil = {
  nombre: string; usuario?: string; apodo?: string; iniciales?: string; foto?: string;
  tipoCuenta?: TipoCuenta; verificado?: boolean; banner?: string; bio?: string; instagram?: string;
  ciudad?: string; intereses?: string[]; nombreBusqueda?: string; palabras?: string[];
  ocultarAmigos?: boolean; ocultarSeguidores?: boolean; ocultarEdad?: boolean; ocultarEnLinea?: boolean; ocultarPlanes?: boolean;
  mensajesDe?: 'todos' | 'amigos'; createdAt?: number;
  califSuma?: number; califN?: number;   // calificación de una organización (suma de notas y cantidad)
  [k: string]: unknown;
};
// users/{uid}/privado/datos: solo lo ve la persona
export type Privado = { nacimiento?: string; email?: string; [k: string]: unknown };

export type Privacidad = 'publica' | 'privada';
export type EstadoEvento = 'publicado' | 'cancelado';
export type Faq = { p: string; r: string };
// events/{id}
export type Evento = {
  id: string;
  nombre: string; creador: string; creadorNombre?: string; organizador?: string; verificado?: boolean;
  tipo: 'fiesta' | 'previa'; tipoLugar?: string; ocasion?: string; categoria?: string; estiloOtro?: string;
  privacidad: Privacidad; estado?: EstadoEvento; motivoCancelacion?: string;
  fechaTs: number; hora?: string; horaFin?: string; inscripcionHasta?: number;
  lugar: string; lat: number; lng: number; ubicacionExacta?: boolean; ciudad?: string;
  precio: number; pagoInfo?: string; pagoTitular?: string; cobroComprobante?: boolean; linkEntradas?: string;
  capacidad: number; capacidadDesconocida?: boolean; confirmadosCount?: number; edadMinima?: number; vistasCount?: number;
  deOrganizacion?: boolean; conQR?: boolean; listaVip?: boolean; bebida?: boolean;
  dresscode?: string; musica?: string; lineup?: string; descripcion?: string; reglas?: string;
  faq?: Faq[]; extras?: Record<string, string>; porEquipos?: boolean; jugadoresPorEquipo?: number; maxEquipos?: number;
  ambiente?: string; ambienteLabel?: string; ambienteDesc?: string;
  imagen?: string; fotoGrande?: boolean; createdAt?: number;
  [k: string]: unknown;
};
// events/{id}/attendees/{uid}
export type EstadoAsistencia = 'confirmado' | 'pendiente' | 'aprobado' | 'rechazado' | 'en-espera' | 'solicitado'
  | 'reservado' | 'pago-enviado' | 'pago-rechazado' | 'transferida';
export type Asistencia = {
  uid: string; nombre?: string; estado: EstadoAsistencia; ts?: number; ticket?: string;
  venceTs?: number; motivoRechazo?: string; checkinTs?: number; equipo?: string;
  [k: string]: unknown;
};
// friendships/{a_b}
export type Amistad = { users: [string, string]; de: string; para: string; estado: 'pendiente' | 'aceptada' | 'rechazada'; ts?: number };
// notificaciones/{uid}/items/{id}
export type Notificacion = { id: string; tipo: string; texto?: string; de?: string; deNombre?: string; eventId?: string; leida?: boolean; ts: number; [k: string]: unknown };
// verificaciones/{uid}
export type Verificacion = { estado: 'pendiente' | 'aprobada' | 'rechazada'; motivo?: string; ts?: number; [k: string]: unknown };

// Lo que deja la app vieja en `state` y React lee con los hooks de estado.ts
export const esOrganizacion = (p: Pick<Perfil, 'tipoCuenta'> | null | undefined) => p?.tipoCuenta === 'organizacion';
export const esCancelado = (e: Pick<Evento, 'estado'> | null | undefined) => e?.estado === 'cancelado';
