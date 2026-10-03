import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'uma-palavra-passe-longa';

async function expectNoA11yViolations(page: Page, where: string) {
  // A toast fading in is half transparent; measure contrast once it has settled.
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== 'running'));
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const describe = (v: (typeof violations)[number]) =>
    `${where}: ${v.id} at ${v.nodes.map((n) => `${n.target.join(' ')} [${n.failureSummary?.split('\n').pop()?.trim()}]`).join('; ')}`;
  expect(violations.map(describe)).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page, where: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, where).toBeLessThanOrEqual(0);
}

async function signUp(page: Page, email: string) {
  await page.goto('/#/criar-conta');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Palavra-passe').fill(PASSWORD);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.getByRole('link', { name: 'Preencher o perfil do negócio' })).toBeVisible();
}

test('a shop owner sets up the business and uses every tool', async ({ page }) => {
  test.setTimeout(120_000);   // one long journey with an accessibility scan on every page
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    // The first visit asks the API who is signed in; the 401 for "nobody" is expected.
    if (message.type() === 'error' && !message.text().includes('401')) consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectNoA11yViolations(page, 'início');

  await signUp(page, 'loja@exemplo.pt');
  const cookie = (await page.context().cookies()).find((c) => c.name === 'np_session');
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict' });
  await expectNoA11yViolations(page, 'painel');

  // Profile
  await page.goto('/#/definicoes');
  await page.getByLabel('Nome do negócio').fill('Café Central');
  await page.getByLabel('Cidade').fill('Porto');
  await page.getByLabel('Link de marcação').fill('https://cafe-central.exemplo.pt/marcar');
  await page.getByRole('button', { name: 'Guardar definições' }).click();
  await expect(page.getByText('Definições guardadas')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Nome do negócio')).toHaveValue('Café Central');
  await expectNoA11yViolations(page, 'definições');

  // Post
  await page.goto('/#/publicacoes');
  await page.getByLabel('Serviço ou produto').fill('Pastel de nata');
  await page.getByLabel('A quem se dirige').fill('quem passa na rua');
  await page.getByRole('button', { name: 'Gerar publicação' }).click();
  await expect(page.getByLabel('Legenda')).toHaveValue(/Café Central, Porto/);
  await expect(page.getByLabel('Legenda')).not.toHaveValue(/€|%|desconto|promoção/i);
  await page.getByRole('button', { name: 'Guardar publicação' }).click();
  await expect(page.getByText('1 de 5 publicações guardadas este mês.')).toBeVisible();
  await expectNoA11yViolations(page, 'publicações');

  // Calendar
  await page.goto('/#/calendario');
  await page.getByRole('button', { name: 'Sugerir publicações para este mês' }).click();
  await expect(page.getByText('Sugestões adicionadas ao calendário')).toBeVisible();
  await expect.poll(async () => (await (await page.request.get('/api/calendar')).json()).entries.length).toBeGreaterThan(3);
  await expectNoA11yViolations(page, 'calendário');

  // Replies
  await page.goto('/#/respostas');
  await expect(page.getByLabel('Resposta sobre horários')).toHaveValue(/Café Central/);
  await expectNoA11yViolations(page, 'respostas');

  // Quote and PDF
  await page.goto('/#/orcamentos');
  await page.getByLabel('Nome do cliente').fill('Ana Silva');
  await page.getByLabel('Descrição do serviço 1').fill('Catering para 20 pessoas');
  await page.getByLabel('Preço (€)').first().fill('250');
  await page.getByRole('button', { name: 'Guardar orçamento' }).click();
  await expect(page.getByText('Orçamento guardado')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Descarregar PDF do orçamento n\.º \d{4}-001$/ }).click();
  expect((await download).suggestedFilename()).toMatch(/^orcamento-\d{4}-\d{3}\.pdf$/);
  await page.reload();
  await expect(page.getByText(/Orçamento n\.º \d{4}-001/).first()).toBeVisible();
  await expectNoA11yViolations(page, 'orçamentos');

  // Simulated plan
  await page.goto('/#/planos');
  await page.getByRole('button', { name: 'Experimentar o Pro' }).click();
  await expect(page.getByRole('dialog')).toContainText('Simulação');
  await page.getByRole('button', { name: 'Iniciar teste (simulação)' }).click();
  await expect(page.getByText(/Faltam 7 dias de teste\./)).toBeVisible();
  await expectNoA11yViolations(page, 'planos');

  // Session
  await page.goto('/#/definicoes');
  await page.getByRole('button', { name: 'Terminar sessão' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
  await expectNoA11yViolations(page, 'entrar');
  await page.goto('/#/painel');
  await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
  await page.getByLabel('Email').fill('loja@exemplo.pt');
  await page.getByLabel('Palavra-passe').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Café Central' })).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

test('the API refuses a request from another site and a missing session', async ({ request }) => {
  expect((await request.get('/api/posts')).status()).toBe(401);
  const foreign = await request.post('/api/auth/login', {
    headers: { Origin: 'https://outro-site.example' },
    data: { email: 'loja@exemplo.pt', password: PASSWORD },
  });
  expect(foreign.status()).toBe(403);
});

test('the built page carries a Content-Security-Policy and loads nothing from other sites', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => { if (!r.url().startsWith('http://localhost:4173')) external.push(r.url()); });
  await page.goto('/');
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("object-src 'none'");
  await page.goto('/#/entrar');
  expect(external).toEqual([]);
});

test('on a phone every page fits the screen and the bottom bar works @telemovel', async ({ page }) => {
  await signUp(page, 'telemovel@exemplo.pt');
  await page.getByRole('button', { name: 'Ver com dados de exemplo' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Barbearia Exemplo' })).toBeVisible();

  const bottom = page.getByRole('navigation', { name: 'Principal' }).last();
  for (const name of ['Publicações', 'Calendário', 'Respostas', 'Mais', 'Painel']) {
    await bottom.getByRole('link', { name }).click();
    await expect(bottom.getByRole('link', { name })).toHaveAttribute('aria-current', 'page');
    await expectNoHorizontalScroll(page, name);
  }
  for (const route of ['orcamentos', 'definicoes', 'planos']) {
    await page.goto(`/#/${route}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page, route);
  }
  await expectNoA11yViolations(page, 'planos no telemóvel');
});
