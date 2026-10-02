import { beforeEach, expect, test, vi } from 'vitest';
import { load, save } from '../../src/storage/store';
const isNum = (v: unknown): v is number => typeof v === 'number';
beforeEach(() => localStorage.clear());

test('returns fallback when key is missing', () => {
  expect(load('plano', 7, isNum)).toBe(7);
});
test('returns fallback when stored JSON is corrupt', () => {
  localStorage.setItem('np:v1:plano', '{not json');
  expect(load('plano', 7, isNum)).toBe(7);
});
test('returns fallback when stored value fails validation', () => {
  localStorage.setItem('np:v1:plano', '"text"');
  expect(load('plano', 7, isNum)).toBe(7);
});
test('save then load round-trips', () => {
  expect(save('plano', 3).ok).toBe(true);
  expect(load('plano', 7, isNum)).toBe(3);
});
test('save reports failure when storage throws', () => {
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('full', 'QuotaExceededError');
  });
  expect(save('plano', 3)).toEqual({ ok: false, reason: 'cheio' });
  spy.mockRestore();
});
