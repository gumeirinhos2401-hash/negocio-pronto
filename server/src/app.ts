import { randomUUID } from 'node:crypto';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import type { z } from 'zod';
import { FREE_POST_LIMIT, planStatus } from '../../src/domain/plan';
import { generatePost } from '../../src/domain/posts';
import { quoteTotal } from '../../src/domain/quotes';
import type { BusinessProfile, PlanState } from '../../src/domain/types';
import { DUMMY_HASH, hashPassword, hashSessionToken, newSessionToken, verifyPassword } from './auth';
import type { Db } from './db';
import {
  businessSchema, calendarEntrySchema, calendarPatchSchema, credentialsSchema, monthQuerySchema,
  passwordSchema, postInputSchema, postSchema, quoteSchema, replyOverridesSchema,
} from './schemas';

declare module 'fastify' {
  interface FastifyRequest { userId: string }
}

export interface AppOptions {
  db: Db;
  now?: () => Date;
  allowedOrigins?: string[];
  secureCookies?: boolean;
  logger?: boolean;
}

const SESSION_COOKIE = 'np_session';
const SESSION_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const AUTH_RATE_LIMIT = { max: 5, timeWindow: '1 minute' };

class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly fields?: Record<string, string>) {
    super(message);
  }
}

const notFound = () => new ApiError(404, 'nao-encontrado', 'Não encontrámos esse registo.');

function parse<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || 'corpo';
    fields[key] ??= issue.message;
  }
  throw new ApiError(400, 'dados-invalidos', 'Há dados em falta ou incorretos.', fields);
}

// Months and years follow the clock in Portugal, not the server's time zone.
const lisbonParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit' });
const lisbonMonthKey = (date: Date): string => lisbonParts.format(date);

const EMPTY_BUSINESS: BusinessProfile = {
  name: '', category: '', city: '', description: '', hours: '', phone: '', email: '', address: '',
  bookingLink: '', instagram: '', facebook: '', website: '', services: [], accentColor: '#1B4DB1', isExample: false,
};

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const { db } = options;
  const now = options.now ?? (() => new Date());
  const allowedOrigins = options.allowedOrigins ?? ['http://localhost:5173', 'http://localhost:4173'];

  const get = <T>(sql: string, ...params: (string | number | null)[]) => db.prepare(sql).get(...params) as T | undefined;
  const all = <T>(sql: string, ...params: (string | number | null)[]) => db.prepare(sql).all(...params) as T[];
  const run = (sql: string, ...params: (string | number | null)[]) => db.prepare(sql).run(...params);

  const app = Fastify({
    logger: options.logger ? { redact: ['req.headers.cookie', 'req.headers.authorization'] } : false,
    bodyLimit: 100_000,
  });
  await app.register(helmet);
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  app.decorateRequest('userId', '');

  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    if (error instanceof ApiError) {
      return reply.code(error.status).send({ error: { code: error.code, message: error.message, fields: error.fields } });
    }
    const status = error.statusCode ?? 500;
    if (status === 429) return reply.code(429).send({ error: { code: 'demasiados-pedidos', message: 'Demasiadas tentativas. Aguarde um minuto e tente de novo.' } });
    if (status >= 400 && status < 500) return reply.code(status).send({ error: { code: 'pedido-invalido', message: 'O pedido não pôde ser lido.' } });
    request.log.error(error);
    return reply.code(500).send({ error: { code: 'erro-interno', message: 'Ocorreu um erro no servidor.' } });
  });

  // The session cookie is SameSite=Strict; this check is a second barrier
  // against requests that change data from another site.
  app.addHook('onRequest', async (request) => {
    if (request.method === 'GET' || request.method === 'HEAD') return;
    const origin = request.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) throw new ApiError(403, 'origem-recusada', 'Pedido recusado.');
  });

  function startSession(userId: string): { token: string; expires: Date } {
    const token = newSessionToken();
    const expires = new Date(now().getTime() + SESSION_DAYS * DAY_MS);
    run('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', hashSessionToken(token), userId, expires.toISOString());
    return { token, expires };
  }

  const cookieOptions = (expires: Date) => ({
    httpOnly: true, sameSite: 'strict' as const, secure: options.secureCookies ?? false, path: '/', expires,
  });

  function planOf(userId: string): PlanState {
    const row = get<{ tier: 'gratuito' | 'pro'; trial_started_at: string | null }>('SELECT tier, trial_started_at FROM plans WHERE user_id = ?', userId);
    return row ? { tier: row.tier, trialStartedAt: row.trial_started_at } : { tier: 'gratuito', trialStartedAt: null };
  }

  const postsThisMonth = (userId: string): number =>
    get<{ n: number }>('SELECT COUNT(*) AS n FROM posts WHERE user_id = ? AND month_key = ?', userId, lisbonMonthKey(now()))!.n;

  function businessOf(userId: string): BusinessProfile | null {
    const row = get<{ data: string }>('SELECT data FROM businesses WHERE user_id = ?', userId);
    return row ? { ...(JSON.parse(row.data) as Omit<BusinessProfile, 'isExample'>), isExample: false } : null;
  }

  app.get('/api/health', async () => ({ ok: true }));

  app.post('/api/auth/register', { config: { rateLimit: AUTH_RATE_LIMIT } }, async (request, reply) => {
    const { email, password } = parse(credentialsSchema, request.body);
    if (get('SELECT 1 FROM users WHERE email = ?', email)) {
      throw new ApiError(409, 'email-em-uso', 'Já existe uma conta com este email.');
    }
    const id = randomUUID();
    run('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)', id, email, await hashPassword(password), now().toISOString());
    const session = startSession(id);
    return reply.code(201).setCookie(SESSION_COOKIE, session.token, cookieOptions(session.expires)).send({ user: { id, email } });
  });

  app.post('/api/auth/login', { config: { rateLimit: AUTH_RATE_LIMIT } }, async (request, reply) => {
    const { email, password } = parse(credentialsSchema.extend({ password: passwordSchema.shape.password }), request.body);
    const user = get<{ id: string; password_hash: string }>('SELECT id, password_hash FROM users WHERE email = ?', email);
    const valid = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !valid) throw new ApiError(401, 'credenciais-invalidas', 'Email ou palavra-passe incorretos.');
    const session = startSession(user.id);
    return reply.setCookie(SESSION_COOKIE, session.token, cookieOptions(session.expires)).send({ user: { id: user.id, email } });
  });

  await app.register(async (api) => {
    api.addHook('preHandler', async (request) => {
      const token = request.cookies[SESSION_COOKIE];
      const session = token
        ? get<{ user_id: string }>('SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?', hashSessionToken(token), now().toISOString())
        : undefined;
      if (!session) throw new ApiError(401, 'sem-sessao', 'Inicie sessão para continuar.');
      request.userId = session.user_id;
    });

    api.post('/api/auth/logout', async (request, reply) => {
      run('DELETE FROM sessions WHERE token_hash = ?', hashSessionToken(request.cookies[SESSION_COOKIE]!));
      return reply.clearCookie(SESSION_COOKIE, { path: '/' }).code(204).send();
    });

    api.get('/api/me', async (request) => {
      const user = get<{ id: string; email: string }>('SELECT id, email FROM users WHERE id = ?', request.userId);
      return { user };
    });

    api.delete('/api/account', async (request, reply) => {
      const { password } = parse(passwordSchema, request.body);
      const user = get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', request.userId)!;
      if (!(await verifyPassword(password, user.password_hash))) throw new ApiError(401, 'credenciais-invalidas', 'Palavra-passe incorreta.');
      run('DELETE FROM users WHERE id = ?', request.userId);   // cascades to every data table
      return reply.clearCookie(SESSION_COOKIE, { path: '/' }).code(204).send();
    });

    // Business profile
    api.get('/api/business', async (request) => ({ business: businessOf(request.userId) }));

    api.put('/api/business', async (request) => {
      const business = parse(businessSchema, request.body);
      run(`INSERT INTO businesses (user_id, data, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
        request.userId, JSON.stringify(business), now().toISOString());
      return { business: { ...business, isExample: false } };
    });

    // Posts
    const postRow = (row: { id: string; created_at: string; data: string }) =>
      ({ ...JSON.parse(row.data), id: row.id, createdAt: row.created_at, isExample: false });

    api.post('/api/posts/generate', async (request) => {
      const input = parse(postInputSchema, request.body);
      return { draft: generatePost(input, businessOf(request.userId) ?? EMPTY_BUSINESS) };
    });

    api.get('/api/posts', async (request) => ({
      posts: all<{ id: string; created_at: string; data: string }>(
        'SELECT id, created_at, data FROM posts WHERE user_id = ? ORDER BY created_at DESC', request.userId).map(postRow),
    }));

    api.post('/api/posts', async (request, reply) => {
      const post = parse(postSchema, request.body);
      const onTrial = planStatus(planOf(request.userId), now()).kind === 'teste';
      if (!onTrial && postsThisMonth(request.userId) >= FREE_POST_LIMIT) {
        throw new ApiError(403, 'limite-plano', `Já guardou ${FREE_POST_LIMIT} publicações este mês, o limite do plano gratuito.`);
      }
      const row = { id: randomUUID(), created_at: now().toISOString(), data: JSON.stringify(post) };
      run('INSERT INTO posts (id, user_id, created_at, month_key, data) VALUES (?, ?, ?, ?, ?)',
        row.id, request.userId, row.created_at, lisbonMonthKey(now()), row.data);
      return reply.code(201).send({ post: postRow(row) });
    });

    api.delete<{ Params: { id: string } }>('/api/posts/:id', async (request, reply) => {
      const result = run('DELETE FROM posts WHERE id = ? AND user_id = ?', request.params.id, request.userId);
      if (result.changes === 0) throw notFound();
      return reply.code(204).send();
    });

    // Calendar
    const entryRow = (row: { id: string; date: string; post_id: string | null; data: string }) =>
      ({ ...JSON.parse(row.data), id: row.id, date: row.date, postId: row.post_id, isExample: false });

    function assertOwnPost(userId: string, postId: string | null | undefined): void {
      if (postId && !get('SELECT 1 FROM posts WHERE id = ? AND user_id = ?', postId, userId)) {
        throw new ApiError(400, 'dados-invalidos', 'Há dados em falta ou incorretos.', { postId: 'Essa publicação não existe.' });
      }
    }

    api.get('/api/calendar', async (request) => {
      const { month } = parse(monthQuerySchema, request.query);
      const rows = month
        ? all<{ id: string; date: string; post_id: string | null; data: string }>(
          'SELECT id, date, post_id, data FROM calendar_entries WHERE user_id = ? AND date LIKE ? ORDER BY date', request.userId, `${month}-%`)
        : all<{ id: string; date: string; post_id: string | null; data: string }>(
          'SELECT id, date, post_id, data FROM calendar_entries WHERE user_id = ? ORDER BY date', request.userId);
      return { entries: rows.map(entryRow) };
    });

    api.post('/api/calendar', async (request, reply) => {
      const { date, postId, ...rest } = parse(calendarEntrySchema, request.body);
      assertOwnPost(request.userId, postId);
      const row = { id: randomUUID(), date, post_id: postId, data: JSON.stringify(rest) };
      run('INSERT INTO calendar_entries (id, user_id, date, post_id, data) VALUES (?, ?, ?, ?, ?)', row.id, request.userId, date, postId, row.data);
      return reply.code(201).send({ entry: entryRow(row) });
    });

    api.patch<{ Params: { id: string } }>('/api/calendar/:id', async (request) => {
      const patch = parse(calendarPatchSchema, request.body);
      const current = get<{ id: string; date: string; post_id: string | null; data: string }>(
        'SELECT id, date, post_id, data FROM calendar_entries WHERE id = ? AND user_id = ?', request.params.id, request.userId);
      if (!current) throw notFound();
      assertOwnPost(request.userId, patch.postId);
      const { date, postId, ...rest } = patch;
      const next = {
        id: current.id,
        date: date ?? current.date,
        post_id: postId === undefined ? current.post_id : postId,
        data: JSON.stringify({ ...JSON.parse(current.data), ...rest }),
      };
      run('UPDATE calendar_entries SET date = ?, post_id = ?, data = ? WHERE id = ? AND user_id = ?', next.date, next.post_id, next.data, next.id, request.userId);
      return { entry: entryRow(next) };
    });

    api.delete<{ Params: { id: string } }>('/api/calendar/:id', async (request, reply) => {
      const result = run('DELETE FROM calendar_entries WHERE id = ? AND user_id = ?', request.params.id, request.userId);
      if (result.changes === 0) throw notFound();
      return reply.code(204).send();
    });

    // Quick replies (only the texts the user edited)
    api.get('/api/replies', async (request) => {
      const row = get<{ data: string }>('SELECT data FROM reply_overrides WHERE user_id = ?', request.userId);
      return { overrides: row ? JSON.parse(row.data) : {} };
    });

    api.put('/api/replies', async (request) => {
      const overrides = parse(replyOverridesSchema, request.body);
      run('INSERT INTO reply_overrides (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data',
        request.userId, JSON.stringify(overrides));
      return { overrides };
    });

    // Quotes
    const quoteRow = (row: { id: string; number: string; created_at: string; data: string }) => {
      const quote = { ...JSON.parse(row.data), id: row.id, number: row.number, createdAt: row.created_at, isExample: false };
      return { ...quote, totalCents: quoteTotal(quote) };
    };
    const withItemIds = (quote: z.infer<typeof quoteSchema>) =>
      ({ ...quote, items: quote.items.map((item) => ({ id: randomUUID(), ...item })) });

    api.get('/api/quotes', async (request) => ({
      quotes: all<{ id: string; number: string; created_at: string; data: string }>(
        'SELECT id, number, created_at, data FROM quotes WHERE user_id = ? ORDER BY number DESC', request.userId).map(quoteRow),
    }));

    api.post('/api/quotes', async (request, reply) => {
      const quote = withItemIds(parse(quoteSchema, request.body));
      // The number is assigned here, never taken from the client, so it stays sequential per account and year.
      const year = lisbonMonthKey(now()).slice(0, 4);
      const last = get<{ number: string }>('SELECT number FROM quotes WHERE user_id = ? AND number LIKE ? ORDER BY number DESC LIMIT 1', request.userId, `${year}-%`);
      const sequence = last ? Number(last.number.slice(5)) + 1 : 1;
      const row = { id: randomUUID(), number: `${year}-${String(sequence).padStart(3, '0')}`, created_at: now().toISOString(), data: JSON.stringify(quote) };
      run('INSERT INTO quotes (id, user_id, number, created_at, data) VALUES (?, ?, ?, ?, ?)', row.id, request.userId, row.number, row.created_at, row.data);
      return reply.code(201).send({ quote: quoteRow(row) });
    });

    api.put<{ Params: { id: string } }>('/api/quotes/:id', async (request) => {
      const quote = withItemIds(parse(quoteSchema, request.body));
      const current = get<{ id: string; number: string; created_at: string }>(
        'SELECT id, number, created_at FROM quotes WHERE id = ? AND user_id = ?', request.params.id, request.userId);
      if (!current) throw notFound();
      const data = JSON.stringify(quote);
      run('UPDATE quotes SET data = ? WHERE id = ? AND user_id = ?', data, current.id, request.userId);
      return { quote: quoteRow({ ...current, data }) };
    });

    api.delete<{ Params: { id: string } }>('/api/quotes/:id', async (request, reply) => {
      const result = run('DELETE FROM quotes WHERE id = ? AND user_id = ?', request.params.id, request.userId);
      if (result.changes === 0) throw notFound();
      return reply.code(204).send();
    });

    // Plan. There are no payments: "pro" only ever means the simulated 7-day trial.
    const planView = (userId: string) => {
      const plan = planOf(userId);
      return { ...plan, status: planStatus(plan, now()), postsUsedThisMonth: postsThisMonth(userId), freePostLimit: FREE_POST_LIMIT, simulated: true };
    };

    api.get('/api/plan', async (request) => ({ plan: planView(request.userId) }));

    api.post('/api/plan/trial', async (request, reply) => {
      if (planOf(request.userId).trialStartedAt) throw new ApiError(409, 'teste-ja-usado', 'O teste gratuito já foi usado nesta conta.');
      run(`INSERT INTO plans (user_id, tier, trial_started_at) VALUES (?, 'pro', ?)
           ON CONFLICT(user_id) DO UPDATE SET tier = 'pro', trial_started_at = excluded.trial_started_at`,
        request.userId, now().toISOString());
      return reply.code(201).send({ plan: planView(request.userId) });
    });

    api.delete('/api/plan/trial', async (request) => {
      run("UPDATE plans SET tier = 'gratuito' WHERE user_id = ?", request.userId);
      return { plan: planView(request.userId) };
    });

    // Everything the account holds, for the user to keep a copy.
    api.get('/api/export', async (request) => {
      const inject = async (url: string) => (await app.inject({ method: 'GET', url, cookies: { [SESSION_COOKIE]: request.cookies[SESSION_COOKIE]! } })).json();
      const [business, posts, calendar, replies, quotes, plan] = await Promise.all(
        ['/api/business', '/api/posts', '/api/calendar', '/api/replies', '/api/quotes', '/api/plan'].map(inject));
      return { exportedAt: now().toISOString(), ...business, ...posts, ...calendar, ...replies, ...quotes, ...plan };
    });
  });

  return app;
}
