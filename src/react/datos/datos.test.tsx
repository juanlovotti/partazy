// Pruebas de u08: hooks de carga y escucha (con cierre), la capa de datos y el servicio de direcciones.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { useCarga, useEscucha } from './hooks';
import { datos } from './api';
import { buscarDireccion, direccionDePunto, cajaCerca } from '../../geo.js';

beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const tanda = () => new Promise<void>(r => setTimeout(r, 0));

describe('useCarga', () => {
  it('muestra cargando y después el dato', async () => {
    let soltar!: (v: string) => void;
    function C(){ const c = useCarga(() => new Promise<string>(r => { soltar = r; }), []); return <p data-testid="c">{c.cargando ? 'cargando' : c.datos}</p>; }
    render(<C />);
    expect(screen.getByTestId('c').textContent).toBe('cargando');
    await act(async () => { soltar('Lu'); await tanda(); });
    expect(screen.getByTestId('c').textContent).toBe('Lu');
  });
  it('descarta una respuesta vieja si cambió lo que se pidió', async () => {
    const pedidos: Record<string, (v: string) => void> = {};
    function C({ id }: { id: string }){ const c = useCarga(() => new Promise<string>(r => { pedidos[id] = r; }), [id]); return <p data-testid="c">{c.datos ?? '-'}</p>; }
    const r = render(<C id="a" />);
    r.rerender(<C id="b" />);
    await act(async () => { pedidos.b('B'); await tanda(); pedidos.a('A viejo'); await tanda(); });
    expect(screen.getByTestId('c').textContent).toBe('B');
  });
  it('un error queda en error, sin romper', async () => {
    function C(){ const c = useCarga(() => Promise.reject(new Error('sin red')), []); return <p data-testid="c">{c.error ? (c.error as Error).message : 'ok'}</p>; }
    render(<C />); await act(async () => { await tanda(); });
    expect(screen.getByTestId('c').textContent).toBe('sin red');
  });
});

describe('useEscucha', () => {
  it('recibe cada cambio y corta la escucha al desmontar', async () => {
    let avisar!: (d: number) => void; const cortar = vi.fn();
    function C(){ const e = useEscucha<number>(a => { avisar = a; return cortar; }, []); return <p data-testid="e">{String(e.datos ?? '-')}</p>; }
    const r = render(<C />);
    await act(async () => { avisar(1); });
    expect(screen.getByTestId('e').textContent).toBe('1');
    await act(async () => { avisar(2); });
    expect(screen.getByTestId('e').textContent).toBe('2');
    r.unmount();
    expect(cortar).toHaveBeenCalledTimes(1);
    expect(() => avisar(3)).not.toThrow();   // un aviso tardío después de cortar no hace nada
  });
  it('al cambiar las dependencias corta la anterior y abre otra', async () => {
    const cortes: string[] = [];
    function C({ uid }: { uid: string }){ useEscucha<number>(() => () => { cortes.push(uid); }, [uid]); return null; }
    const r = render(<C uid="A" />);
    r.rerender(<C uid="B" />);
    expect(cortes).toEqual(['A']);
    r.unmount();
    expect(cortes).toEqual(['A', 'B']);
  });
});

describe('datos (capa sobre DataService)', () => {
  it('llama a DataService con los mismos argumentos', async () => {
    const getPerfil = vi.fn(async () => ({ nombre: 'Lu Ferreyra' }));
    const escucharNotificaciones = vi.fn(() => () => {});
    Object.assign(window, { DataService: { getPerfil, escucharNotificaciones } });
    expect(await datos.perfil('L')).toEqual({ nombre: 'Lu Ferreyra' });
    expect(getPerfil).toHaveBeenCalledWith('L');
    const fn = () => {}; datos.escucharNotificaciones('L', fn);
    expect(escucharNotificaciones).toHaveBeenCalledWith('L', fn, undefined);
  });
});

describe('servicio de direcciones (src/geo.js)', () => {
  it('arma los pedidos a Nominatim en español y en Argentina', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (u: string) => { urls.push(u); return { json: async () => (u.includes('reverse') ? { address: { city: 'Córdoba' } } : [{ lat: '-31.4', lon: '-64.2' }]) }; }));
    const [x] = await buscarDireccion('Belgrano 800, Güemes', { limite: 5, caja: cajaCerca({ lat: -31.4, lng: -64.2 }) });
    expect(x.lat).toBe('-31.4');
    expect(urls[0]).toMatch(/^https:\/\/nominatim\.openstreetmap\.org\/search\?format=jsonv2&limit=5&countrycodes=ar&addressdetails=1&accept-language=es&viewbox=[-\d.]+,[-\d.]+,[-\d.]+,[-\d.]+&bounded=1&q=Belgrano%20800%2C%20G%C3%BCemes$/);
    const d = await direccionDePunto(-31.4, -64.2, { zoom: 12, detalles: false });
    expect(d.address?.city).toBe('Córdoba');
    expect(urls[1]).toBe('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=12&accept-language=es&lat=-31.4&lon=-64.2');
    vi.unstubAllGlobals();
  });
  it('sin punto no hay cuadro; sin acotar, prioriza pero no limita', () => {
    expect(cajaCerca(null)).toBe('');
    expect(cajaCerca({ lat: -31, lng: -64 }, 0.5, false)).toBe('&viewbox=-64.5,-30.5,-63.5,-31.5');
  });
});
