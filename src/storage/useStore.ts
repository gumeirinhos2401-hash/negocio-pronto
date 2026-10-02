import { useCallback, useState } from 'react';
import { load, save, type StoreKey } from './store';

export function useStore<T>(key: StoreKey, fallback: T, isValid: (v: unknown) => v is T):
  [T, (next: T) => { ok: boolean }] {
  const [value, setValue] = useState<T>(() => load(key, fallback, isValid));
  const update = useCallback((next: T) => {
    // The state is updated even when saving fails, so the page keeps working in memory.
    setValue(next);
    return save(key, next);
  }, [key]);
  return [value, update];
}
