import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import App from '../../src/App';
import { demoData } from '../../src/domain/demo';
import { clearAll, save } from '../../src/storage/store';

const ROUTES = ['/', '/painel', '/publicacoes', '/calendario', '/respostas', '/orcamentos', '/definicoes', '/planos', '/mais', '/nao-existe'];

function open(route: string) {
  window.location.hash = `#${route}`;
  return render(<App />);
}

function loadDemo() {
  const demo = demoData(new Date());
  save('negocio', demo.business);
  save('publicacoes', demo.posts);
  save('calendario', demo.calendar);
  save('orcamentos', demo.quotes);
}

beforeEach(() => {
  clearAll();
  localStorage.clear();
  window.scrollTo = vi.fn();
});

test.each(ROUTES)('%s renders one h1 and a main landmark with no data', (route) => {
  open(route);
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(screen.getByRole('main')).toBeInTheDocument();
});

test.each(ROUTES)('%s renders with example data', (route) => {
  loadDemo();
  open(route);
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
});

test.each(ROUTES)('%s starts with defaults when stored data is corrupt', (route) => {
  for (const key of ['publicacoes', 'calendario', 'respostas', 'orcamentos', 'plano']) {
    localStorage.setItem(`np:v1:${key}`, '{"broken": [1, 2');
  }
  localStorage.setItem('np:v1:negocio', JSON.stringify({ name: 5, services: 'x' }));
  open(route);
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
});

test('the mobile bar has exactly five links and marks the current page', () => {
  open('/calendario');
  const bars = screen.getAllByRole('navigation', { name: 'Principal' });
  const bottom = bars[bars.length - 1];
  const links = within(bottom).getAllByRole('link');
  expect(links.map((link) => link.textContent)).toEqual(['Painel', 'Publicações', 'Calendário', 'Respostas', 'Mais']);
  expect(within(bottom).getByRole('link', { name: 'Calendário' })).toHaveAttribute('aria-current', 'page');
});

test('the dashboard offers example data on a first visit and can remove it again', () => {
  open('/painel');
  fireEvent.click(screen.getByRole('button', { name: 'Ver com dados de exemplo' }));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Barbearia Exemplo');
  expect(screen.getAllByText('Exemplo').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Apagar dados de exemplo' }));
  expect(screen.getByRole('link', { name: 'Preencher o perfil do negócio' })).toBeInTheDocument();
  expect(localStorage.getItem('np:v1:publicacoes')).toBe('[]');
});

test('a post is generated, saved, and blocked at the free limit', () => {
  open('/publicacoes');
  fireEvent.click(screen.getByRole('button', { name: 'Gerar publicação' }));
  const service = screen.getByLabelText('Serviço ou produto');
  expect(service).toHaveAttribute('aria-invalid', 'true');
  expect(service).toHaveFocus();

  fireEvent.change(service, { target: { value: 'Corte de cabelo' } });
  fireEvent.change(screen.getByLabelText('A quem se dirige'), { target: { value: 'clientes do bairro' } });
  for (let saved = 1; saved <= 5; saved++) {
    fireEvent.click(screen.getByRole('button', { name: 'Gerar publicação' }));
    expect((screen.getByLabelText('Legenda') as HTMLTextAreaElement).value).toContain('Corte de cabelo');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar publicação' }));
    expect(screen.getByText('Publicação guardada')).toBeInTheDocument();
    expect(screen.getByText(`${saved} de 5 publicações guardadas este mês.`)).toBeInTheDocument();
  }
  fireEvent.click(screen.getByRole('button', { name: 'Gerar publicação' }));
  expect(screen.queryByRole('button', { name: 'Guardar publicação' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Ver planos' })).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Copiar tudo' }).length).toBeGreaterThan(0);
});

test('a quote needs a client and a valid price before it is saved', () => {
  open('/orcamentos');
  fireEvent.click(screen.getByRole('button', { name: 'Guardar orçamento' }));
  const client = screen.getByLabelText('Nome do cliente');
  expect(client).toHaveAttribute('aria-invalid', 'true');
  expect(client).toHaveFocus();

  fireEvent.change(client, { target: { value: 'Ana' } });
  fireEvent.change(screen.getByLabelText('Descrição do serviço 1'), { target: { value: 'Corte' } });
  const price = screen.getByLabelText('Preço (€)');
  fireEvent.change(price, { target: { value: 'abc' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar orçamento' }));
  expect(price).toHaveAttribute('aria-invalid', 'true');
  expect(price).toHaveFocus();

  fireEvent.change(price, { target: { value: '12,50' } });
  const year = new Date().getFullYear();
  const sheet = screen.getByRole('article', { name: `Orçamento n.º ${year}-001` });
  expect(within(sheet).getAllByText(/12,50/)).toHaveLength(2);       // the line and the total
  fireEvent.click(screen.getByRole('button', { name: 'Guardar orçamento' }));
  expect(screen.getByText('Orçamento guardado')).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('np:v1:orcamentos') ?? '[]')).toHaveLength(1);
});

test('settings reject an unsafe link and save a valid profile', () => {
  open('/definicoes');
  fireEvent.change(screen.getByLabelText('Nome do negócio'), { target: { value: 'Café Central' } });
  const link = screen.getByLabelText('Link de marcação');
  fireEvent.change(link, { target: { value: 'javascript:alert(1)' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar definições' }));
  expect(link).toHaveAttribute('aria-invalid', 'true');
  expect(link).toHaveFocus();
  expect(localStorage.getItem('np:v1:negocio')).toBeNull();

  fireEvent.change(link, { target: { value: 'https://exemplo.pt/marcar' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar definições' }));
  expect(screen.getByText('Definições guardadas')).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('np:v1:negocio') ?? '{}').name).toBe('Café Central');
});

test('a failed save keeps the page working and explains what happened', () => {
  open('/definicoes');
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('full', 'QuotaExceededError');
  });
  fireEvent.change(screen.getByLabelText('Nome do negócio'), { target: { value: 'Café Central' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar definições' }));
  spy.mockRestore();
  expect(screen.getByText('Não foi possível guardar neste navegador. Os dados ficam disponíveis só até fechar a página.')).toBeInTheDocument();
  expect(screen.getByLabelText('Nome do negócio')).toHaveValue('Café Central');
});

test('the simulated checkout says no payment is taken and starts a trial', () => {
  open('/planos');
  fireEvent.click(screen.getByRole('button', { name: 'Experimentar o Pro' }));
  expect(screen.getAllByText(/Simulação: nenhum pagamento é cobrado/).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar teste (simulação)' }));
  expect(screen.getByText(/Faltam 7 dias de teste\./)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Terminar teste' }));
  expect(screen.getByRole('button', { name: 'Experimentar o Pro' })).toBeInTheDocument();
});

test('the calendar suggests a month and never claims to publish', () => {
  open('/calendario');
  fireEvent.click(screen.getByRole('button', { name: 'Sugerir publicações para este mês' }));
  expect(screen.getByText('Sugestões adicionadas ao calendário')).toBeInTheDocument();
  expect(screen.getAllByText('Planeada').length).toBeGreaterThan(3);
  expect(screen.getByText(/A Negócio Pronto não publica nas redes sociais\./)).toBeInTheDocument();
});
