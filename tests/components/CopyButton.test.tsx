import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { CopyButton } from '../../src/components/CopyButton';
import { ToastProvider } from '../../src/components/Toast';

function setClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

test('copies the text and confirms it', async () => {
  const writeText = vi.fn(() => Promise.resolve());
  setClipboard(writeText);
  render(<ToastProvider><CopyButton text="Olá, bom dia" /></ToastProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
  expect(writeText).toHaveBeenCalledWith('Olá, bom dia');
  expect(await screen.findByText('Texto copiado')).toBeInTheDocument();
});

test('explains what to do when copying fails', async () => {
  setClipboard(() => Promise.reject(new Error('blocked')));
  render(<ToastProvider><CopyButton text="Olá" label="Copiar título" /></ToastProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Copiar título' }));
  expect(await screen.findByText('Não foi possível copiar. Selecione o texto e copie manualmente.')).toBeInTheDocument();
});

test('the toast sits in a polite live region', () => {
  setClipboard(() => Promise.resolve());
  const { container } = render(<ToastProvider><CopyButton text="Olá" /></ToastProvider>);
  expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
});
