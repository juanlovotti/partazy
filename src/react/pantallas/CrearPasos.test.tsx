// Pruebas del Crear por pasos (componente), con la app vieja simulada.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import CrearPasos from './CrearPasos';

let publicar: ReturnType<typeof vi.fn>;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  publicar = vi.fn(async () => 'ev1');
  Object.assign(window, {
    state: { uid: 'L', perfil: { nombre: 'Lu Ferreyra' } },
    OCASIONES: { fiesta: 'Fiesta', previa: 'Previa' }, TIPOS_NUEVOS: ['fiesta', 'previa'],
    ICONOS_TIPO: { fiesta: '<circle cx="12" cy="12" r="5"/>', previa: '<path d="M1 1"/>' }, EXTRAS_TIPO: {},
    ESTILOS: { techno: 'Techno', otro: 'Otro' }, OCASIONES_FIESTA: new Set(['', 'fiesta', 'previa']),
    FAQ_SUGERIDAS: { fiesta: ['¿Hay guardarropa?'], previa: [], charla: [], deportivo: [], general: [] }, MAX_FAQ: 5,
    toast: vi.fn(), esOrganizacion: () => false, pareceDireccion: (t: string) => /\d{2,}/.test(t),
    datoPago: () => '', linkWeb: () => null, verNormas: vi.fn(),
    tarjetaHTML: (ev: { nombre: string }) => `<div class="tarjeta"><h3>${ev.nombre.replace(/</g, '&lt;')}</h3></div>`,
    publicarConDatos: publicar,
  });
});
afterEach(() => cleanup());

const siguiente = () => act(async () => { fireEvent.click(screen.getByRole('button', { name: /Siguiente|Publicar evento/ })); });
async function completarHasta7(nombre = 'Noche Vortex'){
  fireEvent.click(screen.getByRole('button', { name: 'Fiesta' })); await siguiente();
  fireEvent.change(screen.getByLabelText('Nombre del evento'), { target: { value: nombre } }); await siguiente();
  fireEvent.click(screen.getAllByRole('button', { name: /Sábado|Domingo/ })[0]); await siguiente();
  fireEvent.change(screen.getByLabelText('Dirección o lugar'), { target: { value: 'Belgrano 800' } }); await siguiente();
  await siguiente();   // Gratis
  fireEvent.change(screen.getByLabelText('Capacidad (personas)'), { target: { value: '300' } }); await siguiente();
}

describe('Crear por pasos', () => {
  it('va paso por paso y publica con los datos armados, sin la vista previa vieja', async () => {
    render(<CrearPasos />);
    expect(screen.getByText('1 / 7')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1');
    await completarHasta7();
    expect(screen.getByText('7 / 7')).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Acepto las/));
    await siguiente();
    expect(publicar).toHaveBeenCalledTimes(1);
    const [datos, ui] = publicar.mock.calls[0] as [Record<string, unknown>, Record<string, unknown>];
    expect([datos.nombre, datos.tipo, datos.lugar, datos.capacidad, datos.pago, datos.editando]).toEqual(['Noche Vortex', 'fiesta', 'Belgrano 800', '300', false, null]);
    expect(ui.vistaPrevia).toBe(false);
  });
  it('un error de la app vieja lleva al paso y al campo', async () => {
    publicar.mockImplementation(async (_d: unknown, ui: { enfocar(c: string): void }) => { ui.enfocar('f-capacidad'); return undefined; });
    render(<CrearPasos />);
    await completarHasta7();
    fireEvent.click(screen.getByLabelText(/Acepto las/));
    await siguiente();
    expect(screen.getByText('6 / 7')).toBeTruthy();
    expect(document.activeElement?.id).toBe('cp-capacidad');
  });
  it('al terminar de publicar vuelve al paso 1 vacío', async () => {
    publicar.mockImplementation(async (_d: unknown, ui: { listo(id: string): void }) => { ui.listo('ev1'); return 'ev1'; });
    render(<CrearPasos />);
    await completarHasta7();
    fireEvent.click(screen.getByLabelText(/Acepto las/));
    await siguiente();
    expect(screen.getByText('1 / 7')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fiesta' }).getAttribute('aria-pressed')).toBe('false');
  });
  it('lo que escribe la gente se ve como texto (nada de HTML)', async () => {
    render(<CrearPasos />);
    await completarHasta7('<img src=x onerror=alert(1)>');
    expect(document.querySelector('img[src="x"]')).toBeNull();
    expect(document.querySelector('.cp-mini-txt b')?.textContent).toBe('<img src=x onerror=alert(1)>');
  });
  it('Cerrar en el paso 1 vuelve al Inicio', async () => {
    const volver = vi.fn(); Object.assign(window, { volver });
    render(<CrearPasos />);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(volver).toHaveBeenCalledWith('home');
  });
});
