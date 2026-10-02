import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { open, PASSWORD, request, resetServer, signUp, testFetch } from './harness';

const PUBLIC_ROUTES = ['/', '/entrar', '/criar-conta', '/recuperar', '/repor', '/verificar'];
const APP_ROUTES = ['/painel', '/publicacoes', '/calendario', '/respostas', '/orcamentos', '/definicoes', '/planos', '/mais', '/nao-existe'];

beforeEach(async () => {
  await resetServer();
  vi.stubGlobal('fetch', testFetch);
  window.scrollTo = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const h1 = () => screen.findByRole('heading', { level: 1 });

test.each(PUBLIC_ROUTES)('%s renders one h1 without a session', async (route) => {
  open(route);
  await h1();
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(screen.getByRole('main')).toBeInTheDocument();
});

test.each(APP_ROUTES)('%s sends a visitor without a session to the sign-in page', async (route) => {
  open(route);
  expect(await h1()).toHaveTextContent('Entrar');
});

test.each(APP_ROUTES)('%s renders one h1 for a new account', async (route) => {
  await signUp();
  open(route);
  await h1();
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(screen.getByRole('main')).toBeInTheDocument();
});

test.each(APP_ROUTES)('%s renders with example data', async (route) => {
  await signUp();
  await request('POST', '/api/demo');
  open(route);
  await h1();
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
});

test('an account is created from the form and can sign out and back in', async () => {
  open('/criar-conta');
  fireEvent.click(await screen.findByRole('button', { name: 'Criar conta' }));
  expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText('Email')).toHaveFocus();

  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ana@exemplo.pt' } });
  fireEvent.change(screen.getByLabelText('Palavra-passe'), { target: { value: 'curta' } });
  fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
  expect(screen.getByLabelText('Palavra-passe')).toHaveAttribute('aria-invalid', 'true');

  fireEvent.change(screen.getByLabelText('Palavra-passe'), { target: { value: PASSWORD } });
  fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
  expect(await screen.findByRole('link', { name: 'Preencher o perfil do negócio' })).toBeInTheDocument();

  fireEvent.click(screen.getAllByRole('link', { name: 'Definições' })[0]);
  expect(await screen.findByText('ana@exemplo.pt')).toBeInTheDocument();
  expect(screen.getByText('Email por confirmar')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Terminar sessão' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ana@exemplo.pt' } });
  fireEvent.change(screen.getByLabelText('Palavra-passe'), { target: { value: 'palavra-passe-errada' } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  expect(await screen.findByText('Email ou palavra-passe incorretos.')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Palavra-passe'), { target: { value: PASSWORD } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Painel' })).toBeInTheDocument();
});

test('creating an account with an email already in use says so on the field', async () => {
  await signUp();
  await request('POST', '/api/auth/logout');
  open('/criar-conta');
  fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'ana@exemplo.pt' } });
  fireEvent.change(screen.getByLabelText('Palavra-passe'), { target: { value: PASSWORD } });
  fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
  expect(await screen.findByText('Já existe uma conta com este email.')).toBeInTheDocument();
  expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
});

test('asking for a password reset answers the same way for any email', async () => {
  open('/recuperar');
  fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'ninguem@exemplo.pt' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar ligação' }));
  expect(await screen.findByText(/Se existir uma conta com esse email/)).toBeInTheDocument();
});

test('the mobile bar has exactly five links and marks the current page', async () => {
  await signUp();
  open('/calendario');
  await h1();
  const bars = screen.getAllByRole('navigation', { name: 'Principal' });
  const bottom = bars[bars.length - 1];
  const links = within(bottom).getAllByRole('link');
  expect(links.map((link) => link.textContent)).toEqual(['Painel', 'Publicações', 'Calendário', 'Respostas', 'Mais']);
  expect(within(bottom).getByRole('link', { name: 'Calendário' })).toHaveAttribute('aria-current', 'page');
});

test('the dashboard offers example data on a first visit and can remove it again', async () => {
  await signUp();
  open('/painel');
  fireEvent.click(await screen.findByRole('button', { name: 'Ver com dados de exemplo' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Barbearia Exemplo' })).toBeInTheDocument();
  expect(screen.getAllByText('Exemplo').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Apagar dados de exemplo' }));
  expect(await screen.findByRole('link', { name: 'Preencher o perfil do negócio' })).toBeInTheDocument();
  expect((await request<{ posts: unknown[] }>('GET', '/api/posts')).posts).toEqual([]);
});

test('a post is generated, saved on the server, and blocked at the free limit', async () => {
  await signUp();
  open('/publicacoes');
  fireEvent.click(await screen.findByRole('button', { name: 'Gerar publicação' }));
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
    expect(await screen.findByText(`${saved} de 5 publicações guardadas este mês.`)).toBeInTheDocument();
  }
  fireEvent.click(screen.getByRole('button', { name: 'Gerar publicação' }));
  expect(screen.queryByRole('button', { name: 'Guardar publicação' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Ver planos' })).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Copiar tudo' }).length).toBeGreaterThan(0);
  expect((await request<{ posts: unknown[] }>('GET', '/api/posts')).posts).toHaveLength(5);
});

test('a quote needs a client and a valid price before it is saved', async () => {
  await signUp();
  open('/orcamentos');
  fireEvent.click(await screen.findByRole('button', { name: 'Guardar orçamento' }));
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
  await waitFor(async () => {
    const { quotes } = await request<{ quotes: { number: string; totalCents: number }[] }>('GET', '/api/quotes');
    expect(quotes).toMatchObject([{ number: `${year}-001`, totalCents: 1250 }]);
  });
});

test('settings reject an unsafe link and save a valid profile on the server', async () => {
  await signUp();
  open('/definicoes');
  fireEvent.change(await screen.findByLabelText('Nome do negócio'), { target: { value: 'Café Central' } });
  const link = screen.getByLabelText('Link de marcação');
  fireEvent.change(link, { target: { value: 'javascript:alert(1)' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar definições' }));
  expect(link).toHaveAttribute('aria-invalid', 'true');
  expect(link).toHaveFocus();
  expect((await request<{ business: unknown }>('GET', '/api/business')).business).toBeNull();

  fireEvent.change(link, { target: { value: 'https://exemplo.pt/marcar' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar definições' }));
  expect(screen.getByText('Definições guardadas')).toBeInTheDocument();
  await waitFor(async () => {
    expect((await request<{ business: { name: string } | null }>('GET', '/api/business')).business?.name).toBe('Café Central');
  });
});

test('when the server cannot be reached the user is told and the saved data comes back', async () => {
  await signUp();
  await request('PUT', '/api/replies', { precos: 'Texto guardado antes' });
  open('/respostas');
  const text = (await screen.findAllByRole('textbox'))[0] as HTMLTextAreaElement;
  expect(text.value).toBe('Texto guardado antes');

  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
    (init?.method === 'PUT' ? Promise.reject(new TypeError('network down')) : testFetch(input, init)));
  fireEvent.change(text, { target: { value: 'Texto que não chega ao servidor' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Guardar alteração' })[0]);
  expect(await screen.findByText('Não foi possível guardar. Os dados foram repostos como estavam no servidor.')).toBeInTheDocument();
  expect((await request<{ overrides: { precos: string } }>('GET', '/api/replies')).overrides.precos).toBe('Texto guardado antes');
});

test('an expired session sends the user back to the sign-in page', async () => {
  await signUp();
  open('/respostas');
  await h1();
  await request('POST', '/api/auth/logout');                    // the session ends somewhere else
  fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Outro texto' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Guardar alteração' })[0]);
  expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument();
});

test('the simulated checkout says no payment is taken and the trial can be used once', async () => {
  await signUp();
  open('/planos');
  fireEvent.click(await screen.findByRole('button', { name: 'Experimentar o Pro' }));
  expect(screen.getAllByText(/Simulação: nenhum pagamento é cobrado/).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar teste (simulação)' }));
  expect(await screen.findByText(/Faltam 7 dias de teste\./)).toBeInTheDocument();
  await waitFor(async () => {
    expect((await request<{ plan: { tier: string } }>('GET', '/api/plan')).plan.tier).toBe('pro');
  });
  fireEvent.click(screen.getByRole('button', { name: 'Terminar teste' }));
  expect(await screen.findByText('O teste gratuito já foi usado nesta conta.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Experimentar o Pro' })).toBeNull();
});

test('the calendar suggests a month, saves it and never claims to publish', async () => {
  await signUp();
  open('/calendario');
  fireEvent.click(await screen.findByRole('button', { name: 'Sugerir publicações para este mês' }));
  expect(screen.getByText('Sugestões adicionadas ao calendário')).toBeInTheDocument();
  expect(screen.getAllByText('Planeada').length).toBeGreaterThan(3);
  expect(screen.getByText(/A Negócio Pronto não publica nas redes sociais\./)).toBeInTheDocument();
  await waitFor(async () => {
    expect((await request<{ entries: unknown[] }>('GET', '/api/calendar')).entries.length).toBeGreaterThan(3);
  }, { timeout: 5000 });
});

test('deleting the account asks for the password', async () => {
  await signUp();
  open('/definicoes');
  fireEvent.click(await screen.findByRole('button', { name: 'Apagar conta' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Palavra-passe'), { target: { value: 'palavra-passe-errada' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Apagar conta' }));
  expect(await within(dialog).findByText('Palavra-passe incorreta.')).toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText('Palavra-passe'), { target: { value: PASSWORD } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Apagar conta' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument();
  expect((await testFetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ana@exemplo.pt', password: PASSWORD }) })).status).toBe(401);
});
