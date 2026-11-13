// Lo que se va completando en el Crear por pasos, y la lógica que no dibuja nada (se prueba aparte).
// La validación final y el guardado los hace la app vieja (publicarConDatos), igual que con el formulario de siempre:
// acá solo se revisa cada paso antes de pasar al siguiente, con los mismos mensajes.
import { crearLegado, type DatosCrear, type Faq, type Punto, type ConfigEquipos, type CampoExtra } from '../legado';

export type Foto = { nueva: string; mini: string };
export type Borrador = {
  ocasion: string;
  nombre: string; descripcion: string; foto: Foto | null;
  fecha: string; hora: string; conCierre: boolean; horaFin: string;
  lugar: string; direccion: string; privada: boolean; ubicacion: Punto | null; ubicacionTxt: string;
  ubicacionDeSugerencia: boolean;   // si vino de una sugerencia, escribir otro lugar la borra (como en el formulario de siempre)
  pago: boolean; precio: string; pagoInfo: string; cobraOtro: boolean; pagoTitular: string; comprobante: boolean; linkEntradas: string;
  capacidad: string; edad: string; qr: boolean;
  dresscode: string; estilo: string; estiloOtro: string; musica: string; lineup: string; reglas: string;
  faq: Faq[]; vipOn: boolean; vipTxt: string; inscFecha: string; inscHora: string; bebida: boolean;
  extras: Record<string, string>; jugadores: string; maxEquipos: string;
  normas: boolean;
};

export const PASOS = 7;
export const borradorVacio = (): Borrador => ({
  ocasion: '',
  nombre: '', descripcion: '', foto: null,
  fecha: '', hora: '22:00', conCierre: false, horaFin: '',
  lugar: '', direccion: '', privada: true, ubicacion: null, ubicacionTxt: '', ubicacionDeSugerencia: false,
  pago: false, precio: '', pagoInfo: '', cobraOtro: false, pagoTitular: '', comprobante: true, linkEntradas: '',
  capacidad: '', edad: '18', qr: true,
  dresscode: '', estilo: '', estiloOtro: '', musica: '', lineup: '', reglas: '',
  faq: [], vipOn: false, vipTxt: '', inscFecha: '', inscHora: '', bebida: true,
  extras: {}, jugadores: '', maxEquipos: '',
  normas: false,
});

// ---------- Tipo de evento ----------
export const esPrevia = (b: Pick<Borrador, 'ocasion'>) => b.ocasion === 'previa';
export const sinMusica = (oc: string) => ['charla', 'taller'].includes(oc);
export const conDresscode = (oc: string) => !['deportivo', 'feria', 'charla', 'taller'].includes(oc);
export const conVip = (oc: string) => oc !== 'previa' && crearLegado.OCASIONES_FIESTA.has(oc || '');
export const conEstilo = (oc: string) => oc !== 'previa' && !sinMusica(oc);
// "Line-up" o "Cronograma", según el tipo (como en el formulario de siempre)
export function etiquetaLineup(oc: string){
  const crono = ({ charla: 'Cronograma', taller: 'Cronograma', deportivo: 'Cronograma', feria: 'Horarios y actividades', cultural: 'Programa', gastronomico: 'Pasos o momentos' } as Record<string, string>)[oc];
  const ej = ({ pena: '22:00 Guitarreros invitados\n23:30 Ballet folklórico', musical: '21:00 Banda soporte\n22:30 Banda principal' } as Record<string, string>)[oc] || '23:30 DJ Invitado\n01:00 Banda principal';
  return { titulo: crono || 'Line-up', ejemplo: crono ? 'Un renglón por momento. Podés poner la hora:\n18:00 Apertura\n18:30 Primera parte' : 'Un artista por renglón. Podés poner la hora:\n' + ej };
}
export function faqSugeridas(oc: string){
  const S = crearLegado.FAQ_SUGERIDAS;
  if(oc === 'previa') return S.previa;
  if(['charla', 'taller'].includes(oc)) return S.charla;
  if(oc === 'deportivo') return S.deportivo;
  if(crearLegado.OCASIONES_FIESTA.has(oc) || ['pena', 'musical'].includes(oc)) return S.fiesta;
  return S.general;
}
// Al elegir el tipo: Peña arranca con Folklore (como antes); lo que no aplica se limpia al publicar.
export function elegirOcasion(b: Borrador, oc: string): Borrador {
  const nuevo = { ...b, ocasion: oc };
  if(oc === 'pena' && !b.estilo) nuevo.estilo = 'folklore';
  return nuevo;
}

// ---------- Preguntas extra del tipo (EXTRAS_TIPO) ----------
// Solo las que aplican (ej. "¿Se juega por equipos?" solo si la modalidad es Torneo).
export function camposExtraVisibles(b: Borrador): CampoExtra[] {
  const campos = crearLegado.EXTRAS_TIPO[b.ocasion] || [];
  const visibles: CampoExtra[] = [];
  for(const c of campos){
    if(c.si && !(visibles.some(v => v.k === c.si![0]) && b.extras[c.si[0]] === c.si[1])) continue;
    visibles.push(c);
  }
  return visibles;
}
export const conEquipos = (b: Borrador) => camposExtraVisibles(b).some(c => c.k === 'porEquipos') && b.extras.porEquipos === 'Sí';
// Lo mismo para mostrar: el valor de un campo de opciones solo si es una opción del tipo actual
export const valorExtra = (b: Borrador, c: CampoExtra) => extrasLimpios(b)[c.k] || (c.t === 'sel' || c.t === 'multi' ? '' : String(b.extras[c.k] || ''));
export function configEquipos(b: Borrador): ConfigEquipos {
  if(!conEquipos(b)) return { porEquipos: false };
  const num = (v: string) => v.trim() === '' ? null : Number(v);
  const j = num(b.jugadores), m = num(b.maxEquipos);
  if(j !== null && !(Number.isInteger(j) && j >= 1 && j <= 50)) return { porEquipos: false, error: 'Jugadores por equipo: entre 1 y 50', foco: 'f-jugadores-equipo' };
  if(m !== null && !(Number.isInteger(m) && m >= 2 && m <= 64)) return { porEquipos: false, error: 'Máximo de equipos: entre 2 y 64 (o dejalo vacío)', foco: 'f-max-equipos' };
  return { porEquipos: true, jugadoresPorEquipo: j, maxEquipos: m };
}
// Solo las respuestas que aplican al tipo elegido. En las de opciones, solo opciones de ese tipo
// (si cambiás de Deporte a Taller, el "Nivel: Principiante" de Deporte no vale para Taller).
export function extrasLimpios(b: Borrador){
  const out: Record<string, string> = {};
  for(const c of camposExtraVisibles(b)){
    let v = String(b.extras[c.k] || '').trim();
    if(c.t === 'sel' && !(c.ops || []).includes(v)) v = '';
    if(c.t === 'multi') v = (c.ops || []).filter(o => v.split(',').map(x => x.trim()).includes(o)).join(', ');
    if(v) out[c.k] = v.slice(0, 120);
  }
  return out;
}

// ---------- Fechas ----------
const dos = (n: number) => String(n).padStart(2, '0');
export const aFechaInput = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
export function deFechaInput(f: string){ const [y, m, d] = f.split('-').map(Number); return new Date(y, m - 1, d); }
export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
// Botones rápidos: Hoy, Mañana y el próximo fin de semana (sin repetir días).
export function diasRapidos(ahora = new Date()){
  const base = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const mas = (n: number) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);
  const lista = [{ titulo: 'Hoy', d: base }, { titulo: 'Mañana', d: mas(1) }];
  for(const dia of [6, 0]){
    let n = (dia - base.getDay() + 7) % 7;
    if(n < 2) n += 7;   // si es hoy o mañana ya está arriba: el de la semana que viene
    lista.push({ titulo: dia === 6 ? 'Sábado' : 'Domingo', d: mas(n) });
  }
  return lista.sort((a, b) => a.d.getTime() - b.d.getTime()).map(x => ({ titulo: x.titulo, fecha: aFechaInput(x.d), sub: x.titulo === 'Hoy' || x.titulo === 'Mañana' ? `${DIAS[x.d.getDay()].slice(0, 3)} ${x.d.getDate()}` : `${x.d.getDate()} ${MESES[x.d.getMonth()].slice(0, 3)}` }));
}
export function fechaLarga(f: string){
  if(!f) return '';
  const d = deFechaInput(f);
  return `${DIAS[d.getDay()][0].toUpperCase() + DIAS[d.getDay()].slice(1)} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}
// "sáb 14 nov"
export function fechaCorta(f: string){
  if(!f) return '';
  const d = deFechaInput(f);
  return `${DIAS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`;
}
export function cuandoTexto(b: Borrador){
  if(!b.fecha) return '';
  return `${fechaLarga(b.fecha)}, ${b.conCierre && b.horaFin ? `de ${b.hora} a ${b.horaFin}` : `a las ${b.hora}`}`;
}
export function sumarMinutos(hora: string, min: number){
  const [h, m] = (hora || '22:00').split(':').map(Number);
  const t = ((h * 60 + m + min) % 1440 + 1440) % 1440;
  return `${dos(Math.floor(t / 60))}:${dos(t % 60)}`;
}
export function fechaTs(b: Pick<Borrador, 'fecha' | 'hora'>){
  if(!b.fecha) return NaN;
  const [y, m, d] = b.fecha.split('-').map(Number), [hh, mm] = (b.hora || '22:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
}

// ---------- Revisar un paso antes de seguir ----------
// Devuelve el mensaje y el campo a enfocar, o null si está todo bien.
export type Falla = { msj: string; campo: string } | null;
export function revisarPaso(b: Borrador, paso: number, ahora = Date.now()): Falla {
  const f = (msj: string, campo: string) => ({ msj, campo });
  if(paso === 1 && !b.ocasion) return f('Elegí qué tipo de evento es', 'cp-tipos');
  if(paso === 2 && !b.nombre.trim()) return f('Ponele un nombre al evento', 'cp-nombre');
  if(paso === 3){
    if(!b.fecha) return f('Elegí la fecha', 'cp-dias');
    const ts = fechaTs(b);
    if(isNaN(ts) || ts < ahora - 60000) return f('La fecha ya pasó', 'cp-hora');
    if(b.conCierre && !/^\d{2}:\d{2}$/.test(b.horaFin)) return f('Poné la hora de cierre (o apagá "¿Tiene hora de cierre?")', 'cp-hora-fin');
  }
  if(paso === 4){
    const privada = esPrevia(b) && b.privada;
    if(!b.lugar.trim()) return f(privada ? 'Indicá el barrio o zona' : 'Indicá el lugar', 'cp-lugar');
    if(privada && crearLegado.pareceDireccion(b.lugar)) return f('En una previa privada, acá va solo el barrio (lo ve todo el mundo). La calle y el número van en "Dirección exacta".', 'cp-lugar');
    if(privada && !b.direccion.trim()) return f('Indicá la dirección exacta (solo la ven los aprobados)', 'cp-direccion');
  }
  if(paso === 5 && b.pago){
    const precio = parseInt(b.precio, 10);
    if(!precio || precio < 1) return f('Ingresá un precio válido', 'cp-precio');
    if(b.cobraOtro && !b.pagoTitular.trim()) return f('Poné el nombre del titular de la cuenta', 'cp-titular');
    const link = b.linkEntradas.trim();
    if(link && !crearLegado.linkWeb(link)) return f('El link de venta tiene que ser una dirección https://', 'cp-link');
    if(!link && b.comprobante && !crearLegado.datoPago(b.pagoInfo)) return f('Para cobrar con comprobante, poné tu alias o CBU', 'cp-pago-info');
  }
  if(paso === 6){
    const sinTope = !b.capacidad.trim() && b.pago && !!b.linkEntradas.trim();
    const cap = parseInt(b.capacidad, 10);
    if(!sinTope && (!cap || cap < 2 || cap > 20000)) return f(b.pago ? 'Capacidad entre 2 y 20.000 (si vendés por otra página y no sabés el tope, poné el link y dejala vacía)' : 'Capacidad entre 2 y 20.000 personas', 'cp-capacidad');
    const edad = b.edad.trim() === '' ? 18 : parseInt(b.edad, 10);
    if(isNaN(edad) || edad < 0 || edad > 99) return f('Edad mínima inválida', 'cp-edad');
    if(conEstilo(b.ocasion) && b.estilo === 'otro' && !b.estiloOtro.trim()) return f('Escribí qué estilo de música va a sonar', 'cp-estilo-otro');
    if(b.inscFecha){
      const [iy, im, id] = b.inscFecha.split('-').map(Number), [ih, imi] = (b.inscHora || '23:59').split(':').map(Number);
      const hasta = new Date(iy, im - 1, id, ih, imi, 0, 0).getTime();
      if(isNaN(hasta) || hasta > fechaTs(b)) return f('La fecha límite para anotarse tiene que ser antes del evento', 'cp-insc-fecha');
    }
    const eq = configEquipos(b);
    if(eq.error) return f(eq.error, eq.foco === 'f-max-equipos' ? 'cp-max-equipos' : 'cp-jugadores');
  }
  if(paso === 7 && !b.normas) return f('Para publicar, aceptá las normas de la comunidad', 'cp-normas');
  return null;
}
// El primer paso que tiene algo para corregir (para "Publicar" desde el paso 7).
export function primerPasoConFalla(b: Borrador, ahora = Date.now()){
  for(let p = 1; p <= PASOS; p++){ const r = revisarPaso(b, p, ahora); if(r) return { paso: p, ...r }; }
  return null;
}

// Campo del formulario de siempre (los errores de publicarConDatos) → paso y campo del Crear por pasos.
export const CAMPO_LEGADO: Record<string, [number, string]> = {
  'f-nombre': [2, 'cp-nombre'], 'f-descripcion': [2, 'cp-descripcion'],
  'f-fecha': [3, 'cp-dias'], 'f-hora': [3, 'cp-hora'], 'f-hora-fin': [3, 'cp-hora-fin'],
  'f-lugar': [4, 'cp-lugar'], 'f-direccion': [4, 'cp-direccion'],
  'f-precio': [5, 'cp-precio'], 'f-pago-info': [5, 'cp-pago-info'], 'f-pago-titular': [5, 'cp-titular'], 'f-link-entradas': [5, 'cp-link'],
  'f-capacidad': [6, 'cp-capacidad'], 'f-edad': [6, 'cp-edad'], 'f-estilo-otro': [6, 'cp-estilo-otro'], 'f-insc-fecha': [6, 'cp-insc-fecha'],
  'f-jugadores-equipo': [6, 'cp-jugadores'], 'f-max-equipos': [6, 'cp-max-equipos'],
};

// ---------- Lo que se le pasa a la app vieja para publicar ----------
export function aDatos(b: Borrador): DatosCrear {
  const previa = esPrevia(b);
  return {
    tipo: previa ? 'previa' : 'fiesta', privada: previa && b.privada, ocasion: b.ocasion,
    nombre: b.nombre.trim(), descripcion: b.descripcion.trim(),
    lugar: b.lugar.trim(), direccion: previa && b.privada ? b.direccion.trim() : '', ubicacionMapa: b.ubicacion,
    fecha: b.fecha, hora: b.hora, horaFin: b.conCierre ? b.horaFin : '', inscFecha: b.inscFecha, inscHora: b.inscFecha ? b.inscHora : '',
    capacidad: b.capacidad.trim(), edad: b.edad.trim(),
    pago: b.pago, precio: b.pago ? b.precio.trim() : '', pagoInfo: b.pago ? b.pagoInfo.trim() : '', cobraOtro: b.pago && b.cobraOtro,
    pagoTitular: b.pago && b.cobraOtro ? b.pagoTitular.trim() : '', linkEntradas: b.pago ? b.linkEntradas.trim() : '', comprobante: b.comprobante,
    estilo: conEstilo(b.ocasion) ? b.estilo : '', estiloOtro: conEstilo(b.ocasion) && b.estilo === 'otro' ? b.estiloOtro.trim() : '',
    musica: previa ? b.musica.trim() : '',
    lineup: b.lineup.trim(), dresscode: conDresscode(b.ocasion) ? b.dresscode.trim() : '', reglas: b.reglas.trim(),
    faq: b.faq.map(x => ({ p: x.p.trim().replace(/\s+/g, ' ').slice(0, 120), r: x.r.trim().slice(0, 300) })).filter(x => x.p && x.r).slice(0, crearLegado.MAX_FAQ),
    equipos: configEquipos(b), extras: extrasLimpios(b),
    vipOn: conVip(b.ocasion) && b.vipOn, vip: b.vipTxt.split('\n').map(x => x.trim().slice(0, 60)).filter(Boolean).slice(0, 300),
    bebida: previa && b.bebida, qr: b.qr,
    imagenNueva: b.foto?.nueva || null, imagenMini: b.foto?.mini || null,
    editando: null,
  };
}

// El evento como lo va a ver la gente (para la tarjeta del último paso).
export function eventoDeMuestra(b: Borrador, uid: string | null): Record<string, unknown> {
  const previa = esPrevia(b);
  const sinTope = !b.capacidad.trim() && b.pago && !!b.linkEntradas.trim();   // como lo guarda publicarConDatos
  return {
    id: 'vista-previa', nombre: b.nombre.trim() || 'Tu evento', ocasion: b.ocasion, tipo: previa ? 'previa' : 'fiesta', tipoLugar: previa ? 'Previa' : 'Fiesta',
    privacidad: previa && b.privada ? 'privada' : 'publica', creador: uid, lugar: b.lugar.trim(), fechaTs: fechaTs(b),
    imagen: b.foto?.mini || b.foto?.nueva || '', capacidad: sinTope ? 20000 : parseInt(b.capacidad, 10) || 0, capacidadDesconocida: sinTope,
    linkEntradas: b.pago ? b.linkEntradas.trim() : '', confirmadosCount: 1, estado: 'publicado',
  };
}

// Resumen de cada paso para "¿Todo listo?"
const pesos = (n: string) => '$' + Number(n || 0).toLocaleString('es-AR');
export function resumen(b: Borrador): { paso: number; titulo: string; texto: string }[] {
  const previa = esPrevia(b);
  const tipo = crearLegado.OCASIONES[b.ocasion] || 'Sin elegir';
  const donde = previa && b.privada ? `${b.lugar.trim()} (la dirección exacta solo la ven los que apruebes)` : b.lugar.trim();
  const entrada = !b.pago ? 'Gratis'
    : b.linkEntradas.trim() ? `${pesos(b.precio)}, venta en otra página`
    : b.comprobante ? `${pesos(b.precio)}, con comprobante a ${crearLegado.datoPago(b.pagoInfo) || b.pagoInfo.trim()}`
    : `${pesos(b.precio)}${b.pagoInfo.trim() ? `, ${b.pagoInfo.trim()}` : ''}`;
  const edad = b.edad === '0' ? 'todo público' : `+${b.edad || 18}`;
  const lugares = b.capacidad.trim() ? `${Number(b.capacidad).toLocaleString('es-AR')} personas, ${edad}` : `Según la venta, ${edad}`;
  const det = [
    conDresscode(b.ocasion) && b.dresscode.trim() ? `Dress code ${b.dresscode.trim().toLowerCase()}` : '',
    conEstilo(b.ocasion) && b.estilo ? (b.estilo === 'otro' ? b.estiloOtro.trim() : crearLegado.ESTILOS[b.estilo]) : '',
    previa && b.musica.trim() ? b.musica.trim() : '',
    b.lineup.trim() ? etiquetaLineup(b.ocasion).titulo : '',
    b.faq.some(x => x.p.trim() && x.r.trim()) ? 'Preguntas frecuentes' : '',
    conVip(b.ocasion) && b.vipOn ? 'Lista VIP' : '',
    b.inscFecha ? 'Fecha límite para anotarse' : '',
    previa && b.bebida ? 'Cada uno lleva su bebida' : '',
  ].filter(Boolean);
  return [
    { paso: 1, titulo: 'Tipo', texto: tipo },
    { paso: 2, titulo: 'Nombre', texto: b.nombre.trim() + (b.foto ? ', con foto' : ', sin foto (usamos la portada del tipo)') },
    { paso: 3, titulo: 'Cuándo', texto: cuandoTexto(b) },
    { paso: 4, titulo: 'Dónde', texto: donde },
    { paso: 5, titulo: 'Entrada', texto: entrada },
    { paso: 6, titulo: 'Lugares', texto: lugares },
    ...(det.length ? [{ paso: 6, titulo: 'Detalles', texto: det.join(', ') }] : []),
  ];
}
