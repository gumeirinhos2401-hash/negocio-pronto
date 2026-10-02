export type StoreKey = 'negocio' | 'publicacoes' | 'calendario' | 'respostas' | 'orcamentos' | 'plano';

const PREFIX = 'np:v1:';
const KEYS: StoreKey[] = ['negocio', 'publicacoes', 'calendario', 'respostas', 'orcamentos', 'plano'];

// Holds values that could not be written to localStorage, so the page keeps
// working for the rest of the session when storage is blocked or full.
const memory = new Map<StoreKey, string>();

function readRaw(key: StoreKey): string | null {
  const pending = memory.get(key);
  if (pending !== undefined) return pending;
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function isQuotaError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { name, code } = error as { name?: unknown; code?: unknown };
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014;
}

export function load<T>(key: StoreKey, fallback: T, isValid: (v: unknown) => v is T): T {
  const raw = readRaw(key);
  if (raw === null) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function save<T>(key: StoreKey, value: T): { ok: true } | { ok: false; reason: 'indisponivel' | 'cheio' } {
  let raw: string;
  try {
    raw = JSON.stringify(value);
  } catch {
    return { ok: false, reason: 'indisponivel' };
  }
  try {
    localStorage.setItem(PREFIX + key, raw);
    memory.delete(key);
    return { ok: true };
  } catch (error) {
    memory.set(key, raw);
    return { ok: false, reason: isQuotaError(error) ? 'cheio' : 'indisponivel' };
  }
}

export function clearAll(): void {
  memory.clear();
  for (const key of KEYS) {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      // Storage is unavailable, so there is nothing persisted to remove.
    }
  }
}
