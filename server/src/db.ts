import { mkdirSync } from 'node:fs';
import pg from 'pg';

// Every data table carries user_id and every query filters on it, so one
// account can never read or change another account's rows.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS email_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('verificar', 'repor')),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS businesses (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, category TEXT NOT NULL, city TEXT NOT NULL, description TEXT NOT NULL,
  hours TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL, address TEXT NOT NULL,
  booking_link TEXT NOT NULL, instagram TEXT NOT NULL, facebook TEXT NOT NULL, website TEXT NOT NULL,
  accent_color TEXT NOT NULL,
  services JSONB NOT NULL,
  is_example BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL,
  channel TEXT NOT NULL, goal TEXT NOT NULL, service TEXT NOT NULL, audience TEXT NOT NULL, tone TEXT NOT NULL,
  title TEXT NOT NULL, caption TEXT NOT NULL, cta TEXT NOT NULL,
  hashtags JSONB NOT NULL,
  is_example BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS posts_user ON posts(user_id, created_at);
-- Posts saved per month. Deleting a post does not give the slot back.
CREATE TABLE IF NOT EXISTS post_usage (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (user_id, month_key)
);
CREATE TABLE IF NOT EXISTS calendar_entries (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  category TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL,
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  is_example BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS calendar_user_date ON calendar_entries(user_id, date);
CREATE TABLE IF NOT EXISTS reply_overrides (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  client_name TEXT NOT NULL, deadline TEXT NOT NULL, notes TEXT NOT NULL, vat_note TEXT NOT NULL,
  is_example BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (user_id, number)
);
CREATE TABLE IF NOT EXISTS quote_items (
  id UUID PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  description TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0)
);
CREATE INDEX IF NOT EXISTS quote_items_quote ON quote_items(quote_id, position);
CREATE TABLE IF NOT EXISTS plans (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('gratuito', 'pro')),
  trial_started_at TIMESTAMPTZ
);
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export interface Queryable {
  query(sql: string, params?: unknown[]): Promise<{ rows: Row[]; count: number }>;
}

export interface Db extends Queryable {
  tx<T>(work: (q: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export const UNIQUE_VIOLATION = '23505';

// Production: a real Postgres server, reached through DATABASE_URL.
export async function openPostgres(connectionString: string): Promise<Db> {
  const pool = new pg.Pool({ connectionString, max: 10 });
  await pool.query(SCHEMA);
  const wrap = (client: pg.Pool | pg.PoolClient): Queryable => ({
    async query(sql, params = []) {
      const result = await client.query(sql, params);
      return { rows: result.rows, count: result.rowCount ?? 0 };
    },
  });
  return {
    ...wrap(pool),
    async tx(work) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const value = await work(wrap(client));
        await client.query('COMMIT');
        return value;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

// Development and tests: Postgres compiled to WebAssembly, running inside the
// Node process. No install, same SQL dialect. Without a folder it stays in memory.
export async function openEmbedded(dataDir?: string): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const lite = new PGlite(dataDir);
  await lite.exec(SCHEMA);
  const wrap = (target: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; affectedRows?: number }> }): Queryable => ({
    async query(sql, params = []) {
      const result = await target.query(sql, params);
      return { rows: result.rows as Row[], count: result.affectedRows ?? 0 };
    },
  });
  return {
    ...wrap(lite),
    tx: (work) => lite.transaction((transaction) => work(wrap(transaction))) as Promise<never>,
    close: () => lite.close(),
  };
}
