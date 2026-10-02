// The API is served from the same origin as the app (the dev server proxies /api),
// so the session cookie travels on its own and no address is configured here.
export class ApiFailure extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string>;

  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const NETWORK_ERROR = 'Não foi possível ligar ao servidor. Verifique a ligação à internet e tente de novo.';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export async function api<T = void>(method: Method, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiFailure(0, 'sem-ligacao', NETWORK_ERROR);
  }
  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json().catch(() => null);
  if (response.ok) return payload as T;
  const error = (payload as { error?: { code?: string; message?: string; fields?: Record<string, string> } } | null)?.error;
  throw new ApiFailure(response.status, error?.code ?? 'erro', error?.message ?? 'Ocorreu um erro. Tente de novo.', error?.fields);
}
