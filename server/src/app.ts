import { randomUUID } from 'node:crypto';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import Fastify, { type FastifyInstance } from 'fastify';
import type { z } from 'zod';
import { demoData } from '../../src/domain/demo';
import { FREE_POST_LIMIT, planStatus } from '../../src/domain/plan';
import { generatePost } from '../../src/domain/posts';
import { quoteTotal } from '../../src/domain/quotes';
import type { BusinessProfile, PlanState } from '../../src/domain/types';
import { DUMMY_HASH, hashPassword, hashSessionToken, newSessionToken, verifyPassword } from './auth';
import { UNIQUE_VIOLATION, type Db, type Queryable, type Row } from './db';
import type { Mailer } from './mail';
import {
  businessSchema, calendarEntrySchema, calendarPatchSchema, credentialsSchema, emailSchema, loginSchema, monthQuerySchema,
  passwordSchema, postInputSchema, postSchema, quoteSchema, replyOverridesSchema, resetSchema, tokenSchema,
} from './schemas';

declare module 'fastify' {
  interface FastifyRequest { userId: string }
}

export interface AppOptions {
  db: Db;
  mailer: Mailer;
  now?: () => Date;
  appUrl?: string;
  allowedOrigins?: string[];
  secureCookies?: boolean;
  trustProxy?: false | number | string[];
  logger?: boolean;
}

const SESSION_COOKIE = 'np_session';
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const SESSION_MS = 7 * DAY_MS;
const VERIFY_TOKEN_MS = DAY_MS;
const RESET_TOKEN_MS = 60 * MINUTE_MS;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

const notFound = () => new ApiError(404, 'nao-encontrado', 'Não encontrámos esse registo.');
const duplicate = () => new ApiError(409, 'ja-existe', 'Esse registo já existe.');
const isUniqueViolation = (error: unknown) => (error as { code?: string }).code === UNIQUE_VIOLATION;

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
const iso = (value: Date | string): string => new Date(value).toISOString();

const EMPTY_BUSINESS: BusinessProfile = {
  name: '', category: '', city: '', description: '', hours: '', phone: '', email: '', address: '',
  bookingLink: '', instagram: '', facebook: '', website: '', services: [], accentColor: '#1B4DB1', isExample: false,
};

const businessFromRow = (r: Row): BusinessProfile => ({
  name: r.name, category: r.category, city: r.city, description: r.description, hours: r.hours, phone: r.phone,
  email: r.email, address: r.address, bookingLink: r.booking_link, instagram: r.instagram, facebook: r.facebook,
  website: r.website, services: r.services, accentColor: r.accent_color, isExample: r.is_example,
});
const postFromRow = (r: Row) => ({
  id: r.id, createdAt: iso(r.created_at), channel: r.channel, goal: r.goal, service: r.service, audience: r.audience,
  tone: r.tone, title: r.title, caption: r.caption, cta: r.cta, hashtags: r.hashtags, isExample: r.is_example,
});
const entryFromRow = (r: Row) => ({
  id: r.id, date: r.date, category: r.category, title: r.title, status: r.status, postId: r.post_id, isExample: r.is_example,
});

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const { db, mailer } = options;
  const now = options.now ?? (() => new Date());
  const appUrl = options.appUrl ?? 'http://localhost:5173';
  const allowedOrigins = options.allowedOrigins ?? ['http://localhost:5173', 'http://localhost:4173'];

  const app = Fastify({
    logger: options.logger ? { redact: ['req.headers.cookie', 'req.headers.authorization'] } : false,
    bodyLimit: 100_000,
    // A hop count becomes "trust the nearest N hops", which is what Fastify's proxy-addr does for a number.
    trustProxy: typeof options.trustProxy === 'number'
      ? ((hops: number) => (_address: string, hop: number) => hop < hops)(options.trustProxy)
      : options.trustProxy ?? false,
  });
  await app.register(helmet);
  await app.register(cookie);
  app.decorateRequest('userId', '');

  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    if (error instanceof ApiError) {
      return reply.code(error.status).send({ error: { code: error.code, message: error.message, fields: error.fields } });
    }
    const status = error.statusCode ?? 500;
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

  // Counters live in the database, so a restart or a second server does not reset them.
  async function limit(key: string, max: number, windowMs: number): Promise<void> {
    const at = now();
    const { rows } = await db.query(
      `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, $2, 1)
       ON CONFLICT (key) DO UPDATE SET
         count = CASE WHEN rate_limits.window_start < $3 THEN 1 ELSE rate_limits.count + 1 END,
         window_start = CASE WHEN rate_limits.window_start < $3 THEN $2 ELSE rate_limits.window_start END
       RETURNING count`,
      [key, at.toISOString(), new Date(at.getTime() - windowMs).toISOString()]);
    if (rows[0].count > max) throw new ApiError(429, 'demasiados-pedidos', 'Demasiadas tentativas. Aguarde um pouco e tente de novo.');
  }

  async function startSession(userId: string): Promise<{ token: string; expires: Date }> {
    const token = newSessionToken();
    const expires = new Date(now().getTime() + SESSION_MS);
    await db.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [hashSessionToken(token), userId, expires.toISOString()]);
    return { token, expires };
  }

  const cookieOptions = (expires: Date) => ({
    httpOnly: true, sameSite: 'strict' as const, secure: options.secureCookies ?? false, path: '/', expires,
  });

  // Single-use links. Only the hash of the token is stored.
  async function sendLink(userId: string, email: string, kind: 'verificar' | 'repor'): Promise<void> {
    const token = newSessionToken();
    const expires = new Date(now().getTime() + (kind === 'verificar' ? VERIFY_TOKEN_MS : RESET_TOKEN_MS));
    await db.query('DELETE FROM email_tokens WHERE user_id = $1 AND kind = $2', [userId, kind]);
    await db.query('INSERT INTO email_tokens (token_hash, user_id, kind, expires_at) VALUES ($1, $2, $3, $4)', [hashSessionToken(token), userId, kind, expires.toISOString()]);
    const link = `${appUrl}/#/${kind === 'verificar' ? 'verificar' : 'repor'}?token=${token}`;
    await mailer.send(kind === 'verificar'
      ? { to: email, subject: 'Confirme o seu email na Negócio Pronto', text: `Para confirmar o seu email, abra esta ligação:\n${link}\n\nA ligação é válida durante 24 horas. Se não criou conta, ignore esta mensagem.` }
      : { to: email, subject: 'Repor a palavra-passe da Negócio Pronto', text: `Para escolher uma nova palavra-passe, abra esta ligação:\n${link}\n\nA ligação é válida durante 1 hora. Se não fez este pedido, ignore esta mensagem.` });
  }

  async function redeem(token: string, kind: 'verificar' | 'repor'): Promise<string> {
    const { rows } = await db.query('DELETE FROM email_tokens WHERE token_hash = $1 AND kind = $2 AND expires_at > $3 RETURNING user_id',
      [hashSessionToken(token), kind, now().toISOString()]);
    if (!rows[0]) throw new ApiError(400, 'ligacao-invalida', 'Esta ligação já não é válida. Peça uma nova.');
    return rows[0].user_id;
  }

  async function planOf(userId: string): Promise<PlanState> {
    const { rows } = await db.query('SELECT tier, trial_started_at FROM plans WHERE user_id = $1', [userId]);
    return rows[0] ? { tier: rows[0].tier, trialStartedAt: rows[0].trial_started_at ? iso(rows[0].trial_started_at) : null } : { tier: 'gratuito', trialStartedAt: null };
  }

  async function planView(userId: string) {
    const plan = await planOf(userId);
    const { rows } = await db.query('SELECT count FROM post_usage WHERE user_id = $1 AND month_key = $2', [userId, lisbonMonthKey(now())]);
    return { ...plan, status: planStatus(plan, now()), postsUsedThisMonth: rows[0]?.count ?? 0, freePostLimit: FREE_POST_LIMIT, simulated: true };
  }

  async function businessOf(userId: string): Promise<BusinessProfile | null> {
    const { rows } = await db.query('SELECT * FROM businesses WHERE user_id = $1', [userId]);
    return rows[0] ? businessFromRow(rows[0]) : null;
  }

  async function saveBusiness(q: Queryable, userId: string, b: Omit<BusinessProfile, 'isExample'>, isExample: boolean): Promise<void> {
    await q.query(
      `INSERT INTO businesses (user_id, name, category, city, description, hours, phone, email, address, booking_link, instagram, facebook, website, accent_color, services, is_example, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16, $17)
       ON CONFLICT (user_id) DO UPDATE SET name = excluded.name, category = excluded.category, city = excluded.city, description = excluded.description,
         hours = excluded.hours, phone = excluded.phone, email = excluded.email, address = excluded.address, booking_link = excluded.booking_link,
         instagram = excluded.instagram, facebook = excluded.facebook, website = excluded.website, accent_color = excluded.accent_color,
         services = excluded.services, is_example = excluded.is_example, updated_at = excluded.updated_at`,
      [userId, b.name, b.category, b.city, b.description, b.hours, b.phone, b.email, b.address, b.bookingLink, b.instagram, b.facebook, b.website,
        b.accentColor, JSON.stringify(b.services), isExample, now().toISOString()]);
  }

  type PostData = Omit<z.infer<typeof postSchema>, 'id'>;
  async function insertPost(q: Queryable, userId: string, id: string, p: PostData, isExample: boolean): Promise<Row> {
    const { rows } = await q.query(
      `INSERT INTO posts (id, user_id, created_at, channel, goal, service, audience, tone, title, caption, cta, hashtags, is_example)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13) RETURNING *`,
      [id, userId, now().toISOString(), p.channel, p.goal, p.service, p.audience, p.tone, p.title, p.caption, p.cta, JSON.stringify(p.hashtags), isExample]);
    return rows[0];
  }

  async function insertEntry(q: Queryable, userId: string, id: string, e: Omit<z.infer<typeof calendarEntrySchema>, 'id'>, isExample: boolean): Promise<Row> {
    const { rows } = await q.query(
      'INSERT INTO calendar_entries (id, user_id, date, category, title, status, post_id, is_example) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [id, userId, e.date, e.category, e.title, e.status, e.postId, isExample]);
    return rows[0];
  }

  type QuoteData = Omit<z.infer<typeof quoteSchema>, 'id'>;
  async function writeQuoteItems(q: Queryable, quoteId: string, items: QuoteData['items']): Promise<void> {
    await q.query('DELETE FROM quote_items WHERE quote_id = $1', [quoteId]);
    for (const [position, item] of items.entries()) {
      await q.query('INSERT INTO quote_items (id, quote_id, position, description, price_cents) VALUES ($1, $2, $3, $4, $5)',
        [randomUUID(), quoteId, position, item.description, item.priceCents]);
    }
  }

  async function quotesOf(userId: string, quoteId?: string) {
    const quotes = (await db.query(
      `SELECT * FROM quotes WHERE user_id = $1 ${quoteId ? 'AND id = $2' : ''} ORDER BY created_at DESC, number DESC`,
      quoteId ? [userId, quoteId] : [userId])).rows;
    const items = (await db.query(
      'SELECT i.* FROM quote_items i JOIN quotes q ON q.id = i.quote_id WHERE q.user_id = $1 ORDER BY i.position', [userId])).rows;
    return quotes.map((r) => {
      const quote = {
        id: r.id, number: r.number, createdAt: iso(r.created_at), clientName: r.client_name,
        items: items.filter((i) => i.quote_id === r.id).map((i) => ({ id: i.id, description: i.description, priceCents: i.price_cents })),
        deadline: r.deadline, notes: r.notes, vatNote: r.vat_note, isExample: r.is_example,
      };
      return { ...quote, totalCents: quoteTotal(quote) };
    });
  }

  async function assertOwnPost(userId: string, postId: string | null | undefined): Promise<void> {
    if (!postId) return;
    const { rows } = await db.query('SELECT 1 FROM posts WHERE id = $1 AND user_id = $2', [postId, userId]);
    if (!rows[0]) throw new ApiError(400, 'dados-invalidos', 'Há dados em falta ou incorretos.', { postId: 'Essa publicação não existe.' });
  }

  async function removeExamples(q: Queryable, userId: string): Promise<void> {
    await q.query('DELETE FROM calendar_entries WHERE user_id = $1 AND is_example', [userId]);
    await q.query('DELETE FROM posts WHERE user_id = $1 AND is_example', [userId]);
    await q.query('DELETE FROM quotes WHERE user_id = $1 AND is_example', [userId]);
    await q.query('DELETE FROM businesses WHERE user_id = $1 AND is_example', [userId]);
  }

  async function everything(userId: string) {
    const [business, posts, entries, replies, quotes, plan] = await Promise.all([
      businessOf(userId),
      db.query('SELECT * FROM posts WHERE user_id = $1 ORDER BY created_at DESC', [userId]),
      db.query('SELECT * FROM calendar_entries WHERE user_id = $1 ORDER BY date', [userId]),
      db.query('SELECT data FROM reply_overrides WHERE user_id = $1', [userId]),
      quotesOf(userId),
      planView(userId),
    ]);
    return { business, posts: posts.rows.map(postFromRow), entries: entries.rows.map(entryFromRow), overrides: replies.rows[0]?.data ?? {}, quotes, plan };
  }

  const idParam = (id: string): string => {
    if (!UUID.test(id)) throw notFound();
    return id;
  };

  app.get('/api/health', async () => ({ ok: true }));

  const small = { bodyLimit: 4096 };

  app.post('/api/auth/register', small, async (request, reply) => {
    await limit(`registo:${request.ip}`, 5, MINUTE_MS);
    const { email, password } = parse(credentialsSchema, request.body);
    const id = randomUUID();
    try {
      await db.query('INSERT INTO users (id, email, password_hash, created_at) VALUES ($1, $2, $3, $4)', [id, email, await hashPassword(password), now().toISOString()]);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ApiError(409, 'email-em-uso', 'Já existe uma conta com este email.');
      throw error;
    }
    // A mail failure must not block the account: the link can be asked for again.
    await sendLink(id, email, 'verificar').catch((error) => request.log.error(error));
    const session = await startSession(id);
    return reply.code(201).setCookie(SESSION_COOKIE, session.token, cookieOptions(session.expires)).send({ user: { id, email, emailVerified: false } });
  });

  app.post('/api/auth/login', small, async (request, reply) => {
    await limit(`entrada:${request.ip}`, 5, MINUTE_MS);
    const { email, password } = parse(loginSchema, request.body);
    const user = (await db.query('SELECT id, password_hash, email_verified_at FROM users WHERE email = $1', [email])).rows[0];
    const valid = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !valid) {
      // Only failures count against the account, so nobody can lock its owner out by guessing.
      await limit(`entrada-conta:${email}`, 10, 15 * MINUTE_MS);
      throw new ApiError(401, 'credenciais-invalidas', 'Email ou palavra-passe incorretos.');
    }
    const session = await startSession(user.id);
    return reply.setCookie(SESSION_COOKIE, session.token, cookieOptions(session.expires))
      .send({ user: { id: user.id, email, emailVerified: user.email_verified_at !== null } });
  });

  // Always answers the same way, so it cannot be used to find out which emails have an account.
  app.post('/api/auth/forgot', small, async (request, reply) => {
    await limit(`repor:${request.ip}`, 5, 15 * MINUTE_MS);
    const { email } = parse(emailSchema, request.body);
    const user = (await db.query('SELECT id FROM users WHERE email = $1', [email])).rows[0];
    if (user) void sendLink(user.id, email, 'repor').catch((error) => request.log.error(error));
    return reply.code(204).send();
  });

  app.post('/api/auth/reset', small, async (request, reply) => {
    await limit(`repor:${request.ip}`, 5, 15 * MINUTE_MS);
    const { token, password } = parse(resetSchema, request.body);
    const userId = await redeem(token, 'repor');
    // Opening the link proves the mailbox is the user's, and every existing session ends.
    await db.query('UPDATE users SET password_hash = $1, email_verified_at = COALESCE(email_verified_at, $2) WHERE id = $3', [await hashPassword(password), now().toISOString(), userId]);
    await db.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
    return reply.code(204).send();
  });

  app.post('/api/auth/verify', small, async (request, reply) => {
    await limit(`verificar:${request.ip}`, 10, 15 * MINUTE_MS);
    const { token } = parse(tokenSchema, request.body);
    const userId = await redeem(token, 'verificar');
    await db.query('UPDATE users SET email_verified_at = $1 WHERE id = $2', [now().toISOString(), userId]);
    return reply.code(204).send();
  });

  await app.register(async (api) => {
    api.addHook('preHandler', async (request) => {
      const token = request.cookies[SESSION_COOKIE];
      const session = token
        ? (await db.query('SELECT user_id FROM sessions WHERE token_hash = $1 AND expires_at > $2', [hashSessionToken(token), now().toISOString()])).rows[0]
        : undefined;
      if (!session) throw new ApiError(401, 'sem-sessao', 'Inicie sessão para continuar.');
      request.userId = session.user_id;
      if (request.method !== 'GET') await limit(`escrita:${session.user_id}`, 120, MINUTE_MS);
    });

    api.post('/api/auth/logout', async (request, reply) => {
      await db.query('DELETE FROM sessions WHERE token_hash = $1', [hashSessionToken(request.cookies[SESSION_COOKIE]!)]);
      return reply.clearCookie(SESSION_COOKIE, { path: '/' }).code(204).send();
    });

    api.post('/api/auth/verify/resend', async (request, reply) => {
      await limit(`reenviar:${request.userId}`, 3, 15 * MINUTE_MS);
      const user = (await db.query('SELECT email, email_verified_at FROM users WHERE id = $1', [request.userId])).rows[0];
      if (user.email_verified_at) throw new ApiError(409, 'ja-confirmado', 'O email já está confirmado.');
      await sendLink(request.userId, user.email, 'verificar');
      return reply.code(204).send();
    });

    api.get('/api/me', async (request) => {
      const user = (await db.query('SELECT id, email, email_verified_at FROM users WHERE id = $1', [request.userId])).rows[0];
      return { user: { id: user.id, email: user.email, emailVerified: user.email_verified_at !== null } };
    });

    // Everything the account holds: the app loads it once after sign-in, and the user can keep a copy.
    api.get('/api/bootstrap', async (request) => everything(request.userId));
    api.get('/api/export', async (request) => ({ exportedAt: now().toISOString(), ...(await everything(request.userId)) }));

    // Removes the content and keeps the account. The monthly usage and the used trial stay, or this would reset the plan limits.
    api.delete('/api/data', async (request, reply) => {
      await db.tx(async (q) => {
        for (const table of ['calendar_entries', 'posts', 'quotes', 'businesses', 'reply_overrides']) {
          await q.query(`DELETE FROM ${table} WHERE user_id = $1`, [request.userId]);
        }
      });
      return reply.code(204).send();
    });

    api.delete('/api/account', async (request, reply) => {
      const { password } = parse(passwordSchema, request.body);
      const user = (await db.query('SELECT password_hash FROM users WHERE id = $1', [request.userId])).rows[0];
      if (!(await verifyPassword(password, user.password_hash))) throw new ApiError(401, 'credenciais-invalidas', 'Palavra-passe incorreta.');
      await db.query('DELETE FROM users WHERE id = $1', [request.userId]);   // cascades to every data table
      return reply.clearCookie(SESSION_COOKIE, { path: '/' }).code(204).send();
    });

    // Example data: fictional records, flagged in the database and never counted against the plan.
    api.post('/api/demo', async (request, reply) => {
      const demo = demoData(now());
      await db.tx(async (q) => {
        await removeExamples(q, request.userId);
        await saveBusiness(q, request.userId, demo.business, true);
        for (const post of demo.posts) await insertPost(q, request.userId, randomUUID(), post, true);
        for (const entry of demo.calendar) await insertEntry(q, request.userId, randomUUID(), { ...entry, postId: null }, true);
        for (const [index, quote] of demo.quotes.entries()) {
          const id = randomUUID();
          await q.query('INSERT INTO quotes (id, user_id, number, created_at, client_name, deadline, notes, vat_note, is_example) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)',
            [id, request.userId, `exemplo-${index + 1}`, now().toISOString(), quote.clientName, quote.deadline, quote.notes, quote.vatNote]);
          await writeQuoteItems(q, id, quote.items);
        }
      });
      return reply.code(201).send(await everything(request.userId));
    });

    api.delete('/api/demo', async (request) => {
      await db.tx((q) => removeExamples(q, request.userId));
      return everything(request.userId);
    });

    // Business profile
    api.get('/api/business', async (request) => ({ business: await businessOf(request.userId) }));

    api.put('/api/business', async (request) => {
      const business = parse(businessSchema, request.body);
      await saveBusiness(db, request.userId, business, false);
      return { business: { ...business, isExample: false } };
    });

    // Posts
    api.post('/api/posts/generate', async (request) => {
      const input = parse(postInputSchema, request.body);
      return { draft: generatePost(input, (await businessOf(request.userId)) ?? EMPTY_BUSINESS) };
    });

    api.get('/api/posts', async (request) => ({
      posts: (await db.query('SELECT * FROM posts WHERE user_id = $1 ORDER BY created_at DESC', [request.userId])).rows.map(postFromRow),
    }));

    api.post('/api/posts', async (request, reply) => {
      const { id, ...post } = parse(postSchema, request.body);
      const onTrial = planStatus(await planOf(request.userId), now()).kind === 'teste';
      try {
        const row = await db.tx(async (q) => {
          // One statement checks and takes the slot, so two requests at once cannot both pass the limit.
          const usage = await q.query(
            `INSERT INTO post_usage (user_id, month_key, count) VALUES ($1, $2, 1)
             ON CONFLICT (user_id, month_key) DO UPDATE SET count = post_usage.count + 1
             WHERE $3 OR post_usage.count < $4
             RETURNING count`,
            [request.userId, lisbonMonthKey(now()), onTrial, FREE_POST_LIMIT]);
          if (!usage.rows[0]) throw new ApiError(403, 'limite-plano', `Já guardou ${FREE_POST_LIMIT} publicações este mês, o limite do plano gratuito.`);
          return insertPost(q, request.userId, id ?? randomUUID(), post, false);
        });
        return reply.code(201).send({ post: postFromRow(row), plan: await planView(request.userId) });
      } catch (error) {
        if (isUniqueViolation(error)) throw duplicate();
        throw error;
      }
    });

    api.delete<{ Params: { id: string } }>('/api/posts/:id', async (request, reply) => {
      const result = await db.query('DELETE FROM posts WHERE id = $1 AND user_id = $2', [idParam(request.params.id), request.userId]);
      if (result.count === 0) throw notFound();
      return reply.code(204).send();
    });

    // Calendar
    api.get('/api/calendar', async (request) => {
      const { month } = parse(monthQuerySchema, request.query);
      const { rows } = month
        ? await db.query('SELECT * FROM calendar_entries WHERE user_id = $1 AND date LIKE $2 ORDER BY date', [request.userId, `${month}-%`])
        : await db.query('SELECT * FROM calendar_entries WHERE user_id = $1 ORDER BY date', [request.userId]);
      return { entries: rows.map(entryFromRow) };
    });

    api.post('/api/calendar', async (request, reply) => {
      const { id, ...entry } = parse(calendarEntrySchema, request.body);
      await assertOwnPost(request.userId, entry.postId);
      try {
        return reply.code(201).send({ entry: entryFromRow(await insertEntry(db, request.userId, id ?? randomUUID(), entry, false)) });
      } catch (error) {
        if (isUniqueViolation(error)) throw duplicate();
        throw error;
      }
    });

    api.patch<{ Params: { id: string } }>('/api/calendar/:id', async (request) => {
      const patch = parse(calendarPatchSchema, request.body);
      await assertOwnPost(request.userId, patch.postId);
      // Editing an example entry makes it the user's own.
      const { rows } = await db.query(
        `UPDATE calendar_entries SET date = COALESCE($3, date), category = COALESCE($4, category), title = COALESCE($5, title),
           status = COALESCE($6, status), post_id = CASE WHEN $7 THEN $8::uuid ELSE post_id END, is_example = FALSE
         WHERE id = $1 AND user_id = $2 RETURNING *`,
        [idParam(request.params.id), request.userId, patch.date ?? null, patch.category ?? null, patch.title ?? null, patch.status ?? null,
          patch.postId !== undefined, patch.postId ?? null]);
      if (!rows[0]) throw notFound();
      return { entry: entryFromRow(rows[0]) };
    });

    api.delete<{ Params: { id: string } }>('/api/calendar/:id', async (request, reply) => {
      const result = await db.query('DELETE FROM calendar_entries WHERE id = $1 AND user_id = $2', [idParam(request.params.id), request.userId]);
      if (result.count === 0) throw notFound();
      return reply.code(204).send();
    });

    // Quick replies (only the texts the user edited)
    api.get('/api/replies', async (request) => {
      const { rows } = await db.query('SELECT data FROM reply_overrides WHERE user_id = $1', [request.userId]);
      return { overrides: rows[0]?.data ?? {} };
    });

    api.put('/api/replies', async (request) => {
      const overrides = parse(replyOverridesSchema, request.body);
      await db.query('INSERT INTO reply_overrides (user_id, data) VALUES ($1, $2::jsonb) ON CONFLICT (user_id) DO UPDATE SET data = excluded.data',
        [request.userId, JSON.stringify(overrides)]);
      return { overrides };
    });

    // Quotes
    api.get('/api/quotes', async (request) => ({ quotes: await quotesOf(request.userId) }));

    api.post('/api/quotes', async (request, reply) => {
      const { id: givenId, ...quote } = parse(quoteSchema, request.body);
      const id = givenId ?? randomUUID();
      try {
        await db.tx(async (q) => {
          // The number is assigned here, never taken from the client. Locking the
          // user row keeps two requests at once from getting the same number.
          await q.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [request.userId]);
          const year = lisbonMonthKey(now()).slice(0, 4);
          const last = (await q.query('SELECT number FROM quotes WHERE user_id = $1 AND number LIKE $2 ORDER BY number DESC LIMIT 1', [request.userId, `${year}-%`])).rows[0];
          const number = `${year}-${String(last ? Number(last.number.slice(5)) + 1 : 1).padStart(3, '0')}`;
          await q.query('INSERT INTO quotes (id, user_id, number, created_at, client_name, deadline, notes, vat_note) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [id, request.userId, number, now().toISOString(), quote.clientName, quote.deadline, quote.notes, quote.vatNote]);
          await writeQuoteItems(q, id, quote.items);
        });
      } catch (error) {
        if (isUniqueViolation(error)) throw duplicate();
        throw error;
      }
      return reply.code(201).send({ quote: (await quotesOf(request.userId, id))[0] });
    });

    api.put<{ Params: { id: string } }>('/api/quotes/:id', async (request) => {
      const { id: _ignored, ...quote } = parse(quoteSchema, request.body);
      const id = idParam(request.params.id);
      await db.tx(async (q) => {
        const result = await q.query('UPDATE quotes SET client_name = $3, deadline = $4, notes = $5, vat_note = $6, is_example = FALSE WHERE id = $1 AND user_id = $2',
          [id, request.userId, quote.clientName, quote.deadline, quote.notes, quote.vatNote]);
        if (result.count === 0) throw notFound();
        await writeQuoteItems(q, id, quote.items);
      });
      return { quote: (await quotesOf(request.userId, id))[0] };
    });

    api.delete<{ Params: { id: string } }>('/api/quotes/:id', async (request, reply) => {
      const result = await db.query('DELETE FROM quotes WHERE id = $1 AND user_id = $2', [idParam(request.params.id), request.userId]);
      if (result.count === 0) throw notFound();
      return reply.code(204).send();
    });

    // Plan. There are no payments: "pro" only ever means the simulated 7-day trial.
    api.get('/api/plan', async (request) => ({ plan: await planView(request.userId) }));

    api.post('/api/plan/trial', async (request, reply) => {
      const result = await db.query("INSERT INTO plans (user_id, tier, trial_started_at) VALUES ($1, 'pro', $2) ON CONFLICT (user_id) DO NOTHING",
        [request.userId, now().toISOString()]);
      if (result.count === 0) throw new ApiError(409, 'teste-ja-usado', 'O teste gratuito já foi usado nesta conta.');
      return reply.code(201).send({ plan: await planView(request.userId) });
    });

    api.delete('/api/plan/trial', async (request) => {
      await db.query("UPDATE plans SET tier = 'gratuito' WHERE user_id = $1", [request.userId]);
      return { plan: await planView(request.userId) };
    });
  });

  return app;
}
