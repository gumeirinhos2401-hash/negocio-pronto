import { expect, test } from 'vitest';
import { daysInMonth, monthGrid, monthKey } from '../../src/domain/dates';
test('february in leap and common years', () => {
  expect(daysInMonth(2028, 1)).toBe(29); expect(daysInMonth(2027, 1)).toBe(28);
});
test('grid starts on Monday and is padded to full weeks', () => {
  const g = monthGrid(2026, 9);            // October 2026 starts on a Thursday
  expect(g.length % 7).toBe(0);
  expect(g.slice(0, 4)).toEqual([null, null, null, '2026-10-01']);
  expect(g.filter(Boolean).length).toBe(31);
});
test('monthKey uses local date', () => expect(monthKey(new Date(2026, 9, 31, 23, 59))).toBe('2026-10'));
