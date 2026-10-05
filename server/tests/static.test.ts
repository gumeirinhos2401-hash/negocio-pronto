import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { buildApp } from '../src/app';
import { openEmbedded, type Db } from '../src/db';

// In production one server delivers both the built app (dist) and the API, so the browser talks to a single origin.
let app: FastifyInstance;
let db: Db;
let dir: string;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'np-static-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Negócio Pronto</title>');
  writeFileSync(join(dir, 'assets', 'app.js'), 'console.log(1)');
  db = await openEmbedded();
  app = await buildApp({ db, mailer: { send: async () => {} }, staticDir: dir });
});

afterAll(async () => {
  await app.close();
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

test('serves the built page at the root', async () => {
  const response = await app.inject({ method: 'GET', url: '/' });
  expect(response.statusCode).toBe(200);
  expect(response.headers['content-type']).toContain('text/html');
  expect(response.body).toContain('Negócio Pronto');
});

test('serves built assets as files', async () => {
  const response = await app.inject({ method: 'GET', url: '/assets/app.js' });
  expect(response.statusCode).toBe(200);
  expect(response.body).toBe('console.log(1)');
});

test('answers app routes with the page so a reload keeps working', async () => {
  const response = await app.inject({ method: 'GET', url: '/calendario', headers: { accept: 'text/html' } });
  expect(response.statusCode).toBe(200);
  expect(response.body).toContain('Negócio Pronto');
});

test('keeps unknown API paths as JSON 404s, never the page', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/nao-existe' });
  expect(response.statusCode).toBe(404);
  expect(response.headers['content-type']).toContain('application/json');
});

test('does not answer a missing asset with the page', async () => {
  const response = await app.inject({ method: 'GET', url: '/assets/falta.js' });
  expect(response.statusCode).toBe(404);
});
