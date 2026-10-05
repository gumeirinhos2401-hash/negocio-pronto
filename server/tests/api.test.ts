import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { buildApp } from '../src/app';
import { parseTrustProxy } from '../src/config';
import { openEmbedded, openPostgres, type Db } from '../src/db';
import type { Message } from '../src/mail';

let app: FastifyInstance;
let db: Db;
let clock: Date;
let outbox: Message[];

const mailer = { send: async (message: Message) => { outbox.push(message); } };

// CI runs these tests against a real Postgres server as well (TEST_DATABASE_URL).
beforeAll(async () => { db = process.env.TEST_DATABASE_URL ? await openPostgres(process.env.TEST_DATABASE_URL) : await openEmbedded(); });
afterAll(async () => { await db.close(); });

beforeEach(async () => {
  await db.query('TRUNCATE users, rate_limits CASCADE');
  clock = new Date('2026-10-15T10:00:00Z');
  outbox = [];
  app = await buildApp({ db, mailer, now: () => clock });
});

const PASSWORD = 'uma-palavra-passe-longa';

async function signUp(email: string): Promise<Record<string, string>> {
  const response = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email, password: PASSWORD } });
  expect(response.statusCode).toBe(201);
  return { np_session: response.cookies[0].value };
}

async function signIn(email: string, password = PASSWORD): Promise<Record<string, string>> {
  const response = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } });
  expect(response.statusCode).toBe(200);
  return { np_session: response.cookies[0].value };
}

const call = (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, cookies?: Record<string, string>, payload?: object) =>
  app.inject({ method, url, cookies, payload });

const count = async (table: string): Promise<number> => (await db.query(`SELECT COUNT(*)::int AS n FROM ${table}`)).rows[0].n;
const tokenIn = (message: Message): string => /token=([\w-]+)/.exec(message.text)![1];

const business = {
  name: 'Café Teste', category: 'Café', city: 'Braga', description: '', hours: '', phone: '', email: '', address: '',
  bookingLink: '', instagram: '', facebook: '', website: '', services: [{ id: 's1', name: 'Bica', priceCents: 80 }], accentColor: '#1B4DB1',
};
const post = {
  channel: 'instagram', goal: 'informar', service: 'Pastel de nata', audience: 'quem passa na rua', tone: 'proximo',
  title: 'Título', caption: 'Legenda', cta: 'Fale connosco', hashtags: ['#braga'],
};
const quote = { clientName: 'Ana', items: [{ description: 'Catering', priceCents: 12050 }, { description: 'Entrega', priceCents: 500 }], deadline: '', notes: '', vatNote: 'nenhuma' };
const entry = { date: '2026-10-20', category: 'servico', title: 'Apresentar o serviço', status: 'planeada', postId: null };

test('register sets an httpOnly strict cookie and stores only hashes', async () => {
  const response = await call('POST', '/api/auth/register', undefined, { email: 'Ana@Exemplo.pt', password: PASSWORD });
  expect(response.statusCode).toBe(201);
  expect(response.cookies[0]).toMatchObject({ name: 'np_session', httpOnly: true, sameSite: 'Strict', path: '/' });
  expect(response.json().user).toMatchObject({ email: 'ana@exemplo.pt', emailVerified: false });
  const user = (await db.query('SELECT password_hash FROM users')).rows[0];
  expect(user.password_hash).toMatch(/^scrypt\$/);
  expect(user.password_hash).not.toContain(PASSWORD);
  expect((await db.query('SELECT token_hash FROM sessions')).rows[0].token_hash).not.toBe(response.cookies[0].value);
  expect((await db.query('SELECT token_hash FROM email_tokens')).rows[0].token_hash).not.toBe(tokenIn(outbox[0]));
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
  expect((await call('GET', '/api/me', await signIn('ana@exemplo.pt'))).json().user.email).toBe('ana@exemplo.pt');
});

test('the login limit is kept in the database, so a restart does not reset it', async () => {
  const attempt = async () => (await call('POST', '/api/auth/login', undefined, { email: 'x@exemplo.pt', password: 'errada-errada' })).statusCode;
  const first = [];
  for (let i = 0; i < 6; i++) first.push(await attempt());
  expect(first).toEqual([401, 401, 401, 401, 401, 429]);
  app = await buildApp({ db, mailer, now: () => clock });   // a "restart"
  expect(await attempt()).toBe(429);
  clock = new Date(clock.getTime() + 61_000);
  expect(await attempt()).toBe(401);
});

test('one account is locked out after ten wrong passwords, whatever the address', async () => {
  await signUp('ana@exemplo.pt');
  const codes = [];
  for (let i = 0; i < 11; i++) {
    codes.push((await app.inject({ method: 'POST', url: '/api/auth/login', remoteAddress: `10.0.0.${i}`, payload: { email: 'ana@exemplo.pt', password: 'errada-errada' } })).statusCode);
  }
  expect(codes.slice(0, 10).every((code) => code === 401)).toBe(true);
  expect(codes[10]).toBe(429);
  // The owner, with the right password, still gets in: guessing cannot lock them out.
  const owner = await app.inject({ method: 'POST', url: '/api/auth/login', remoteAddress: '10.0.1.1', payload: { email: 'ana@exemplo.pt', password: PASSWORD } });
  expect(owner.statusCode).toBe(200);
});

test('email checks stay fast on hostile input', async () => {
  const hostile = 'a@' + '.'.repeat(4000) + '@';
  let started = performance.now();
  expect((await call('POST', '/api/auth/register', undefined, { email: hostile, password: PASSWORD })).statusCode).toBe(400);
  expect((await call('POST', '/api/auth/login', undefined, { email: 'a@' + '.'.repeat(99_970) + '@', password: 'x' })).statusCode).toBe(413);
  expect(performance.now() - started).toBeLessThan(500);

  const ana = await signUp('ana@exemplo.pt');
  started = performance.now();
  const response = await call('PUT', '/api/business', ana, { ...business, email: 'a@' + '.'.repeat(90_000) + '@' });
  expect(response.statusCode).toBe(400);
  expect(performance.now() - started).toBeLessThan(500);
  const valid = await call('PUT', '/api/business', ana, { ...business, email: 'ola@cafe-central.pt' });
  expect(valid.statusCode).toBe(200);
});

test('an account cannot send unlimited changes', async () => {
  const ana = await signUp('ana@exemplo.pt');
  const codes = [];
  for (let i = 0; i < 121; i++) codes.push((await call('PUT', '/api/replies', ana, { precos: `Texto ${i}` })).statusCode);
  expect(codes.slice(0, 120).every((code) => code === 200)).toBe(true);
  expect(codes[120]).toBe(429);
  expect((await call('GET', '/api/replies', ana)).statusCode).toBe(200);
});

test('TRUST_PROXY never trusts every hop', () => {
  expect(parseTrustProxy(undefined)).toBe(false);
  expect(parseTrustProxy('false')).toBe(false);
  expect(parseTrustProxy('1')).toBe(1);
  expect(parseTrustProxy('10.0.0.0/8, 192.168.1.10')).toEqual(['10.0.0.0/8', '192.168.1.10']);
  expect(() => parseTrustProxy('true')).toThrow(/TRUST_PROXY=true/);
});

test('TRUST_PROXY with something that is not an address fails without printing the value', () => {
  // A secret pasted into the wrong variable must not end up in the logs.
  const secret = 're_not-a-real-key_123';
  expect(() => parseTrustProxy(secret)).toThrow(/TRUST_PROXY/);
  expect(() => parseTrustProxy(secret)).not.toThrow(new RegExp(secret));
  expect(() => parseTrustProxy('10.0.0.0/8, nonsense')).toThrow(/TRUST_PROXY/);
  expect(parseTrustProxy('::1, 2001:db8::/32')).toEqual(['::1', '2001:db8::/32']);
});

test('email confirmation works once and only with a valid link', async () => {
  const ana = await signUp('ana@exemplo.pt');
  expect(outbox[0]).toMatchObject({ to: 'ana@exemplo.pt' });
  expect(outbox[0].text).toContain('http://localhost:5173/#/verificar?token=');
  const token = tokenIn(outbox[0]);
  expect((await call('POST', '/api/auth/verify', undefined, { token: 'x'.repeat(43) })).statusCode).toBe(400);
  expect((await call('POST', '/api/auth/verify', undefined, { token })).statusCode).toBe(204);
  expect((await call('GET', '/api/me', ana)).json().user.emailVerified).toBe(true);
  expect((await call('POST', '/api/auth/verify', undefined, { token })).statusCode).toBe(400);
  expect((await call('POST', '/api/auth/verify/resend', ana)).statusCode).toBe(409);
});

test('a confirmation link expires and can be sent again', async () => {
  const ana = await signUp('ana@exemplo.pt');
  clock = new Date(clock.getTime() + 25 * 60 * 60 * 1000);
  expect((await call('POST', '/api/auth/verify', undefined, { token: tokenIn(outbox[0]) })).statusCode).toBe(400);
  expect((await call('POST', '/api/auth/verify/resend', ana)).statusCode).toBe(204);
  expect((await call('POST', '/api/auth/verify', undefined, { token: tokenIn(outbox[1]) })).statusCode).toBe(204);
});

test('password reset replaces the password, ends every session and the link works once', async () => {
  const ana = await signUp('ana@exemplo.pt');
  expect((await call('POST', '/api/auth/forgot', undefined, { email: 'ninguem@exemplo.pt' })).statusCode).toBe(204);
  expect(outbox).toHaveLength(1);                                 // only the confirmation mail: nothing for an unknown email
  expect((await call('POST', '/api/auth/forgot', undefined, { email: 'ana@exemplo.pt' })).statusCode).toBe(204);
  await vi.waitFor(() => expect(outbox).toHaveLength(2));        // the reply does not wait for the mail
  const token = tokenIn(outbox[1]);
  expect(outbox[1].text).toContain('/#/repor?token=');

  expect((await call('POST', '/api/auth/reset', undefined, { token, password: 'curta' })).statusCode).toBe(400);
  expect((await call('POST', '/api/auth/reset', undefined, { token, password: 'outra-palavra-passe' })).statusCode).toBe(204);
  expect((await call('GET', '/api/me', ana)).statusCode).toBe(401);
  expect((await call('POST', '/api/auth/login', undefined, { email: 'ana@exemplo.pt', password: PASSWORD })).statusCode).toBe(401);
  expect((await call('GET', '/api/me', await signIn('ana@exemplo.pt', 'outra-palavra-passe'))).json().user.emailVerified).toBe(true);
  expect((await call('POST', '/api/auth/reset', undefined, { token, password: 'mais-uma-palavra-passe' })).statusCode).toBe(400);
});

test('a reset link expires after one hour', async () => {
  await signUp('ana@exemplo.pt');
  await call('POST', '/api/auth/forgot', undefined, { email: 'ana@exemplo.pt' });
  await vi.waitFor(() => expect(outbox).toHaveLength(2));
  clock = new Date(clock.getTime() + 61 * 60 * 1000);
  expect((await call('POST', '/api/auth/reset', undefined, { token: tokenIn(outbox[1]), password: 'outra-palavra-passe' })).statusCode).toBe(400);
});

test('every data route needs a session', async () => {
  for (const url of ['/api/me', '/api/bootstrap', '/api/business', '/api/posts', '/api/calendar', '/api/replies', '/api/quotes', '/api/plan', '/api/export']) {
    expect((await call('GET', url)).statusCode, url).toBe(401);
  }
  expect((await call('POST', '/api/posts', { np_session: 'inventado' }, post)).statusCode).toBe(401);
  expect((await call('POST', '/api/demo')).statusCode).toBe(401);
  expect((await call('DELETE', '/api/data')).statusCode).toBe(401);
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
  expect((await call('GET', '/api/business', ana)).json().business).toEqual({ ...business, isExample: false });
});

test('one account cannot read, change or delete another account\'s data', async () => {
  const ana = await signUp('ana@exemplo.pt');
  const bea = await signUp('bea@exemplo.pt');
  await call('PUT', '/api/business', ana, business);
  await call('PUT', '/api/replies', ana, { precos: 'Texto da Ana' });
  const postId = (await call('POST', '/api/posts', ana, post)).json().post.id;
  const quoteId = (await call('POST', '/api/quotes', ana, quote)).json().quote.id;
  const entryId = (await call('POST', '/api/calendar', ana, entry)).json().entry.id;

  const seen = (await call('GET', '/api/bootstrap', bea)).json();
  expect(seen).toMatchObject({ business: null, posts: [], entries: [], overrides: {}, quotes: [] });
  expect(JSON.stringify((await call('GET', '/api/export', bea)).json())).not.toContain('Ana');

  expect((await call('DELETE', `/api/posts/${postId}`, bea)).statusCode).toBe(404);
  expect((await call('PUT', `/api/quotes/${quoteId}`, bea, quote)).statusCode).toBe(404);
  expect((await call('DELETE', `/api/quotes/${quoteId}`, bea)).statusCode).toBe(404);
  expect((await call('PATCH', `/api/calendar/${entryId}`, bea, { status: 'cancelada' })).statusCode).toBe(404);
  expect((await call('DELETE', `/api/calendar/${entryId}`, bea)).statusCode).toBe(404);
  expect((await call('POST', '/api/calendar', bea, { ...entry, postId })).statusCode).toBe(400);
  // Reusing another account's id must not overwrite or reveal the record.
  expect((await call('POST', '/api/posts', bea, { ...post, id: postId })).statusCode).toBe(409);
  expect((await call('POST', '/api/quotes', bea, { ...quote, id: quoteId })).statusCode).toBe(409);
  expect((await call('POST', '/api/calendar', bea, { ...entry, id: entryId })).statusCode).toBe(409);
  await call('DELETE', '/api/data', bea);

  const kept = (await call('GET', '/api/bootstrap', ana)).json();
  expect(kept.posts).toHaveLength(1);
  expect(kept.quotes[0].items).toHaveLength(2);
  expect(kept.entries[0].status).toBe('planeada');
  expect(kept.overrides).toEqual({ precos: 'Texto da Ana' });
  expect(kept.business.name).toBe('Café Teste');
});

test('a malformed id is a plain 404', async () => {
  const ana = await signUp('ana@exemplo.pt');
  expect((await call('DELETE', '/api/posts/nao-e-um-id', ana)).statusCode).toBe(404);
  expect((await call('PUT', "/api/quotes/1'%20OR%20'1'='1", ana, quote)).statusCode).toBe(404);
  expect((await call('POST', '/api/posts', ana, { ...post, id: 'x' })).statusCode).toBe(400);
});

test('the free plan stops at five posts a month and deleting does not give a slot back', async () => {
  const ana = await signUp('ana@exemplo.pt');
  const bea = await signUp('bea@exemplo.pt');
  const ids = [];
  for (let i = 0; i < 5; i++) {
    const response = await call('POST', '/api/posts', ana, post);
    expect(response.statusCode).toBe(201);
    ids.push(response.json().post.id);
  }
  const sixth = await call('POST', '/api/posts', ana, post);
  expect(sixth.statusCode).toBe(403);
  expect(sixth.json().error.code).toBe('limite-plano');
  expect((await call('DELETE', `/api/posts/${ids[0]}`, ana)).statusCode).toBe(204);
  expect((await call('POST', '/api/posts', ana, post)).statusCode).toBe(403);
  await call('DELETE', '/api/data', ana);
  expect((await call('POST', '/api/posts', ana, post)).statusCode).toBe(403);
  expect((await call('POST', '/api/posts', bea, post)).statusCode).toBe(201);
  expect((await call('GET', '/api/plan', ana)).json().plan).toMatchObject({ postsUsedThisMonth: 5, freePostLimit: 5, simulated: true });

  clock = new Date('2026-11-01T09:00:00Z');                 // the October session has expired by now
  expect((await call('POST', '/api/posts', await signIn('ana@exemplo.pt'), post)).statusCode).toBe(201);
});

test('requests at the same time cannot pass the limit together', async () => {
  const ana = await signUp('ana@exemplo.pt');
  const codes = (await Promise.all(Array.from({ length: 8 }, () => call('POST', '/api/posts', ana, post)))).map((r) => r.statusCode).sort();
  expect(codes).toEqual([201, 201, 201, 201, 201, 403, 403, 403]);
  expect(await count('posts')).toBe(5);
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
  let ana = await signUp('ana@exemplo.pt');
  for (let i = 0; i < 5; i++) await call('POST', '/api/posts', ana, post);
  const trial = await call('POST', '/api/plan/trial', ana);
  expect(trial.statusCode).toBe(201);
  expect(trial.json().plan.status).toEqual({ kind: 'teste', daysLeft: 7 });
  expect((await call('POST', '/api/posts', ana, post)).statusCode).toBe(201);
  expect((await call('POST', '/api/plan/trial', ana)).statusCode).toBe(409);

  clock = new Date('2026-10-23T10:00:00Z');
  ana = await signIn('ana@exemplo.pt');
  expect((await call('GET', '/api/plan', ana)).json().plan.status).toEqual({ kind: 'teste-terminado' });
  expect((await call('POST', '/api/posts', ana, post)).statusCode).toBe(403);
  const ended = (await call('DELETE', '/api/plan/trial', ana)).json().plan;
  expect(ended.status).toEqual({ kind: 'gratuito' });
  expect(ended.trialStartedAt).toBeTruthy();
  expect((await call('POST', '/api/plan/trial', ana)).statusCode).toBe(409);
});

test('quote numbers are assigned by the server, in sequence, per account', async () => {
  const ana = await signUp('ana@exemplo.pt');
  const bea = await signUp('bea@exemplo.pt');
  const id = randomUUID();
  const first = await call('POST', '/api/quotes', ana, { ...quote, id });
  expect(first.json().quote).toMatchObject({ id, number: '2026-001', totalCents: 12550 });
  expect((await call('POST', '/api/quotes', ana, { ...quote, id })).statusCode).toBe(409);
  expect((await call('POST', '/api/quotes', ana, quote)).json().quote.number).toBe('2026-002');
  expect((await call('POST', '/api/quotes', bea, quote)).json().quote.number).toBe('2026-001');
  expect((await call('POST', '/api/quotes', ana, { ...quote, number: '1999-999' })).statusCode).toBe(400);
  expect((await call('POST', '/api/quotes', ana, { ...quote, items: [] })).statusCode).toBe(400);
  expect((await call('POST', '/api/quotes', ana, { ...quote, items: [{ description: 'x', priceCents: -1 }] })).statusCode).toBe(400);
  const edited = await call('PUT', `/api/quotes/${id}`, ana, { ...quote, clientName: 'Ana Silva', items: [{ description: 'Só isto', priceCents: 100 }] });
  expect(edited.json().quote).toMatchObject({ number: '2026-001', clientName: 'Ana Silva', totalCents: 100 });
  expect(await count('quote_items')).toBe(5);
});

test('quotes created at the same time get different numbers', async () => {
  const ana = await signUp('ana@exemplo.pt');
  const numbers = (await Promise.all(Array.from({ length: 5 }, () => call('POST', '/api/quotes', ana, quote)))).map((r) => r.json().quote.number).sort();
  expect(numbers).toEqual(['2026-001', '2026-002', '2026-003', '2026-004', '2026-005']);
});

test('calendar entries are validated, filtered by month and updated', async () => {
  const ana = await signUp('ana@exemplo.pt');
  expect((await call('POST', '/api/calendar', ana, { ...entry, date: '2026-02-30' })).statusCode).toBe(400);
  expect((await call('POST', '/api/calendar', ana, { ...entry, status: 'enviada' })).statusCode).toBe(400);
  const id = (await call('POST', '/api/calendar', ana, entry)).json().entry.id;
  await call('POST', '/api/calendar', ana, { ...entry, date: '2026-11-02' });
  expect((await call('GET', '/api/calendar?month=2026-10', ana)).json().entries).toHaveLength(1);
  expect((await call('GET', '/api/calendar', ana)).json().entries).toHaveLength(2);
  const postId = (await call('POST', '/api/posts', ana, post)).json().post.id;
  const patched = await call('PATCH', `/api/calendar/${id}`, ana, { status: 'publicada', postId });
  expect(patched.json().entry).toMatchObject({ status: 'publicada', title: entry.title, date: entry.date, postId });
  await call('DELETE', `/api/posts/${postId}`, ana);
  expect((await call('GET', '/api/calendar?month=2026-10', ana)).json().entries[0].postId).toBeNull();
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

test('example data is flagged, does not use the plan and leaves real records alone', async () => {
  const ana = await signUp('ana@exemplo.pt');
  await call('POST', '/api/posts', ana, post);
  await call('POST', '/api/quotes', ana, quote);
  const loaded = await call('POST', '/api/demo', ana);
  expect(loaded.statusCode).toBe(201);
  const demo = loaded.json();
  expect(demo.business.isExample).toBe(true);
  expect(demo.posts.filter((p: { isExample: boolean }) => p.isExample)).toHaveLength(3);
  expect(demo.entries.every((e: { isExample: boolean }) => e.isExample)).toBe(true);
  expect(demo.plan.postsUsedThisMonth).toBe(1);
  await call('POST', '/api/demo', ana);                           // loading twice does not duplicate
  expect((await call('GET', '/api/posts', ana)).json().posts).toHaveLength(4);
  expect((await call('POST', '/api/quotes', ana, quote)).json().quote.number).toBe('2026-002');

  const cleared = (await call('DELETE', '/api/demo', ana)).json();
  expect(cleared.business).toBeNull();
  expect(cleared.posts).toHaveLength(1);
  expect(cleared.entries).toEqual([]);
  expect(cleared.quotes.map((q: { number: string }) => q.number).sort()).toEqual(['2026-001', '2026-002']);
});

test('deleting the account needs the password and removes every row', async () => {
  const ana = await signUp('ana@exemplo.pt');
  await call('PUT', '/api/business', ana, business);
  await call('POST', '/api/posts', ana, post);
  await call('POST', '/api/quotes', ana, quote);
  await call('POST', '/api/calendar', ana, entry);
  await call('PUT', '/api/replies', ana, { precos: 'x' });
  await call('POST', '/api/plan/trial', ana);
  expect((await call('DELETE', '/api/account', ana, { password: 'errada' })).statusCode).toBe(401);
  expect((await call('DELETE', '/api/account', ana, { password: PASSWORD })).statusCode).toBe(204);
  for (const table of ['users', 'sessions', 'email_tokens', 'businesses', 'posts', 'post_usage', 'calendar_entries', 'reply_overrides', 'quotes', 'quote_items', 'plans']) {
    expect(await count(table), table).toBe(0);
  }
});
