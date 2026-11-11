// Pruebas del montaje de pantallas React dentro de la app vieja.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { arrancar, desmontar } from './arranque';

const esperar = (ms = 20) => new Promise(r => setTimeout(r, ms));
function armarPantalla(activa: boolean){
  document.body.innerHTML = `<div class="screen${activa ? ' activa' : ''}" id="pantalla-ayuda">
    <button class="volver">Volver</button><div id="lista-ayuda"></div>
    <form id="form-contacto"><input id="ct-nombre"></form>
    <footer class="pie-legal">pie</footer></div>`;
  return document.getElementById('pantalla-ayuda')!;
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  desmontar('ayuda');
  Object.assign(window, {
    __pantallasReact: new Set(['ayuda']),
    state: { uid: null, perfil: null }, DataService: { enviarConsulta: vi.fn() },
    AYUDA: [['Entradas', [['¿Cómo consigo mi entrada?', 'Entrá al evento.']]]],
    MAIL_CONTACTO: 'partazycontacto@gmail.com', WHATSAPP_CONTACTO: '', toast: vi.fn(),
  });
});

describe('arrancar', () => {
  it('reemplaza lo viejo por React y deja el pie legal de la app vieja', async () => {
    const el = armarPantalla(false);
    await act(async () => { arrancar(['ayuda']); });
    expect(el.querySelector(':scope > [data-react="ayuda"]')).toBeTruthy();
    expect(el.querySelector(':scope > footer.pie-legal')?.textContent).toBe('pie');
    expect(el.querySelectorAll('details.faq')).toHaveLength(1);
  });
  it('si la pantalla está abierta, espera a que se cierre para no borrar lo que se está escribiendo', async () => {
    const el = armarPantalla(true);
    (document.getElementById('ct-nombre') as HTMLInputElement).value = 'escribiendo';
    await act(async () => { arrancar(['ayuda']); });
    expect(el.querySelector('[data-react]')).toBeNull();
    expect((document.getElementById('ct-nombre') as HTMLInputElement).value).toBe('escribiendo');
    await act(async () => { el.classList.remove('activa'); await esperar(); });
    expect(el.querySelector(':scope > [data-react="ayuda"]')).toBeTruthy();
  });
  it('si React falla al dibujar, vuelve la versión vieja', async () => {
    const el = armarPantalla(false);
    (window as any).AYUDA = undefined;    // hace fallar el dibujo
    vi.spyOn(console, 'error').mockImplementation(() => {});
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;   // como en el navegador: el error va a onUncaughtError
    arrancar(['ayuda']);
    await esperar(80);
    expect(el.querySelector('[data-react]')).toBeNull();
    expect(el.querySelector(':scope > .volver')).toBeTruthy();
    expect(window.__pantallasReact?.has('ayuda')).toBe(false);
  });
});
