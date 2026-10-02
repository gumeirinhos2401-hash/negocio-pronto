import { expect, test } from 'vitest';
import { nextQuoteNumber, quoteTotal, quoteToText } from '../../src/domain/quotes';
import { empty, now } from './fixtures';
test('total sums items', () => expect(quoteTotal({ items: [{ id: '1', description: 'a', priceCents: 1250 }, { id: '2', description: 'b', priceCents: 990 }] })).toBe(2240));
test('numbers are sequential per year', () => {
  expect(nextQuoteNumber([], now)).toBe('2026-001');
  expect(nextQuoteNumber([{ number: '2026-004' } as never, { number: '2025-009' } as never], now)).toBe('2026-005');
});
test('text has euros and omits empty business fields', () => {
  const t = quoteToText({ id: 'q', number: '2026-001', createdAt: now.toISOString(), clientName: 'Ana', items: [{ id: '1', description: 'Corte', priceCents: 1200 }], deadline: '', notes: '', vatNote: 'nenhuma', isExample: false }, empty);
  expect(t).toMatch(/12,00/); expect(t).toContain('Ana'); expect(t).not.toMatch(/undefined|null|IVA/);
});
