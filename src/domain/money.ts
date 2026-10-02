import type { Cents } from './types';

const formatter = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });

// Accepts amounts typed the Portuguese way: "12,50", "12.50", "12", "1 200,00", "1.200,00".
export function parseEuros(input: string): Cents | null {
  let text = input.replace(/\s/g, '').replace(/€$/, '');
  // A dot is a thousands separator only when a decimal comma follows the groups.
  if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(text)) text = text.replace(/\./g, '');
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function formatEuros(cents: Cents): string {
  return formatter.format(cents / 100);
}
