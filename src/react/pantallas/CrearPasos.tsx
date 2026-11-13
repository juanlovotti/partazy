// Crear evento por pasos (diseño "conversacional" elegido en Superdesign, nov 2026): un tema por pantalla,
// título grande, "Siguiente" fijo abajo y una revisión final con la tarjeta tal como la va a ver la gente.
// Se dibuja solo con el interruptor "crear" prendido (ver src/react/interruptores.ts) y solo para eventos nuevos:
// editar un evento sigue en el formulario de siempre. Valida y guarda la app vieja (publicarConDatos),
// así las reglas son las mismas en los dos formularios.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { legado, navegar, crearLegado, alAbrirPantalla, type LugarSugerido } from '../legado';
import { useSesion } from '../estado';
import {
  PASOS, borradorVacio, elegirOcasion, esPrevia, conDresscode, conEstilo, conVip, etiquetaLineup, faqSugeridas,
  camposExtraVisibles, conEquipos, valorExtra, diasRapidos, fechaLarga, fechaCorta, cuandoTexto, sumarMinutos, revisarPaso,
  primerPasoConFalla, CAMPO_LEGADO, aDatos, eventoDeMuestra, resumen, type Borrador,
} from '../crear/borrador';
import { teselas } from '../crear/mapa';
import { Icono, IconoTipo } from '../crear/iconos';
import './CrearPasos.css';

type Cambiar = (c: Partial<Borrador>) => void;
type PasoProps = { b: Borrador; cambiar: Cambiar };

const TITULOS: Record<number, [string, string]> = {
  1: ['¿Qué vas a organizar?', 'Elegí el tipo y te hacemos solo las preguntas que importan.'],
  2: ['¿Cómo se llama?', ''],
  3: ['¿Cuándo es?', ''],
  4: ['¿Dónde es?', 'Calle y número, o el nombre del lugar. Así nadie se pierde.'],
  5: ['La entrada es...', ''],
  6: ['¿Cuántos entran?', ''],
  7: ['¿Todo listo?', 'Así lo va a ver la gente.'],
};

export default function CrearPasos(){
  const { uid, perfil } = useSesion();
  const [b, setB] = useState<Borrador>(borradorVacio);
  const [paso, setPaso] = useState(1);
  const [publicando, setPublicando] = useState(false);
  const [revisandoFoto, setRevisandoFoto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const focoPendiente = useRef<string | null>(null);
  const callado = useRef(true);   // al montar (y al terminar de publicar) no se mueve el foco
  const cambiar: Cambiar = c => setB(x => ({ ...x, ...c }));

  // Si entra otra cuenta, el borrador arranca de cero
  const uidAnterior = useRef(uid);
  useEffect(() => {
    if(uidAnterior.current !== uid){
      uidAnterior.current = uid; setB(borradorVacio());
      setPaso(p => { if(p !== 1) callado.current = true; return 1; });   // si ya estaba en el paso 1, no hay cambio que "callar"
    }
  }, [uid]);
  // Cada vez que se abre, arriba de todo
  useEffect(() => alAbrirPantalla('crear', () => { raiz.current?.closest('.screen')?.scrollTo?.({ top: 0 }); }), []);

  // Al cambiar de paso: arriba de todo y el foco en el título (o en el campo que hay que corregir)
  useEffect(() => {
    if(callado.current){ callado.current = false; return; }
    const pantalla = raiz.current?.closest('.screen') as HTMLElement | null;
    if(pantalla){ if(pantalla.scrollTo) pantalla.scrollTo({ top: 0 }); else pantalla.scrollTop = 0; }
    const id = focoPendiente.current; focoPendiente.current = null;
    const campo = id ? document.getElementById(id) : null;
    (campo || titulo.current)?.focus();
  }, [paso]);

  function irA(p: number, campo?: string){
    if(p === paso){ if(campo) document.getElementById(campo)?.focus(); return; }
    focoPendiente.current = campo || null;
    setPaso(p);
  }
  function siguiente(){
    const f = revisarPaso(b, paso);
    if(f){ legado.toast(f.msj); irA(paso, f.campo); return; }
    if(paso < PASOS) setPaso(paso + 1);
    else publicar();
  }
  async function publicar(){
    const f = primerPasoConFalla(b);
    if(f){ legado.toast(f.msj); irA(f.paso, f.campo); return; }
    await crearLegado.publicar(aDatos(b), {
      vistaPrevia: false,
      enfocar(campo){ const m = CAMPO_LEGADO[campo]; if(m) irA(m[0], m[1]); },
      ocupado: setPublicando,
      listo(){ setB(borradorVacio()); setPaso(p => { if(p !== 1) callado.current = true; return 1; }); },
    });
  }
  function atras(){ if(paso > 1) setPaso(paso - 1); else navegar.volver('home'); }

  const [tit, sub] = TITULOS[paso];
  const tipoTxt = crearLegado.OCASIONES[b.ocasion] || '';
  const subCabecera = [tipoTxt, b.fecha ? fechaCorta(b.fecha) : ''].filter(Boolean).join(', ');
  const ultimo = paso === PASOS;

  return (
    <div className="cp" ref={raiz}>
      <header className="cp-cab">
        <button type="button" className="icon-btn cp-cab-btn" onClick={atras} aria-label={paso > 1 ? 'Volver al paso anterior' : 'Cerrar'}>
          <Icono n={paso > 1 ? 'atras' : 'cerrar'} tam={18} />
        </button>
        <div className="cp-mini" aria-hidden="true">
          <div className="cp-mini-foto" style={b.foto ? { backgroundImage: `url("${b.foto.mini}")` } : undefined}>{!b.foto && b.ocasion ? <IconoTipo k={b.ocasion} tam={18} /> : null}</div>
          <div className="cp-mini-txt"><b>{b.nombre.trim() || 'Tu evento'}</b><span>{subCabecera || 'Crear evento'}</span></div>
        </div>
      </header>
      <div className="cp-progreso" role="progressbar" aria-label="Pasos para crear el evento" aria-valuemin={1} aria-valuemax={PASOS} aria-valuenow={paso} aria-valuetext={`Paso ${paso} de ${PASOS}`}>
        <div style={{ width: `${(paso / PASOS) * 100}%` }} />
      </div>
      <main className="cp-cuerpo">
        <div className="cp-titulo">
          <div className="cp-num">{paso} / {PASOS}</div>
          <h2 ref={titulo} tabIndex={-1}>{tit}</h2>
          {sub ? <p>{sub}</p> : null}
        </div>
        {paso === 1 && <PasoTipo b={b} setB={setB} />}
        {paso === 2 && <PasoNombre b={b} cambiar={cambiar} revisando={revisandoFoto} setRevisando={setRevisandoFoto} />}
        {paso === 3 && <PasoCuando b={b} cambiar={cambiar} />}
        {paso === 4 && <PasoDonde b={b} cambiar={cambiar} />}
        {paso === 5 && <PasoEntrada b={b} cambiar={cambiar} />}
        {paso === 6 && <PasoLugares b={b} cambiar={cambiar} esOrg={crearLegado.esOrganizacion(perfil)} />}
        {paso === 7 && <PasoListo b={b} cambiar={cambiar} uid={uid} irA={irA} />}
      </main>
      <div className="cp-pie">
        <button type="button" className="btn btn-primario cp-siguiente" onClick={siguiente} disabled={publicando || revisandoFoto}>
          {publicando ? 'Publicando...' : revisandoFoto ? 'Revisando la foto...' : ultimo ? 'Publicar evento' : 'Siguiente'}
        </button>
      </div>
    </div>
  );
}

// ---------- Piezas chicas ----------
function Interruptor({ on, alCambiar, etiqueta, id }: { on: boolean; alCambiar: (v: boolean) => void; etiqueta: string; id?: string }){
  return <button type="button" id={id} className={'switch' + (on ? ' on' : '')} role="switch" aria-checked={on} aria-label={etiqueta} onClick={() => alCambiar(!on)}><span className="bola" /></button>;
}
function FilaInterruptor({ titulo, texto, on, alCambiar, id }: { titulo: string; texto?: ReactNode; on: boolean; alCambiar: (v: boolean) => void; id?: string }){
  return (
    <div className="switch-row cp-fila-switch">
      <div className="txt">{titulo}{texto ? <small>{texto}</small> : null}</div>
      <Interruptor on={on} alCambiar={alCambiar} etiqueta={titulo} id={id} />
    </div>
  );
}
function Campo({ id, etiqueta, children, ayuda, opcional }: { id: string; etiqueta: string; children: ReactNode; ayuda?: ReactNode; opcional?: boolean }){
  return (
    <div className="campo cp-campo">
      <label htmlFor={id}>{etiqueta}{opcional ? <span className="cp-opcional"> (opcional)</span> : null}</label>
      {children}
      {ayuda ? <div className="ayuda">{ayuda}</div> : null}
    </div>
  );
}

// ---------- 1. Tipo ----------
function PasoTipo({ b, setB }: { b: Borrador; setB: (fn: (x: Borrador) => Borrador) => void }){
  return (
    <div className="cp-tipos" id="cp-tipos" role="group" aria-label="Tipo de evento" tabIndex={-1}>
      {crearLegado.TIPOS_NUEVOS.map(k => (
        <button type="button" key={k} className={'cp-tipo' + (b.ocasion === k ? ' on' : '')} aria-pressed={b.ocasion === k} onClick={() => setB(x => elegirOcasion(x, k))}>
          <IconoTipo k={k} /><span>{crearLegado.OCASIONES[k]}</span>
        </button>
      ))}
    </div>
  );
}

// ---------- 2. Nombre, foto y descripción ----------
function PasoNombre({ b, cambiar, revisando, setRevisando }: PasoProps & { revisando: boolean; setRevisando: (v: boolean) => void }){
  const tipo = (crearLegado.OCASIONES[b.ocasion] || 'el tipo de evento');
  async function elegirFoto(input: HTMLInputElement){
    const file = input.files?.[0];
    if(!file) return;
    setRevisando(true);
    try{
      const nueva = await crearLegado.prepararFoto(file);
      const mini = await crearLegado.miniaturaDe(nueva);
      cambiar({ foto: { nueva, mini } });
    } catch(e){
      legado.toast((e as Error)?.message || 'No pudimos procesar esa imagen');
    } finally { setRevisando(false); input.value = ''; }
  }
  return (<>
    <div className="cp-campo-grande">
      <label htmlFor="cp-nombre">Nombre del evento</label>
      <input id="cp-nombre" type="text" maxLength={80} value={b.nombre} onChange={e => cambiar({ nombre: e.target.value })} autoComplete="off" aria-describedby="cp-nombre-ayuda" />
      <div className="cp-contador" id="cp-nombre-ayuda"><span>Ej.: Noche Vortex, Torneo de pádel, Taller de cerámica</span><span>{b.nombre.length}/80</span></div>
    </div>
    <h3 className="cp-subtit">Una foto real</h3>
    <input type="file" accept="image/*" id="cp-foto" className="cp-oculto" onChange={e => elegirFoto(e.currentTarget)} />
    {b.foto ? (
      <div className="cp-foto-lista">
        <img src={b.foto.nueva} alt="Foto del evento" />
        <div className="cp-foto-acciones">
          <label htmlFor="cp-foto" className="btn btn-secundario btn-mini"><Icono n="foto" tam={16} />Cambiar foto</label>
          <button type="button" className="btn btn-secundario btn-mini" onClick={() => cambiar({ foto: null })}>Quitar</button>
        </div>
      </div>
    ) : (
      <label htmlFor="cp-foto" className="cp-foto-subir">
        <Icono n="foto" tam={26} />
        <b>{revisando ? 'Revisando la foto... (la primera vez tarda unos segundos)' : 'Tocá para subir una foto'}</b>
      </label>
    )}
    <p className="cp-nota">El lugar, la barra o una edición anterior: las fotos reales generan más confianza que un flyer. Si no subís ninguna, armamos una portada con el diseño de {tipo}.</p>
    <Campo id="cp-descripcion" etiqueta="¿De qué se trata?" opcional>
      <textarea id="cp-descripcion" maxLength={800} rows={3} placeholder="Qué va a haber, para quién es..." value={b.descripcion} onChange={e => cambiar({ descripcion: e.target.value })} />
    </Campo>
  </>);
}

// ---------- 3. Cuándo ----------
const HORAS_RAPIDAS = ['20:00', '21:00', '22:00', '23:00', '00:00'];
function PasoCuando({ b, cambiar }: PasoProps){
  const rapidos = diasRapidos();
  const esRapida = rapidos.some(r => r.fecha === b.fecha);
  const [otra, setOtra] = useState(!!b.fecha && !esRapida);
  const [otraHora, setOtraHora] = useState(false);
  const madrugada = b.fecha && /^0[0-5]:/.test(b.hora);
  return (<>
    <div className="cp-dias" id="cp-dias" role="group" aria-label="Día" tabIndex={-1}>
      {rapidos.map(r => (
        <button type="button" key={r.fecha} className={'cp-dia' + (b.fecha === r.fecha && !otra ? ' on' : '')} aria-pressed={b.fecha === r.fecha && !otra} onClick={() => { setOtra(false); cambiar({ fecha: r.fecha }); }}>
          <b>{r.titulo}</b><span>{r.sub}</span>
        </button>
      ))}
      <button type="button" className={'cp-dia cp-dia-otra' + (otra ? ' on' : '')} aria-pressed={otra} onClick={() => { setOtra(true); setTimeout(() => document.getElementById('cp-fecha')?.focus(), 0); }}>
        <Icono n="calendario" tam={18} /><b>Otra fecha</b>
      </button>
    </div>
    {otra ? (
      <Campo id="cp-fecha" etiqueta="Fecha">
        <input id="cp-fecha" type="date" value={b.fecha} onChange={e => cambiar({ fecha: e.target.value })} />
      </Campo>
    ) : null}
    <div className="cp-etiqueta" id="cp-hora-tit">¿A qué hora empieza?</div>
    <div className="cp-contador-grande" role="group" aria-labelledby="cp-hora-tit">
      <button type="button" className="cp-redondo" aria-label="Media hora antes" onClick={() => cambiar({ hora: sumarMinutos(b.hora, -30) })}><Icono n="menos" /></button>
      <output id="cp-hora" className="cp-numero-grande cp-hora-txt" tabIndex={-1} aria-live="polite">{b.hora}</output>
      <button type="button" className="cp-redondo" aria-label="Media hora después" onClick={() => cambiar({ hora: sumarMinutos(b.hora, 30) })}><Icono n="mas" /></button>
    </div>
    <div className="cp-chips" role="group" aria-label="Horarios comunes">
      {HORAS_RAPIDAS.map(h => <button type="button" key={h} className={'chip' + (b.hora === h && !otraHora ? ' activo' : '')} aria-pressed={b.hora === h && !otraHora} onClick={() => { setOtraHora(false); cambiar({ hora: h }); }}>{h}</button>)}
      <button type="button" className={'chip' + (otraHora ? ' activo' : '')} aria-pressed={otraHora} onClick={() => { setOtraHora(true); setTimeout(() => document.getElementById('cp-hora-exacta')?.focus(), 0); }}>Otra hora</button>
    </div>
    {otraHora ? (
      <Campo id="cp-hora-exacta" etiqueta="Hora exacta">
        <input id="cp-hora-exacta" type="time" value={b.hora} onChange={e => { if(e.target.value) cambiar({ hora: e.target.value }); }} />
      </Campo>
    ) : null}
    {madrugada ? <p className="cp-nota cp-nota-ojo">Ojo: a las {b.hora} del {fechaLarga(b.fecha).toLowerCase()} es la madrugada de ese día (la noche anterior).</p> : null}
    <FilaInterruptor titulo="¿Tiene hora de cierre?" texto={b.conCierre && b.horaFin ? <>Termina a las <b>{b.horaFin}</b></> : 'Opcional'} on={b.conCierre}
      alCambiar={v => cambiar({ conCierre: v, horaFin: v ? (b.horaFin || sumarMinutos(b.hora, 360)) : b.horaFin })} />
    {b.conCierre ? (
      <Campo id="cp-hora-fin" etiqueta="Hora de cierre">
        <input id="cp-hora-fin" type="time" value={b.horaFin} onChange={e => cambiar({ horaFin: e.target.value })} />
      </Campo>
    ) : null}
    {b.fecha ? <p className="cp-resumen-linea" aria-live="polite">{cuandoTexto(b)}</p> : null}
  </>);
}

// ---------- 4. Dónde ----------
function PasoDonde({ b, cambiar }: PasoProps){
  const previa = esPrevia(b), privada = previa && b.privada;
  const [sugs, setSugs] = useState<LugarSugerido[] | null>(null);
  const pedido = useRef(0);
  useEffect(() => () => { pedido.current++; }, []);
  function escribir(v: string){
    const c: Partial<Borrador> = { lugar: v };
    if(b.ubicacionDeSugerencia) Object.assign(c, { ubicacion: null, ubicacionTxt: '', ubicacionDeSugerencia: false });
    cambiar(c);
    const q = v.trim(), yo = ++pedido.current;
    if(q.length < 3 || privada){ setSugs(null); return; }
    setTimeout(async () => {
      if(yo !== pedido.current) return;
      const lista = await crearLegado.buscarLugares(q);
      if(yo === pedido.current) setSugs(lista);
    }, 450);
  }
  // Las sugerencias se cierran al salir del campo, salvo que el foco vaya a una de ellas (teclado)
  function salir(e: { relatedTarget: EventTarget | null; currentTarget: HTMLElement }){
    const r = e.relatedTarget as Node | null;
    if(r && e.currentTarget.closest('.campo')?.contains(r)) return;
    setTimeout(() => setSugs(null), 150);
  }
  function elegir(l: LugarSugerido){
    pedido.current++; setSugs(null);
    cambiar({ lugar: l.nombre, ubicacion: { lat: l.lat, lng: l.lng }, ubicacionTxt: 'Ubicado: ' + l.nombre, ubicacionDeSugerencia: true });
  }
  function abrirMapa(){
    crearLegado.abrirMapa(b.ubicacion, (p, dir) => {
      const c: Partial<Borrador> = { ubicacion: p, ubicacionDeSugerencia: false };
      if(privada){
        if(dir.completa) c.direccion = dir.completa;
        if(dir.barrio && !crearLegado.pareceDireccion(dir.barrio)) c.lugar = dir.barrio;
        else if(crearLegado.pareceDireccion(b.lugar)) c.lugar = '';
        c.ubicacionTxt = 'Ubicación marcada. El público solo ve la zona; la dirección exacta, los aprobados.';
      } else {
        if(dir.corta) c.lugar = dir.corta;
        c.ubicacionTxt = 'Ubicación marcada en el mapa';
      }
      cambiar(c);
    });
  }
  return (<>
    {previa ? (
      <FilaInterruptor titulo="Previa privada" texto="La dirección exacta solo la ven las personas que apruebes." on={b.privada}
        alCambiar={v => cambiar({ privada: v, ...(b.ubicacion && !b.ubicacionDeSugerencia ? { ubicacionTxt: v ? 'Ubicación marcada. El público solo ve la zona; la dirección exacta, los aprobados.' : 'Ubicación marcada en el mapa. Al ser pública, todos ven el punto exacto.' } : {}) })} />
    ) : null}
    <div className="campo cp-campo">
      <label htmlFor="cp-lugar">{privada ? 'Barrio o zona (público)' : 'Dirección o lugar'}</label>
      <div className="cp-input-icono">
        <Icono n="pin" />
        <input id="cp-lugar" type="text" maxLength={120} autoComplete="off" value={b.lugar} placeholder={privada ? 'Ej: Nueva Córdoba' : 'Ej: Belgrano 800, Güemes'}
          onChange={e => escribir(e.target.value)} onBlur={salir} aria-describedby={sugs?.length ? 'cp-sugerencias-tit' : undefined} />
      </div>
      {sugs ? (
        sugs.length ? (
          <div className="cp-sugs" id="cp-sugerencias" role="group" aria-labelledby="cp-sugerencias-tit" onBlur={salir}>
            <span className="cp-oculto" id="cp-sugerencias-tit">{sugs.length === 1 ? '1 lugar encontrado: seguí con Tab para elegirlo' : `${sugs.length} lugares encontrados: seguí con Tab para elegir uno`}</span>
            {sugs.map((l, i) => (
              <button type="button" key={l.nombre + i} className="cp-sug" onMouseDown={e => { e.preventDefault(); elegir(l); }} onClick={() => elegir(l)}>
                <Icono n="pin" tam={18} /><span><b>{l.nombre}</b>{l.detalle ? <small>{l.detalle}</small> : null}</span>
              </button>
            ))}
          </div>
        ) : <div className="cp-sugs-vacio">No encontramos ese lugar. Probá con otro nombre, o marcalo en el mapa.</div>
      ) : null}
      <div className="ayuda">{privada
        ? 'Lo ve todo el mundo: poné solo el barrio, sin calle ni número.'
        : 'Sé lo más específico posible: calle y número (o nombre del lugar), barrio y ciudad.'}</div>
    </div>
    {privada ? (
      <Campo id="cp-direccion" etiqueta="Dirección exacta (privada)" ayuda="Calle, número, piso o depto, timbre, barrio y ciudad. Solo la ven vos y los invitados que apruebes.">
        <input id="cp-direccion" type="text" maxLength={200} autoComplete="off" value={b.direccion} onChange={e => cambiar({ direccion: e.target.value })} placeholder="Calle, número, piso, depto, barrio y ciudad" />
      </Campo>
    ) : null}
    <div className="cp-mapa">
      {b.ubicacion ? (
        <div className="cp-mapa-teselas" aria-hidden="true">
          {teselas(b.ubicacion).map(t => <img key={t.key} src={t.url} alt="" style={{ left: `calc(50% + ${t.left}px)`, top: `calc(50% + ${t.top}px)` }} />)}
        </div>
      ) : <div className="cp-mapa-vacio" aria-hidden="true" />}
      {b.ubicacion ? <div className="cp-mapa-pin" aria-hidden="true"><Icono n="pin" tam={36} /></div> : null}
      <button type="button" className="btn btn-secundario btn-mini cp-mapa-btn" onClick={abrirMapa}><Icono n={b.ubicacion ? 'mover' : 'pin'} tam={16} />{b.ubicacion ? 'Ajustar en el mapa' : 'Marcar en el mapa'}</button>
    </div>
    {b.ubicacionTxt ? <p className="cp-nota cp-ok" role="status"><Icono n="check" tam={16} />{b.ubicacionTxt}</p> : null}
  </>);
}

// ---------- 5. Entrada ----------
function PasoEntrada({ b, cambiar }: PasoProps){
  const [conLink, setConLink] = useState(!!b.linkEntradas);
  const conComprobante = !b.linkEntradas.trim();
  return (<>
    <div className="cp-opciones" role="radiogroup" aria-label="La entrada es">
      <button type="button" role="radio" aria-checked={!b.pago} className={'cp-opcion' + (!b.pago ? ' on' : '')} onClick={() => cambiar({ pago: false })}><Icono n="entrada" tam={30} /><b>Gratis</b></button>
      <button type="button" role="radio" aria-checked={b.pago} className={'cp-opcion' + (b.pago ? ' on' : '')} onClick={() => { cambiar({ pago: true }); setTimeout(() => document.getElementById('cp-precio')?.focus(), 0); }}><Icono n="billete" tam={30} /><b>Paga</b></button>
    </div>
    {!b.pago ? <p className="cp-nota">La gente se anota desde el evento y recibe su entrada.</p> : (<>
      <div className="cp-precio">
        <label htmlFor="cp-precio" className="cp-etiqueta">Precio de la entrada</label>
        <div className="cp-precio-caja"><span aria-hidden="true">$</span><input id="cp-precio" type="number" inputMode="numeric" min={1} placeholder="0" value={b.precio} onChange={e => cambiar({ precio: e.target.value })} /></div>
      </div>
      <div className="cp-etiqueta" id="cp-quien-tit">¿Quién recibe la plata?</div>
      <div className="toggle-tipo cp-toggle" role="radiogroup" aria-labelledby="cp-quien-tit">
        <button type="button" role="radio" aria-checked={!b.cobraOtro} className={'op' + (!b.cobraOtro ? ' activo' : '')} onClick={() => cambiar({ cobraOtro: false })}>Yo / mi organización</button>
        <button type="button" role="radio" aria-checked={b.cobraOtro} className={'op' + (b.cobraOtro ? ' activo' : '')} onClick={() => cambiar({ cobraOtro: true })}>Otra persona</button>
      </div>
      {b.cobraOtro ? (
        <Campo id="cp-titular" etiqueta="Titular de la cuenta" ayuda="Los asistentes ven a quién le pagan y que el evento lo publicaste vos.">
          <input id="cp-titular" type="text" maxLength={60} value={b.pagoTitular} onChange={e => cambiar({ pagoTitular: e.target.value })} placeholder="Nombre y apellido de quien recibe la plata" />
        </Campo>
      ) : null}
      <Campo id="cp-pago-info" etiqueta="¿Cómo te pagan?">
        <input id="cp-pago-info" type="text" maxLength={200} autoCapitalize="none" value={b.pagoInfo} onChange={e => cambiar({ pagoInfo: e.target.value })} placeholder="Tu alias o CBU (o efectivo en puerta)" />
      </Campo>
      {conComprobante ? (
        <FilaInterruptor titulo="Cobrar con comprobante" on={b.comprobante} alCambiar={v => cambiar({ comprobante: v })}
          texto="Cada persona reserva, te transfiere y te manda la captura. Vos confirmás que te llegó y recién ahí recibe su entrada. Le guardamos el lugar 30 minutos." />
      ) : null}
      {conLink ? (
        <Campo id="cp-link" etiqueta="Link de venta en otra página" opcional ayuda="Si vendés ahí, el cupo lo maneja esa página.">
          <input id="cp-link" type="url" maxLength={300} autoCapitalize="none" value={b.linkEntradas} onChange={e => cambiar({ linkEntradas: e.target.value })} placeholder="https://alpogo.com/... o https://passline.com/..." />
        </Campo>
      ) : (
        <button type="button" className="cp-fila-mas" onClick={() => { setConLink(true); setTimeout(() => document.getElementById('cp-link')?.focus(), 0); }}><Icono n="link" tam={18} /><span>¿Vendés en otra página?</span><Icono n="mas" tam={18} /></button>
      )}
      <p className="cp-nota">El dinero va directo a vos. Partazy no cobra ni devuelve dinero: si cancelás el evento, las devoluciones las coordinás vos con cada persona.</p>
    </>)}
  </>);
}

// ---------- 6. Lugares y detalles ----------
const EDADES: [string, string][] = [['18', '18+'], ['21', '21+'], ['0', 'Todo público']];
function PasoLugares({ b, cambiar, esOrg }: PasoProps & { esOrg: boolean }){
  const previa = esPrevia(b);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [edadOtra, setEdadOtra] = useState(!EDADES.some(([v]) => v === b.edad));
  const cap = parseInt(b.capacidad, 10) || 0;
  const sumar = (n: number) => cambiar({ capacidad: String(Math.max(2, Math.min(20000, (cap || (n > 0 ? 0 : 2)) + n))) });
  const lineup = etiquetaLineup(b.ocasion);
  const extras = camposExtraVisibles(b);
  const tipoTxt = (crearLegado.OCASIONES[b.ocasion] || 'el evento').toLowerCase();
  const fila = (k: string, icono: ReactNode, titulo: string, valor: string, contenido: ReactNode) => (
    <div className={'cp-extra' + (abierto === k ? ' abierto' : '')} key={k}>
      <button type="button" className="cp-extra-cab" aria-expanded={abierto === k} aria-controls={'cp-x-' + k} onClick={() => setAbierto(abierto === k ? null : k)}>
        {icono}<span className="cp-extra-tit">{titulo}</span>{valor ? <span className="cp-extra-valor">{valor}</span> : <Icono n="mas" tam={18} />}
      </button>
      {abierto === k ? <div className="cp-extra-cuerpo" id={'cp-x-' + k}>{contenido}</div> : null}
    </div>
  );
  const faqLlenas = b.faq.filter(x => x.p.trim()).length;
  const vipN = b.vipTxt.split('\n').filter(x => x.trim()).length;
  const sugeridas = faqSugeridas(b.ocasion).filter(q => !b.faq.some(x => x.p.trim().toLowerCase() === q.toLowerCase()));
  const setFaq = (i: number, c: Partial<{ p: string; r: string }>) => cambiar({ faq: b.faq.map((x, j) => j === i ? { ...x, ...c } : x) });
  const sumarFaq = (p = '') => { if(b.faq.length >= crearLegado.MAX_FAQ) return; cambiar({ faq: [...b.faq, { p, r: '' }] }); setTimeout(() => document.getElementById(`cp-faq-${p ? 'r' : 'p'}-${b.faq.length}`)?.focus(), 0); };

  return (<>
    <div className="cp-contador-grande" role="group" aria-label="Capacidad">
      <button type="button" className="cp-redondo" aria-label="Diez menos" onClick={() => sumar(-10)}><Icono n="menos" /></button>
      <input id="cp-capacidad" type="number" inputMode="numeric" min={2} max={20000} className="cp-numero-grande" aria-label="Capacidad (personas)" placeholder="0" value={b.capacidad} onChange={e => cambiar({ capacidad: e.target.value })} />
      <button type="button" className="cp-redondo" aria-label="Diez más" onClick={() => sumar(10)}><Icono n="mas" /></button>
    </div>
    <p className="cp-nota cp-centro">{b.pago && b.linkEntradas.trim() ? 'Si vendés por otra página y no sabés el tope, dejalo vacío.' : 'Personas, contándote a vos.'}</p>
    <div className="cp-etiqueta" id="cp-edad-tit">Edad mínima</div>
    <div className="cp-chips" role="group" aria-labelledby="cp-edad-tit">
      {EDADES.map(([v, t]) => <button type="button" key={v} className={'chip' + (b.edad === v && !edadOtra ? ' activo' : '')} aria-pressed={b.edad === v && !edadOtra} onClick={() => { setEdadOtra(false); cambiar({ edad: v }); }}>{t}</button>)}
      <button type="button" className={'chip' + (edadOtra ? ' activo' : '')} aria-pressed={edadOtra} onClick={() => { setEdadOtra(true); setTimeout(() => document.getElementById('cp-edad')?.focus(), 0); }}>Otra</button>
    </div>
    {edadOtra ? <Campo id="cp-edad" etiqueta="Edad mínima (0 = todo público)"><input id="cp-edad" type="number" inputMode="numeric" min={0} max={99} value={b.edad} onChange={e => cambiar({ edad: e.target.value })} /></Campo> : null}
    {esOrg ? <FilaInterruptor titulo="Entradas con QR" texto="Cada asistente recibe un código QR para mostrar en la puerta." on={b.qr} alCambiar={v => cambiar({ qr: v })} /> : null}
    {previa ? <FilaInterruptor titulo="Llevar bebida" texto="Cada invitado trae la suya." on={b.bebida} alCambiar={v => cambiar({ bebida: v })} /> : null}

    <div className="cp-etiqueta cp-mas-tit">¿Querés sumar algo más? <span className="cp-opcional">(opcional)</span></div>
    <div className="cp-extras">
      {extras.length ? fila('tipo', <IconoTipo k={b.ocasion} tam={18} />, `Sobre ${tipoTxt}`, extras.some(c => valorExtra(b, c)) ? 'Listo' : '', (<>
        {extras.map(c => <CampoExtraTipo key={c.k} c={c} valor={valorExtra(b, c)} alCambiar={v => cambiar({ extras: { ...b.extras, [c.k]: v } })} />)}
        {conEquipos(b) ? (<div className="fila-2 cp-equipos">
          <Campo id="cp-jugadores" etiqueta="Jugadores por equipo"><input id="cp-jugadores" type="number" inputMode="numeric" min={1} max={50} placeholder="Ej: 5" value={b.jugadores} onChange={e => cambiar({ jugadores: e.target.value })} /></Campo>
          <Campo id="cp-max-equipos" etiqueta="Máximo de equipos"><input id="cp-max-equipos" type="number" inputMode="numeric" min={2} max={64} placeholder="Sin límite" value={b.maxEquipos} onChange={e => cambiar({ maxEquipos: e.target.value })} /></Campo>
        </div>) : null}
      </>)) : null}
      {conDresscode(b.ocasion) ? fila('dress', <Icono n="remera" tam={18} />, 'Dress code', b.dresscode.trim(),
        <Campo id="cp-dresscode" etiqueta="Dress code"><input id="cp-dresscode" type="text" maxLength={60} placeholder="Ej: Negro, libre, temática..." value={b.dresscode} onChange={e => cambiar({ dresscode: e.target.value })} /></Campo>) : null}
      {conEstilo(b.ocasion) ? fila('estilo', <Icono n="musica" tam={18} />, 'Estilo de música', b.estilo === 'otro' ? b.estiloOtro.trim() : (crearLegado.ESTILOS[b.estilo] || ''), (<>
        <Campo id="cp-estilo" etiqueta="Estilo de música" ayuda="Si lo elegís, tu evento le aparece a quien busca ese estilo: llega a más gente.">
          <select id="cp-estilo" value={b.estilo} onChange={e => { cambiar({ estilo: e.target.value }); if(e.target.value === 'otro') setTimeout(() => document.getElementById('cp-estilo-otro')?.focus(), 0); }}>
            <option value="">Sin especificar</option>
            {Object.entries(crearLegado.ESTILOS).filter(([k]) => k !== 'universitaria' && k !== 'otro').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            <option value="otro">Otro…</option>
          </select>
        </Campo>
        {b.estilo === 'otro' ? <Campo id="cp-estilo-otro" etiqueta="¿Cuál?"><input id="cp-estilo-otro" type="text" maxLength={30} placeholder="Ej: jazz, salsa, metal" value={b.estiloOtro} onChange={e => cambiar({ estiloOtro: e.target.value })} /></Campo> : null}
      </>)) : null}
      {previa ? fila('musica', <Icono n="musica" tam={18} />, 'Música', b.musica.trim(),
        <Campo id="cp-musica" etiqueta="Música"><input id="cp-musica" type="text" maxLength={80} placeholder="Ej: cumbia, cachengue, lo que pinte" value={b.musica} onChange={e => cambiar({ musica: e.target.value })} /></Campo>) : null}
      {fila('lineup', <Icono n="lista" tam={18} />, lineup.titulo, b.lineup.trim() ? 'Listo' : '',
        <Campo id="cp-lineup" etiqueta={lineup.titulo}><textarea id="cp-lineup" maxLength={600} rows={4} placeholder={lineup.ejemplo} value={b.lineup} onChange={e => cambiar({ lineup: e.target.value })} /></Campo>)}
      {fila('reglas', <Icono n="reglas" tam={18} />, 'Reglas', b.reglas.trim() ? 'Listo' : '',
        <Campo id="cp-reglas" etiqueta="Reglas del evento"><textarea id="cp-reglas" maxLength={500} rows={3} placeholder="Ej: Respetar el lugar, no ingresar con más invitados de los acordados..." value={b.reglas} onChange={e => cambiar({ reglas: e.target.value })} /></Campo>)}
      {fila('faq', <Icono n="pregunta" tam={18} />, 'Preguntas frecuentes', faqLlenas ? String(faqLlenas) : '', (<div className="campo cp-campo cp-faqs">
        <p className="cp-nota">Lo que siempre te preguntan. Hasta {crearLegado.MAX_FAQ}, aparecen en la página del evento.</p>
        {b.faq.map((x, i) => (
          <div className="faq-fila cp-faq" key={i}>
            <input type="text" id={`cp-faq-p-${i}`} className="faq-p" maxLength={120} placeholder="Pregunta. Ej: ¿Hay guardarropa?" aria-label={`Pregunta ${i + 1}`} value={x.p} onChange={e => setFaq(i, { p: e.target.value })} />
            <textarea id={`cp-faq-r-${i}`} className="faq-r" maxLength={300} placeholder="Respuesta" aria-label={`Respuesta ${i + 1}`} value={x.r} onChange={e => setFaq(i, { r: e.target.value })} />
            <button type="button" className="faq-quitar" aria-label={`Quitar pregunta ${i + 1}`} onClick={() => cambiar({ faq: b.faq.filter((_, j) => j !== i) })}><Icono n="cerrar" tam={16} /></button>
          </div>
        ))}
        {b.faq.length < crearLegado.MAX_FAQ ? (<>
          <div className="cp-chips">{sugeridas.map(q => <button type="button" key={q} className="chip" onClick={() => sumarFaq(q)}>+ {q}</button>)}</div>
          <button type="button" className="btn btn-secundario btn-mini" onClick={() => sumarFaq()}>+ Escribir otra pregunta</button>
        </>) : null}
      </div>))}
      {conVip(b.ocasion) ? fila('vip', <Icono n="corona" tam={18} />, 'Lista VIP', b.vipOn ? (vipN ? `${vipN} ${vipN === 1 ? 'nombre' : 'nombres'}` : 'Activada') : '', (<>
        <FilaInterruptor titulo="Lista VIP" texto="Acceso prioritario para invitados." on={b.vipOn} alCambiar={v => cambiar({ vipOn: v })} />
        {b.vipOn ? <Campo id="cp-vip" etiqueta="¿Quiénes están en la lista VIP?" ayuda="Uno por renglón. Solo la ves vos, desde la página del evento.">
          <textarea id="cp-vip" maxLength={6000} rows={4} placeholder={'Un nombre por renglón:\nSofía Gómez\nIvo Paz +1'} value={b.vipTxt} onChange={e => cambiar({ vipTxt: e.target.value })} />
        </Campo> : null}
      </>)) : null}
      {fila('insc', <Icono n="reloj" tam={18} />, 'Anotarse hasta', b.inscFecha ? fechaLarga(b.inscFecha) : '', (
        <div className="campo cp-campo">
          <label htmlFor="cp-insc-fecha">Anotarse hasta</label>
          <div className="fila-2 cp-fila-0">
            <input id="cp-insc-fecha" type="date" aria-label="Fecha límite para anotarse" value={b.inscFecha} onChange={e => cambiar({ inscFecha: e.target.value })} />
            <input id="cp-insc-hora" type="time" aria-label="Hora límite" placeholder="23:59" value={b.inscHora} onChange={e => cambiar({ inscHora: e.target.value })} />
          </div>
          <div className="ayuda">Después de esa fecha nadie más se puede anotar. Sirve para cerrar la lista de un egreso, una cena o un viaje.</div>
        </div>
      ))}
    </div>
  </>);
}
function CampoExtraTipo({ c, valor, alCambiar }: { c: { k: string; l: string; t?: string; ph?: string; ops?: string[] }; valor: string; alCambiar: (v: string) => void }){
  const id = 'cp-x-' + c.k + '-campo';
  if(c.t === 'sel') return (
    <Campo id={id} etiqueta={c.l}><select id={id} value={valor} onChange={e => alCambiar(e.target.value)}><option value="">Sin especificar</option>{(c.ops || []).map(o => <option key={o} value={o}>{o}</option>)}</select></Campo>
  );
  if(c.t === 'multi'){
    const sel = valor.split(',').map(x => x.trim()).filter(Boolean);
    const alternar = (o: string) => { const n = sel.includes(o) ? sel.filter(x => x !== o) : [...sel, o]; alCambiar((c.ops || []).filter(x => n.includes(x)).join(', ')); };
    return (
      <div className="campo cp-campo"><div className="cp-etiqueta" id={id}>{c.l}</div>
        <div className="cp-chips" role="group" aria-labelledby={id}>{(c.ops || []).map(o => <button type="button" key={o} className={'chip' + (sel.includes(o) ? ' activo' : '')} aria-pressed={sel.includes(o)} onClick={() => alternar(o)}>{o}</button>)}</div>
      </div>
    );
  }
  return <Campo id={id} etiqueta={c.l}><input id={id} type={c.t === 'num' ? 'number' : 'text'} maxLength={120} placeholder={c.ph || ''} value={valor} onChange={e => alCambiar(e.target.value)} /></Campo>;
}

// ---------- 7. Revisar y publicar ----------
function PasoListo({ b, cambiar, uid, irA }: PasoProps & { uid: string | null; irA: (p: number, campo?: string) => void }){
  const ev = eventoDeMuestra(b, uid);
  return (<>
    <div className="cp-muestra" inert dangerouslySetInnerHTML={{ __html: crearLegado.tarjetaHTML(ev) }} />
    {!b.foto ? <p className="cp-nota">No subiste foto: usamos una portada según el tipo de evento. Una foto real genera más confianza y más confirmaciones.</p> : null}
    <ul className="cp-resumen" aria-label="Resumen del evento">
      {resumen(b).map((r, i) => (
        <li className="cp-resumen-fila" key={r.titulo + i}>
          <div><span className="cp-r-tit">{r.titulo}</span><span className="cp-r-txt">{r.texto}</span></div>
          <button type="button" className="cp-editar" onClick={() => irA(r.paso)} aria-label={`Editar ${r.titulo.toLowerCase()}`}>Editar</button>
        </li>
      ))}
    </ul>
    <label className="check-normas cp-normas">
      <input type="checkbox" id="cp-normas" checked={b.normas} onChange={e => cambiar({ normas: e.target.checked })} />
      <span>Acepto las <button type="button" className="link-btn" onClick={() => crearLegado.verNormas()}>normas de la comunidad</button>. Puedo editar el evento después de publicarlo.</span>
    </label>
  </>);
}
