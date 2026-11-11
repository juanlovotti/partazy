// Pantalla Ayuda en React (paridad con la versión vieja: mismo HTML, mismas clases e ids, mismos textos).
// La dibuja React solo si el interruptor "ayuda" está prendido (ver src/react/interruptores.ts).
// El pie legal de la pantalla sigue siendo de la app vieja (lo comparten 5 pantallas).
import { Fragment, useEffect, useState, type FormEvent } from 'react';
import { legado, alAbrirPantalla } from '../legado';

const MAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOTIVOS: [string, string][] = [
  ['consulta', 'Consulta general'], ['problema', 'Algo no funciona'], ['organizacion', 'Soy boliche / productora'],
  ['cuenta', 'Mi cuenta'], ['denuncia', 'Denuncia o seguridad'], ['sugerencia', 'Sugerencia'],
];

export default function Ayuda(){
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [motivo, setMotivo] = useState('consulta');
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [vez, setVez] = useState(0);   // cada vez que se abre, las preguntas arrancan cerradas (como antes)

  // Al abrir la pantalla: con sesión se precarga el nombre (nunca el mail), como en la versión vieja
  useEffect(() => {
    const precargar = () => setNombre(n => n || legado.state?.perfil?.nombre || '');
    precargar();
    return alAbrirPantalla('ayuda', () => { precargar(); setVez(v => v + 1); });
  }, []);

  const whatsapp = legado.WHATSAPP_CONTACTO;
  const mail = legado.MAIL_CONTACTO;

  async function enviar(e: FormEvent){
    e.preventDefault();
    // Como antes, se leen los campos al enviar (por si el autocompletado del celu los llenó sin avisar)
    const campos = (e.currentTarget as HTMLFormElement).elements;
    const v = (id: string) => ((campos.namedItem(id) as HTMLInputElement | null)?.value ?? '').trim();
    const n = v('ct-nombre'), m = v('ct-email'), msj = v('ct-mensaje');
    const mot = v('ct-motivo') || motivo;
    if(n.length < 2){ legado.toast('Escribí tu nombre'); return; }
    if(!MAIL_VALIDO.test(m)){ legado.toast('Revisá tu correo electrónico'); return; }
    if(msj.length < 5){ legado.toast('Contanos un poco más en el mensaje'); return; }
    setEnviando(true);
    try{
      await legado.DataService.enviarConsulta({ nombre: n.slice(0, 60), email: m.slice(0, 100), motivo: mot, mensaje: msj.slice(0, 1000), uid: legado.state?.uid || '', ts: Date.now() });
      setMensaje('');
      legado.toast('¡Gracias! Te respondemos al mail a la brevedad');
    } catch(err){
      console.error(err);
      legado.toast('No se pudo enviar. Escribinos a ' + mail);
    } finally { setEnviando(false); }
  }

  return (<>
    <button className="volver" onClick={() => legado.volver('perfil')}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg> Volver</button>
    <div style={{ padding: '6px 20px 10px' }}><h2 style={{ fontFamily: 'var(--font-display)', textTransform: 'uppercase', fontWeight: 700, fontSize: 30, letterSpacing: '.3px' }}>Ayuda</h2>
      <p style={{ fontSize: 12.5, color: 'var(--gris)' }}>Preguntas frecuentes sobre Partazy.</p></div>
    <div style={{ padding: '0 20px 8px', display: 'flex', gap: 10 }}><button className="btn btn-primario" onClick={() => legado.abrirTutorial()}>Ver tutorial</button><button className="btn btn-secundario" onClick={() => legado.abrirReferencias()}>Colores</button></div>
    <div id="lista-ayuda" key={vez}>
      {legado.AYUDA.map(([seccion, preguntas]) => (<Fragment key={seccion}>
        <div className="subtitulo"><h3 className="titulo-bloque">{seccion}</h3></div>
        <div className="lista-faq">{preguntas.map(([p, r]) => <details className="faq" key={p}><summary>{p}</summary><p>{r}</p></details>)}</div>
      </Fragment>))}
    </div>
    <form className="contacto" id="form-contacto" onSubmit={enviar}>
      <h3>¿No encontraste tu respuesta?</h3>
      <p>Dejanos tu consulta y te respondemos a la brevedad.</p>
      <input type="text" id="ct-nombre" maxLength={60} placeholder="Nombre" autoComplete="name" aria-label="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} />
      <input type="email" id="ct-email" maxLength={100} placeholder="Correo electrónico" autoComplete="email" aria-label="Correo electrónico" value={email} onChange={e => setEmail(e.target.value)} />
      <select id="ct-motivo" aria-label="Motivo" value={motivo} onChange={e => setMotivo(e.target.value)}>
        {MOTIVOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
      <textarea id="ct-mensaje" maxLength={1000} placeholder="Contanos en qué te podemos ayudar" aria-label="Mensaje" value={mensaje} onChange={e => setMensaje(e.target.value)} />
      <button className="btn btn-primario" type="submit" id="ct-enviar" disabled={enviando}>{enviando ? 'Enviando...' : 'Enviar'}</button>
      <div className="otra-via">
        <span>O si preferís, escribinos directo:</span>
        <a className="btn btn-wa" id="ct-whatsapp" style={whatsapp ? undefined : { display: 'none' }} href={whatsapp ? 'https://wa.me/' + whatsapp + '?text=' + encodeURIComponent('Hola Partazy! Tengo una consulta: ') : undefined} target="_blank" rel="noopener noreferrer">💬 Escribir por WhatsApp</a>
        <a className="btn btn-secundario" id="ct-mail" href={'mailto:' + mail}>✉️ {mail}</a>
      </div>
    </form>
    <div style={{ padding: '0 20px 28px' }}><button className="btn btn-secundario" onClick={() => legado.abrirPrivacidad()}>Política de privacidad</button></div>
  </>);
}
