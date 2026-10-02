import { expect, test } from 'vitest';
import { suggestMonth } from '../../src/domain/calendar';
import { demoData } from '../../src/domain/demo';
import { empty, now } from './fixtures';

// Monday of the week a YYYY-MM-DD date falls in, used to group entries by week.
const weekStart = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(d - ((date.getDay() + 6) % 7));
  return date.toDateString();
};

test('suggests at most 3 planned entries per week, inside the month, without invented claims', () => {
  for (let month0 = 0; month0 < 12; month0++) {
    const entries = suggestMonth(2026, month0, empty);
    expect(entries.length).toBeGreaterThan(0);
    const perWeek = new Map<string, number>();
    for (const e of entries) {
      expect(e.status).toBe('planeada');
      expect(e.date.startsWith(`2026-${String(month0 + 1).padStart(2, '0')}-`)).toBe(true);
      expect(e.title).not.toMatch(/undefined|null|€|%|\d/);
      perWeek.set(weekStart(e.date), (perWeek.get(weekStart(e.date)) ?? 0) + 1);
    }
    expect(Math.max(...perWeek.values())).toBeLessThanOrEqual(3);
    expect(new Set(entries.map((e) => e.date)).size).toBe(entries.length);
  }
});
test('special dates appear only on the fixed Portuguese occasions', () => {
  const special = (month0: number) => suggestMonth(2026, month0, empty).filter((e) => e.category === 'data-especial').map((e) => e.date);
  expect(special(4)).toEqual(['2026-05-01', '2026-05-03']);     // Dia do Trabalhador, Dia da Mãe (first Sunday)
  expect(special(2)).toEqual(['2026-03-19']);
  expect(special(7)).toEqual([]);
});
test('demo data is all marked as example', () => {
  const d = demoData(now);
  expect(d.business.isExample).toBe(true);
  expect([...d.posts, ...d.calendar, ...d.quotes].every((r) => r.isExample)).toBe(true);
  expect(d.posts.length).toBeGreaterThan(0); expect(d.calendar.length).toBeGreaterThan(0); expect(d.quotes.length).toBeGreaterThan(0);
});
