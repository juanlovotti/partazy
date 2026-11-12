// Pruebas del puente de estado (src/estado.js) y de los hooks que lo leen (estado.ts).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { observar, avisarEstado, puenteEstado } from '../estado.js';
import { useSesion, useEventos, useUbicacion, usePantallaActual, useEstado } from './estado';

const tanda = () => new Promise<void>(r => queueMicrotask(() => r()));   // los avisos salen al final de la tanda
type W = { state: Record<string, unknown>; NAV: Record<string, unknown> };
const w = () => window as unknown as W;

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  w().state = observar('estado', { uid: null, perfil: null, esAdmin: false, eventos: [] as unknown[], userCoords: null, radioKm: 50, ciudadActual: 'Córdoba', tok: 0 });
  w().NAV = observar('nav', { actual: 'home', clave: 'home', pila: [] });
});
afterEach(() => cleanup());

describe('observar', () => {
  it('sigue siendo el mismo objeto para la app vieja', () => {
    const s = w().state;
    s.uid = 'L';
    expect(s.uid).toBe('L');
    expect(Object.keys(s)).toContain('perfil');
    delete s.tok;
    expect('tok' in s).toBe(false);
  });
  it('junta los cambios de una tanda en un solo aviso, con las claves que cambiaron', async () => {
    const avisos: string[][] = [];
    const salir = puenteEstado.suscribir(ids => avisos.push([...ids].sort()));
    w().state.uid = 'L'; w().state.perfil = { nombre: 'Lu' }; w().NAV.actual = 'perfil';
    expect(avisos).toHaveLength(0);
    await tanda();
    expect(avisos).toEqual([['estado.perfil', 'estado.uid', 'nav.actual']]);
    salir();
  });
  it('no avisa si el valor no cambió', async () => {
    const avisos: unknown[] = [];
    const salir = puenteEstado.suscribir(ids => avisos.push(ids));
    w().state.radioKm = 50; w().NAV.actual = 'home';
    await tanda();
    expect(avisos).toHaveLength(0);
    salir();
  });
  it('avisarEstado cubre los cambios por dentro (push, Object.assign)', async () => {
    const avisos: string[][] = [];
    const salir = puenteEstado.suscribir(ids => avisos.push([...ids]));
    (w().state.eventos as unknown[]).push({ id: 'x' }); avisarEstado('eventos');
    await tanda();
    expect(avisos).toEqual([['estado.eventos']]);
    salir();
  });
  it('un oyente que falla no frena a los demás', async () => {
    const otros: unknown[] = [];
    const s1 = puenteEstado.suscribir(() => { throw new Error('x'); });
    const s2 = puenteEstado.suscribir(ids => otros.push(ids));
    const err = console.error; console.error = () => {};
    w().state.uid = 'Q'; await tanda();
    console.error = err;
    expect(otros).toHaveLength(1);
    s1(); s2();
  });
});

describe('hooks', () => {
  function Sesion(){ const s = useSesion(); return <p data-testid="s">{s.invitado ? 'invitado' : 'con cuenta'} {String(s.perfil?.nombre ?? '')}</p>; }
  it('useSesion: invitado hasta que entra, y después el nombre', async () => {
    render(<Sesion />);
    expect(screen.getByTestId('s').textContent).toBe('invitado ');
    await act(async () => { w().state.uid = 'L'; w().state.perfil = { nombre: 'Lu Ferreyra' }; await tanda(); });
    expect(screen.getByTestId('s').textContent).toBe('con cuenta Lu Ferreyra');
  });
  it('useEventos: se entera de un push avisado aunque el arreglo sea el mismo', async () => {
    function Lista(){ const ev = useEventos(); return <p data-testid="n">{ev.length}</p>; }
    render(<Lista />);
    expect(screen.getByTestId('n').textContent).toBe('0');
    await act(async () => { (w().state.eventos as unknown[]).push({ id: 'e1' }); avisarEstado('eventos'); await tanda(); });
    expect(screen.getByTestId('n').textContent).toBe('1');
  });
  it('solo vuelve a pintar el componente cuando cambia la clave que lee', async () => {
    let pintadas = 0;
    function Ciudad(){ pintadas++; const u = useUbicacion(); return <p data-testid="c">{u.ciudad} {u.radioKm}</p>; }
    render(<Ciudad />);
    const antes = pintadas;
    await act(async () => { w().state.tok = 5; w().NAV.actual = 'explorar'; await tanda(); });
    expect(pintadas).toBe(antes);
    await act(async () => { w().state.radioKm = 10; await tanda(); });
    expect(screen.getByTestId('c').textContent).toBe('Córdoba 10');
  });
  it('usePantallaActual sigue a NAV.actual', async () => {
    function P(){ return <p data-testid="p">{usePantallaActual()}</p>; }
    render(<P />);
    await act(async () => { w().NAV.actual = 'detalle'; await tanda(); });
    expect(screen.getByTestId('p').textContent).toBe('detalle');
  });
  it('al desmontar deja de escuchar', async () => {
    function U(){ return <p>{String(useEstado('uid'))}</p>; }
    const antes = puenteEstado.cantidadOyentes();
    const r = render(<U />);
    expect(puenteEstado.cantidadOyentes()).toBe(antes + 1);
    r.unmount();
    expect(puenteEstado.cantidadOyentes()).toBe(antes);
  });
});
