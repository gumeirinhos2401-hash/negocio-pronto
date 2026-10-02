import type { TestProject } from 'vitest/node';
import { buildApp } from '../server/src/app';
import { openEmbedded } from '../server/src/db';

declare module 'vitest' {
  export interface ProvidedContext { apiUrl: string }
}

// Starts the real API on a free port, with an embedded Postgres kept in memory,
// so the page tests exercise the same server code the app talks to.
export default async function setup(project: TestProject) {
  const db = await openEmbedded();
  const app = await buildApp({ db, mailer: { send: async () => undefined } });
  // Test-only: empties the database between tests. It exists on this instance alone.
  app.post('/__reset', async (_request, reply) => {
    await db.query('TRUNCATE users, rate_limits CASCADE');
    return reply.code(204).send();
  });
  const url = await app.listen({ host: '127.0.0.1', port: 0 });
  project.provide('apiUrl', url);
  return async () => {
    await app.close();
    await db.close();
  };
}
