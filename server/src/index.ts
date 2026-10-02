import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app';
import { openDb } from './db';

const here = dirname(fileURLToPath(import.meta.url));
const databasePath = process.env.DATABASE_PATH ?? resolve(here, '../data/negocio-pronto.db');
mkdirSync(dirname(databasePath), { recursive: true });

const app = await buildApp({
  db: openDb(databasePath),
  logger: true,
  secureCookies: process.env.NODE_ENV === 'production',
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()),
});

// Bound to this machine only. Change HOST deliberately when deploying.
await app.listen({ host: process.env.HOST ?? '127.0.0.1', port: Number(process.env.PORT ?? 3001) });
