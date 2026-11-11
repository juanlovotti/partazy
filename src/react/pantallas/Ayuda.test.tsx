// Pruebas del componente Ayuda, aislado de la app vieja (el "legado" se simula).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import Ayuda from './Ayuda';

const enviarConsulta = vi.fn();
const toast = vi.fn();
beforeEach(() => {
  enviarConsulta.mockReset().mockResolvedValue(undefined); toast.mockReset();
  Object.assign(window, {
    state: { uid: 'U1', perfil: { nombre: 'Lu Ferreyra' } },
    DataService: { enviarConsulta },
    AYUDA: [['Entradas', [['¿Cómo consigo mi entrada?', 'Entrá al evento.'], ['¿Hay que imprimir?', 'No.']]], ['Colores y etiquetas', [['¿Qué significan los puntos?', 'El ambiente.']]]],
    MAIL_CONTACTO: 'partazycontacto@gmail.com', WHATSAPP_CONTACTO: '',
    toast, volver: vi.fn(), abrirTutorial: vi.fn(), abrirReferencias: vi.fn(), abrirPrivacidad: vi.fn(),
  });
});
afterEach(() => cleanup());

describe('Ayuda', () => {
  it('muestra las secciones y preguntas, y precarga el nombre pero no el mail', () => {
    const { container } = render(<Ayuda />);
    expect(container.querySelectorAll('details.faq')).toHaveLength(3);
    expect(screen.getByText('Colores y etiquetas')).toBeTruthy();
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Lu Ferreyra');
    expect((screen.getByLabelText('Correo electrónico') as HTMLInputElement).value).toBe('');
    expect((container.querySelector('#ct-whatsapp') as HTMLElement).style.display).toBe('none');
  });
  it('valida antes de mandar', () => {
    render(<Ayuda />);
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'lu@mail.com' } });
    fireEvent.change(screen.getByLabelText('Mensaje'), { target: { value: 'Hola' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Enviar' }));
    expect(toast).toHaveBeenCalledWith('Contanos un poco más en el mensaje');
    expect(enviarConsulta).not.toHaveBeenCalled();
  });
  it('manda la consulta recortada, avisa y limpia el mensaje', async () => {
    render(<Ayuda />);
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: '  lu@mail.com ' } });
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'organizacion' } });
    fireEvent.change(screen.getByLabelText('Mensaje'), { target: { value: 'Tengo un boliche y quiero publicar' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('¡Gracias! Te respondemos al mail a la brevedad'));
    expect(enviarConsulta).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Lu Ferreyra', email: 'lu@mail.com', motivo: 'organizacion', mensaje: 'Tengo un boliche y quiero publicar', uid: 'U1' }));
    expect((screen.getByLabelText('Mensaje') as HTMLTextAreaElement).value).toBe('');
  });
  it('si falla, avisa con el mail de contacto y vuelve a habilitar el botón', async () => {
    enviarConsulta.mockRejectedValueOnce(new Error('sin red'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<Ayuda />);
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'lu@mail.com' } });
    fireEvent.change(screen.getByLabelText('Mensaje'), { target: { value: 'No me anda el QR' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith('No se pudo enviar. Escribinos a partazycontacto@gmail.com'));
    expect((screen.getByRole('button', { name: 'Enviar' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
