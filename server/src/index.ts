import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app';
import { parseTrustProxy } from './config';
import { openEmbedded, openPostgres } from './db';
import { consoleMailer, missingMailer, resendMailer } from './mail';

const here = dirname(fileURLToPath(import.meta.url));
const production = process.env.NODE_ENV === 'production';
const { DATABASE_URL, RESEND_API_KEY, MAIL_FROM, APP_URL, ALLOWED_ORIGINS } = process.env;

if (production && !DATABASE_URL) throw new Error('DATABASE_URL is required in production.');
if (production && !APP_URL) throw new Error('APP_URL is required in production.');

// Without DATABASE_URL the server uses an embedded Postgres stored in server/data: nothing to install for development.
const db = DATABASE_URL ? await openPostgres(DATABASE_URL) : await openEmbedded(process.env.PGLITE_DIR ?? resolve(here, '../data/pg'));
const mailer = RESEND_API_KEY && MAIL_FROM ? resendMailer(RESEND_API_KEY, MAIL_FROM) : production ? missingMailer : consoleMailer;

const app = await buildApp({
  db,
  mailer,
  logger: true,
  appUrl: APP_URL,
  allowedOrigins: ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()) ?? (APP_URL ? [APP_URL] : undefined),
  secureCookies: production,
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
});

// Bound to this machine only unless HOST says otherwise.
await app.listen({ host: process.env.HOST ?? '127.0.0.1', port: Number(process.env.PORT ?? 3001) });
