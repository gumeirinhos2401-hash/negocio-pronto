import type { FastifyInstance } from 'fastify';
import { beforeEach, expect, test } from 'vitest';
import { buildApp } from '../src/app';
import { openDb, type Db } from '../src/db';

let app: FastifyInstance;
let db: Db;
let clock: Date;

beforeEach(async () => {
  clock = new Date('2026-10-15T10:00:00Z');
  db = openDb(':memory:');
  app = await buildApp({ db, now: () => clock });
});

const PASSWORD = 'uma-palavra-passe-longa';

async function signUp(email: string): Promise<Record<string, string>> {
  const response = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email, password: PASSWORD } });
  expect(response.statusCode).toBe(201);
  return { np_session: response.cookies[0].value };
}

const call = (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, cookies?: Record<string, string>, payload?: object) =>
  app.inject({ method, url, cookies, payload });

const business = {
  name: 'Café Teste', category: 'Café', city: 'Braga', description: '', hours: '', phone: '', email: '', address: '',
  bookingLink: '', instagram: '', facebook: '', website: '', services: [], accentColor: '#1B4DB1',
};
const post = {
  channel: 'instagram', goal: 'informar', service: 'Pastel de nata', audience: 'quem passa na rua', tone: 'proximo',
  title: 'Título', caption: 'Legenda', cta: 'Fale connosco', hashtags: ['#braga'],
};
const quote = { clientName: 'Ana', items: [{ description: 'Catering', priceCents: 12050 }, { description: 'Entrega', priceCents: 500 }], deadline: '', notes: '', vatNote: 'nenhuma' };
const entry = { date: '2026-10-20', category: 'servico', title: 'Apresentar o serviço', status: 'planeada', postId: null };

test('register sets an httpOnly strict cookie and stores only a password hash', async () => {
  const response = await call('POST', '/api/auth/register', undefined, { email: 'Ana@Exemplo.pt', password: PASSWORD });
  expect(response.statusCode).toBe(201);
  expect(response.cookies[0]).toMatchObject({ name: 'np_session', httpOnly: true, sameSite: 'Strict', path: '/' });
  expect(response.json().user.email).toBe('ana@exemplo.pt');
  const row = db.prepare('SELECT password_hash FROM users').get() as { password_hash: string };
  expect(row.password_hash).toMatch(/^scrypt\$/);
  expect(row.password_hash).not.toContain(PASSWORD);
  const session = db.prepare('SELECT token_hash FROM sessions').get() as { token_hash: string };
  expect(session.token_hash).not.toBe(response.cookies[0].value);
});

test('register rejects a duplicate email, a short password and unknown fields', async () => {
  await signUp('ana@exemplo.pt');
  expect((await call('POST', '/api/auth/register', undefined, { email: 'ANA@exemplo.pt', password: PASSWORD })).statusCode).toBe(409);
  const weak = await call('POST', '/api/auth/register', undefined, { email: 'b@exemplo.pt', password: 'curta' });
  expect(weak.statusCode).toBe(400);
  expect(weak.json().error.fields.password).toBeTruthy();
  expect((await call('POST', '/api/auth/register', undefined, { email: 'c@exemplo.pt', password: PASSWORD, admin: true })).statusCode).toBe(400);
});

test('login gives the same answer for a wrong password and an unknown email', async () => {
  await signUp('ana@exemplo.pt');
  const wrong = await call('POST', '/api/auth/login', undefined, { email: 'ana@exemplo.pt', password: 'errada-errada' });
  const unknown = await call('POST', '/api/auth/login', undefined, { email: 'ninguem@exemplo.pt', password: 'errada-errada' });
  expect(wrong.statusCode).toBe(401);
  expect(unknown.statusCode).toBe(401);
  expect(wrong.json()).toEqual(unknown.json());
  const ok = await call('POST', '/api/auth/login', undefined, { email: 'ana@exemplo.pt', password: PASSWORD });
  expect(ok.statusCode).toBe(200);
  expect((await call('GET', '/api/me', { np_session: ok.cookies[0].value })).json().user.email).toBe('ana@exemplo.pt');
});

test('login is rate limited per address', async () => {
  const attempts = [];
  for (let i = 0; i < 6; i++) attempts.push((await call('POST', '/api/auth/login', undefined, { email: 'x@exemplo.pt', password: 'errada-errada' })).statusCode);
  expect(attempts).toEqual([401, 401, 401, 401, 401, 429]);
});

test('every data route needs a session', async () => {
  for (const url of ['/api/me', '/api/business', '/api/posts', '/api/calendar', '/api/replies', '/api/quotes', '/api/plan', '/api/export']) {
    expect((await call('GET', url)).statusCode, url).toBe(401);
  }
  expect((await call('POST', '/api/posts', { np_session: 'inventado' }, post)).statusCode).toBe(401);
});

test('logout and expiry both end the session', async () => {
  const ana = await signUp('ana@exemplo.pt');
  const bea = await signUp('bea@exemplo.pt');
  expect((await call('POST', '/api/auth/logout', ana)).statusCode).toBe(204);
  expect((await call('GET', '/api/me', ana)).statusCode).toBe(401);
  clock = new Date('2026-10-23T10:00:00Z');
  expect((await call('GET', '/api/me', bea)).statusCode).toBe(401);
});

test('a request from another site is refused', async () => {
  const ana = await signUp('ana@exemplo.pt');
  const foreign = await app.inject({ method: 'PUT', url: '/api/business', cookies: ana, payload: business, headers: { origin: 'https://outro-site.example' } });
  expect(foreign.statusCode).toBe(403);
  const own = await app.inject({ method: 'PUT', url: '/api/business', cookies: ana, payload: business, headers: { origin: 'http://localhost:5173' } });
  expect(own.statusCode).toBe(200);
});

test('business profile is validated and saved', async () => {
  const ana = await signUp('ana@exemplo.pt');
  expect((await call('GET', '/api/business', ana)).json()).toEqual({ business: null });
  const bad = await call('PUT', '/api/business', ana, { ...business, name: '', bookingLink: 'javascript:alert(1)', accentColor: 'red' });
  expect(bad.statusCode).toBe(400);
  expect(Object.keys(bad.json().error.fields).sort()).toEqual(['accentColor', 'bookingLink', 'name']);
  expect((await call('PUT', '/api/business', ana, business)).statusCode).toBe(200);
  expect((await call('GET', '/api/business', ana)).json().business).toMatchObject({ name: 'Café Teste', isExample: false });
});

test('one account cannot read, change or delete another account\'s data', async () => {
  const ana = await signUp('ana@exemplo.pt');
  const bea = await signUp('bea@exemplo.pt');
  await call('PUT', '/api/business', ana, business);
  await call('PUT', '/api/replies', ana, { precos: 'Texto da Ana' });
  const postId = (await call('POST', '/api/posts', ana, post)).json().post.id;
  const quoteId = (await call('POST', '/api/quotes', ana, quote)).json().quote.id;
  const entryId = (await call('POST', '/api/calendar', ana, entry)).json().entry.id;

  expect((await call('GET', '/api/business', bea)).json().business).toBeNull();
  expect((await call('GET', '/api/posts', bea)).json().posts).toEqual([]);
  expect((await call('GET', '/api/quotes', bea)).json().quotes).toEqual([]);
  expect((await call('GET', '/api/calendar', bea)).json().entries).toEqual([]);
  expect((await call('GET', '/api/replies', bea)).json().overrides).toEqual({});
  expect(JSON.stringify((await call('GET', '/api/export', bea)).json())).not.toContain('Ana');

  expect((await call('DELETE', `/api/posts/${postId}`, bea)).statusCode).toBe(404);
  expect((await call('PUT', `/api/quotes/${quoteId}`, bea, quote)).statusCode).toBe(404);
  expect((await call('DELETE', `/api/quotes/${quoteId}`, bea)).statusCode).toBe(404);
  expect((await call('PATCH', `/api/calendar/${entryId}`, bea, { status: 'cancelada' })).statusCode).toBe(404);
  expect((await call('DELETE', `/api/calendar/${entryId}`, bea)).statusCode).toBe(404);
  expect((await call('POST', '/api/calendar', bea, { ...entry, postId })).statusCode).toBe(400);

  expect((await call('GET', '/api/posts', ana)).json().posts).toHaveLength(1);
  expect((await call('GET', '/api/quotes', ana)).json().quotes).toHaveLength(1);
  expect((await call('GET', '/api/calendar', ana)).json().entries[0].status).toBe('planeada');
});

test('the free plan stops at five posts a month and the limit is per account', async () => {
  const ana = await signUp('ana@exemplo.pt');
  const bea = await signUp('bea@exemplo.pt');
  for (let i = 0; i < 5; i++) expect((await call('POST', '/api/posts', ana, post)).statusCode).toBe(201);
  const sixth = await call('POST', '/api/posts', ana, post);
  expect(sixth.statusCode).toBe(403);
  expect(sixth.json().error.code).toBe('limite-plano');
  expect((await call('POST', '/api/posts', bea, post)).statusCode).toBe(201);
  expect((await call('GET', '/api/plan', ana)).json().plan).toMatchObject({ postsUsedThisMonth: 5, freePostLimit: 5, simulated: true });

  clock = new Date('2026-11-01T09:00:00Z');                 // the October session has expired by now
  const login = await call('POST', '/api/auth/login', undefined, { email: 'ana@exemplo.pt', password: PASSWORD });
  expect((await call('POST', '/api/posts', { np_session: login.cookies[0].value }, post)).statusCode).toBe(201);
});

test('the month follows the clock in Portugal', async () => {
  clock = new Date('2026-10-31T23:30:00Z');           // still October in Lisbon (UTC+0 after the clock change)
  const ana = await signUp('ana@exemplo.pt');
  for (let i = 0; i < 5; i++) await call('POST', '/api/posts', ana, post);
  clock = new Date('2026-10-31T23:59:00Z');
  expect((await call('POST', '/api/posts', ana, post)).statusCode).toBe(403);
  clock = new Date('2026-11-01T00:01:00Z');
  expect((await call('POST', '/api/posts', ana, post)).statusCode).toBe(201);
});

test('the simulated trial lifts the limit for seven days and can be used once', async () => {
  const ana = await signUp('ana@exemplo.pt');
  for (let i = 0; i < 5; i++) await call('POST', '/api/posts', ana, post);
  const trial = await call('POST', '/api/plan/trial', ana);
  expect(trial.statusCode).toBe(201);
  expect(trial.json().plan.status).toEqual({ kind: 'teste', daysLeft: 7 });
  expect((await call('POST', '/api/posts', ana, post)).statusCode).toBe(201);
  expect((await call('POST', '/api/plan/trial', ana)).statusCode).toBe(409);

  clock = new Date('2026-10-23T10:00:00Z');
  const again = (await call('POST', '/api/auth/login', undefined, { email: 'ana@exemplo.pt', password: PASSWORD })).cookies[0].value;
  expect((await call('GET', '/api/plan', { np_session: again })).json().plan.status).toEqual({ kind: 'teste-terminado' });
  expect((await call('POST', '/api/posts', { np_session: again }, post)).statusCode).toBe(403);
  expect((await call('DELETE', '/api/plan/trial', { np_session: again })).json().plan.status).toEqual({ kind: 'gratuito' });
  expect((await call('POST', '/api/plan/trial', { np_session: again })).statusCode).toBe(409);
});

test('quote numbers are assigned by the server, in sequence, per account', async () => {
  const ana = await signUp('ana@exemplo.pt');
  const bea = await signUp('bea@exemplo.pt');
  const first = await call('POST', '/api/quotes', ana, quote);
  expect(first.json().quote).toMatchObject({ number: '2026-001', totalCents: 12550 });
  expect((await call('POST', '/api/quotes', ana, quote)).json().quote.number).toBe('2026-002');
  expect((await call('POST', '/api/quotes', bea, quote)).json().quote.number).toBe('2026-001');
  expect((await call('POST', '/api/quotes', ana, { ...quote, number: '1999-999' })).statusCode).toBe(400);
  expect((await call('POST', '/api/quotes', ana, { ...quote, items: [] })).statusCode).toBe(400);
  expect((await call('POST', '/api/quotes', ana, { ...quote, items: [{ description: 'x', priceCents: -1 }] })).statusCode).toBe(400);
  const edited = await call('PUT', `/api/quotes/${first.json().quote.id}`, ana, { ...quote, clientName: 'Ana Silva' });
  expect(edited.json().quote).toMatchObject({ number: '2026-001', clientName: 'Ana Silva' });
});

test('calendar entries are validated, filtered by month and updated', async () => {
  const ana = await signUp('ana@exemplo.pt');
  expect((await call('POST', '/api/calendar', ana, { ...entry, date: '2026-02-30' })).statusCode).toBe(400);
  expect((await call('POST', '/api/calendar', ana, { ...entry, status: 'enviada' })).statusCode).toBe(400);
  const id = (await call('POST', '/api/calendar', ana, entry)).json().entry.id;
  await call('POST', '/api/calendar', ana, { ...entry, date: '2026-11-02' });
  expect((await call('GET', '/api/calendar?month=2026-10', ana)).json().entries).toHaveLength(1);
  expect((await call('GET', '/api/calendar', ana)).json().entries).toHaveLength(2);
  const patched = await call('PATCH', `/api/calendar/${id}`, ana, { status: 'publicada' });
  expect(patched.json().entry).toMatchObject({ status: 'publicada', title: entry.title, date: entry.date });
});

test('generated drafts use the saved profile and invent nothing', async () => {
  const ana = await signUp('ana@exemplo.pt');
  const input = { channel: 'instagram', goal: 'divulgar-servico', service: 'Pastel de nata', audience: 'quem passa na rua', tone: 'proximo' };
  const empty = (await call('POST', '/api/posts/generate', ana, input)).json().draft;
  expect([empty.title, empty.caption, empty.cta].join(' ')).not.toMatch(/€|%|\d|desconto|promoção|grátis/i);
  await call('PUT', '/api/business', ana, business);
  expect((await call('POST', '/api/posts/generate', ana, input)).json().draft.caption).toContain('Café Teste');
  expect((await call('GET', '/api/posts', ana)).json().posts).toEqual([]);
});

test('deleting the account needs the password and removes every row', async () => {
  const ana = await signUp('ana@exemplo.pt');
  await call('PUT', '/api/business', ana, business);
  await call('POST', '/api/posts', ana, post);
  await call('POST', '/api/quotes', ana, quote);
  await call('POST', '/api/calendar', ana, entry);
  await call('POST', '/api/plan/trial', ana);
  expect((await call('DELETE', '/api/account', ana, { password: 'errada' })).statusCode).toBe(401);
  expect((await call('DELETE', '/api/account', ana, { password: PASSWORD })).statusCode).toBe(204);
  for (const table of ['users', 'sessions', 'businesses', 'posts', 'calendar_entries', 'quotes', 'plans']) {
    expect((db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n, table).toBe(0);
  }
});
