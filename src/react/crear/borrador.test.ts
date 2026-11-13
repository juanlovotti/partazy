// Pruebas de la lógica del Crear por pasos (sin dibujar nada).
import { describe, it, expect, beforeEach } from 'vitest';
import {
  borradorVacio, diasRapidos, sumarMinutos, revisarPaso, primerPasoConFalla, aDatos, camposExtraVisibles,
  configEquipos, resumen, eventoDeMuestra, elegirOcasion, faqSugeridas, cuandoTexto, type Borrador,
} from './borrador';

beforeEach(() => {
  Object.assign(window, {
    OCASIONES: { fiesta: 'Fiesta', previa: 'Previa', pena: 'Peña', deportivo: 'Deporte / Aire libre', taller: 'Taller / Curso' },
    OCASIONES_FIESTA: new Set(['', 'fiesta', 'previa', 'after', 'egresados', 'cumple']),
    ESTILOS: { techno: 'Techno', folklore: 'Folklore', otro: 'Otro' },
    FAQ_SUGERIDAS: { fiesta: ['¿Hay guardarropa?'], previa: ['¿Hay que llevar algo?'], charla: ['¿Queda grabado?'], deportivo: ['¿Hay vestuarios?'], general: ['¿Aceptan tarjeta?'] },
    MAX_FAQ: 5,
    EXTRAS_TIPO: { deportivo: [
      { k: 'deporte', l: '¿Qué deporte?' },
      { k: 'modalidad', l: 'Modalidad', t: 'sel', ops: ['Recreativo', 'Torneo / competencia'] },
      { k: 'porEquipos', l: '¿Por equipos?', t: 'sel', ops: ['No', 'Sí'], si: ['modalidad', 'Torneo / competencia'] },
    ] },
    pareceDireccion: (t: string) => /\d{2,5}/.test(t),
    datoPago: (t: string) => (/alias\s*:?\s*([\w.]{6,20})/i.exec(t) || [])[1] || '',
    linkWeb: (v: string) => /^https:\/\//.test(v) ? { url: v, texto: 'x' } : null,
  });
});
const ahora = new Date(2026, 10, 12, 19, 0).getTime();   // jueves 12 de noviembre de 2026, 19 h
const listo = (c: Partial<Borrador> = {}): Borrador => ({ ...borradorVacio(), ocasion: 'fiesta', nombre: 'Noche Vortex', fecha: '2026-11-14', hora: '23:30', lugar: 'Belgrano 800', capacidad: '300', normas: true, ...c });

describe('fechas', () => {
  it('Hoy, Mañana y el fin de semana, en orden y sin repetir', () => {
    const d = diasRapidos(new Date(ahora));
    expect(d.map(x => x.titulo)).toEqual(['Hoy', 'Mañana', 'Sábado', 'Domingo']);
    expect(d.map(x => x.fecha)).toEqual(['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
    expect(d[0].sub).toBe('jue 12');
    expect(d[2].sub).toBe('14 nov');
  });
  it('un sábado: el sábado y domingo de botones son los de la semana que viene', () => {
    const d = diasRapidos(new Date(2026, 10, 14, 10));
    expect(d.map(x => [x.titulo, x.fecha])).toEqual([['Hoy', '2026-11-14'], ['Mañana', '2026-11-15'], ['Sábado', '2026-11-21'], ['Domingo', '2026-11-22']]);
  });
  it('sumar y restar media hora da la vuelta a la medianoche', () => {
    expect(sumarMinutos('23:30', 30)).toBe('00:00');
    expect(sumarMinutos('00:00', -30)).toBe('23:30');
    expect(sumarMinutos('21:00', 360)).toBe('03:00');
  });
  it('resumen de cuándo', () => {
    expect(cuandoTexto(listo())).toBe('Sábado 14 de noviembre, a las 23:30');
    expect(cuandoTexto(listo({ conCierre: true, horaFin: '06:00' }))).toBe('Sábado 14 de noviembre, de 23:30 a 06:00');
  });
});

describe('revisar cada paso', () => {
  it('pide tipo, nombre y fecha', () => {
    expect(revisarPaso(borradorVacio(), 1, ahora)?.msj).toMatch(/tipo/);
    expect(revisarPaso({ ...borradorVacio(), ocasion: 'fiesta' }, 2, ahora)?.campo).toBe('cp-nombre');
    expect(revisarPaso(listo({ fecha: '' }), 3, ahora)?.campo).toBe('cp-dias');
    expect(revisarPaso(listo({ fecha: '2026-11-10' }), 3, ahora)?.msj).toBe('La fecha ya pasó');
    expect(revisarPaso(listo(), 3, ahora)).toBeNull();
  });
  it('previa privada: el barrio sin calle y la dirección exacta aparte', () => {
    const p = listo({ ocasion: 'previa', privada: true, lugar: 'Colón 1234', direccion: '' });
    expect(revisarPaso(p, 4, ahora)?.campo).toBe('cp-lugar');
    expect(revisarPaso({ ...p, lugar: 'Alberdi' }, 4, ahora)?.campo).toBe('cp-direccion');
    expect(revisarPaso({ ...p, lugar: 'Alberdi', direccion: 'Colón 1234' }, 4, ahora)).toBeNull();
    // Previa pública: el lugar puede tener calle
    expect(revisarPaso({ ...p, privada: false }, 4, ahora)).toBeNull();
  });
  it('entrada paga: precio, titular, alias para el comprobante y link https', () => {
    const p = listo({ pago: true, precio: '', pagoInfo: '' });
    expect(revisarPaso(p, 5, ahora)?.campo).toBe('cp-precio');
    expect(revisarPaso({ ...p, precio: '5000', cobraOtro: true }, 5, ahora)?.campo).toBe('cp-titular');
    expect(revisarPaso({ ...p, precio: '5000' }, 5, ahora)?.campo).toBe('cp-pago-info');
    expect(revisarPaso({ ...p, precio: '5000', comprobante: false }, 5, ahora)).toBeNull();
    expect(revisarPaso({ ...p, precio: '5000', pagoInfo: 'alias: mi.fiesta' }, 5, ahora)).toBeNull();
    expect(revisarPaso({ ...p, precio: '5000', linkEntradas: 'http://x.com' }, 5, ahora)?.campo).toBe('cp-link');
    expect(revisarPaso({ ...p, precio: '5000', linkEntradas: 'https://alpogo.com/x' }, 5, ahora)).toBeNull();
  });
  it('capacidad: vacía solo si vende por otra página', () => {
    expect(revisarPaso(listo({ capacidad: '' }), 6, ahora)?.campo).toBe('cp-capacidad');
    expect(revisarPaso(listo({ capacidad: '', pago: true, precio: '1', linkEntradas: 'https://alpogo.com/x' }), 6, ahora)).toBeNull();
    expect(revisarPaso(listo({ capacidad: '20001' }), 6, ahora)?.campo).toBe('cp-capacidad');
    expect(revisarPaso(listo({ inscFecha: '2026-11-20' }), 6, ahora)?.campo).toBe('cp-insc-fecha');
    expect(revisarPaso(listo({ estilo: 'otro', estiloOtro: '' }), 6, ahora)?.campo).toBe('cp-estilo-otro');
  });
  it('normas y primer paso con algo para corregir', () => {
    expect(revisarPaso(listo({ normas: false }), 7, ahora)?.campo).toBe('cp-normas');
    expect(primerPasoConFalla(listo({ nombre: ' ', capacidad: '' }), ahora)?.paso).toBe(2);
    expect(primerPasoConFalla(listo(), ahora)).toBeNull();
  });
});

describe('preguntas del tipo y equipos', () => {
  it('"¿Por equipos?" solo aparece en un torneo', () => {
    const b = listo({ ocasion: 'deportivo', extras: { modalidad: 'Recreativo', porEquipos: 'Sí' } });
    expect(camposExtraVisibles(b).map(c => c.k)).toEqual(['deporte', 'modalidad']);
    expect(configEquipos(b)).toEqual({ porEquipos: false });
    const t = { ...b, extras: { modalidad: 'Torneo / competencia', porEquipos: 'Sí' } };
    expect(camposExtraVisibles(t).map(c => c.k)).toEqual(['deporte', 'modalidad', 'porEquipos']);
    expect(configEquipos({ ...t, jugadores: '5' })).toEqual({ porEquipos: true, jugadoresPorEquipo: 5, maxEquipos: null });
    expect(configEquipos({ ...t, jugadores: '99' }).error).toMatch(/entre 1 y 50/);
    expect(aDatos({ ...b }).extras).toEqual({ modalidad: 'Recreativo' });   // la respuesta que no aplica no se guarda
  });
  it('una respuesta de opciones que no existe en el tipo nuevo no se guarda', () => {
    (window as any).EXTRAS_TIPO.taller = [{ k: 'nivel', l: 'Nivel', t: 'sel', ops: ['Sin experiencia', 'Avanzado'] }, { k: 'quien', l: '¿Quién lo da?' }];
    const b = listo({ ocasion: 'taller', extras: { nivel: 'Principiante', quien: 'Ana' } });
    expect(aDatos(b).extras).toEqual({ quien: 'Ana' });
    expect(aDatos({ ...b, extras: { nivel: 'Avanzado' } }).extras).toEqual({ nivel: 'Avanzado' });
  });
  it('Peña arranca con Folklore; las preguntas sugeridas cambian con el tipo', () => {
    expect(elegirOcasion(borradorVacio(), 'pena').estilo).toBe('folklore');
    expect(elegirOcasion({ ...borradorVacio(), estilo: 'techno' }, 'pena').estilo).toBe('techno');
    expect(faqSugeridas('previa')).toEqual(['¿Hay que llevar algo?']);
    expect(faqSugeridas('taller')).toEqual(['¿Queda grabado?']);
  });
});

describe('lo que se manda a publicar', () => {
  it('la dirección exacta solo va en una previa privada', () => {
    expect(aDatos(listo({ direccion: 'Colón 1234' })).direccion).toBe('');
    const p = aDatos(listo({ ocasion: 'previa', privada: true, lugar: 'Alberdi', direccion: 'Colón 1234' }));
    expect([p.tipo, p.privada, p.lugar, p.direccion]).toEqual(['previa', true, 'Alberdi', 'Colón 1234']);
  });
  it('limpia lo que no aplica al tipo (VIP y estilo en una previa, dress code en un taller)', () => {
    const p = aDatos(listo({ ocasion: 'previa', vipOn: true, vipTxt: 'Sofi', estilo: 'techno', musica: 'cumbia' }));
    expect([p.vipOn, p.estilo, p.musica]).toEqual([false, '', 'cumbia']);
    const t = aDatos(listo({ ocasion: 'taller', dresscode: 'Negro', estilo: 'techno' }));
    expect([t.dresscode, t.estilo]).toEqual(['', '']);
    const f = aDatos(listo({ vipOn: true, vipTxt: ' Sofía Gómez \n\nIvo Paz +1 ', musica: 'no va' }));
    expect([f.vipOn, f.vip, f.musica]).toEqual([true, ['Sofía Gómez', 'Ivo Paz +1'], '']);
  });
  it('solo pagos con entrada paga; preguntas frecuentes completas', () => {
    const d = aDatos(listo({ pago: false, precio: '5000', pagoInfo: 'alias: x', linkEntradas: 'https://a.com' }));
    expect([d.precio, d.pagoInfo, d.linkEntradas]).toEqual(['', '', '']);
    const q = aDatos(listo({ faq: [{ p: ' ¿Hay  guardarropa? ', r: 'Sí' }, { p: '¿Reingreso?', r: '' }] }));
    expect(q.faq).toEqual([{ p: '¿Hay guardarropa?', r: 'Sí' }]);
  });
  it('la tarjeta de muestra y el resumen', () => {
    const b = listo({ pago: true, precio: '15000', pagoInfo: 'alias: partazyproductora', ocasion: 'fiesta', dresscode: 'Libre', estilo: 'techno' });
    const ev = eventoDeMuestra(b, 'L');
    expect([ev.id, ev.nombre, ev.creador, ev.privacidad, ev.fechaTs]).toEqual(['vista-previa', 'Noche Vortex', 'L', 'publica', new Date(2026, 10, 14, 23, 30).getTime()]);
    const sinTope = eventoDeMuestra(listo({ capacidad: '', pago: true, precio: '1', linkEntradas: 'https://alpogo.com/x' }), 'L');
    expect([sinTope.capacidad, sinTope.capacidadDesconocida]).toEqual([20000, true]);   // la tarjeta de muestra no dice "Agotado"
    const r = resumen(b);
    expect(r.find(x => x.titulo === 'Entrada')?.texto).toBe('$15.000, con comprobante a partazyproductora');
    expect(r.find(x => x.titulo === 'Detalles')?.texto).toBe('Dress code libre, Techno');
    expect(r.map(x => x.texto).join(' ')).not.toMatch(/[·•]/);
  });
});
