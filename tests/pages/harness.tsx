import { render } from '@testing-library/react';
import { inject } from 'vitest';
import App from '../../src/App';

const realFetch = globalThis.fetch;
const base = inject('apiUrl');
let cookie = '';

export const PASSWORD = 'uma-palavra-passe-longa';

// Sends the app's relative /api requests to the test server and keeps the
// session cookie, which is what the browser does for the real app.
export async function testFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const path = String(input);
  const headers = new Headers(init?.headers);
  if (cookie) headers.set('cookie', cookie);
  const response = await realFetch(path.startsWith('/') ? base + path : path, { ...init, headers });
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(';')[0];
    cookie = pair.endsWith('=') ? '' : pair;
  }
  return response;
}

export async function resetServer(): Promise<void> {
  cookie = '';
  await realFetch(`${base}/__reset`, { method: 'POST' });
}

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await testFetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export const signUp = (email = 'ana@exemplo.pt') => request('POST', '/api/auth/register', { email, password: PASSWORD });

export function open(route: string) {
  window.location.hash = `#${route}`;
  return render(<App />);
}
