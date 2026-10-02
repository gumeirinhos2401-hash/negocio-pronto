import { formatEuros } from './money';
import type { BusinessProfile, Cents, Quote, VatNote } from './types';

export const QUOTE_FOOTER = 'Este documento é um orçamento e não substitui uma fatura.';

export const VAT_NOTE_TEXT: Record<VatNote, string> = {
  nenhuma: '',
  incluido: 'IVA incluído nos valores apresentados.',
  'nao-incluido': 'Aos valores apresentados acresce IVA à taxa legal em vigor.',
};

const dateFormatter = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'long' });

export function quoteTotal(q: Pick<Quote, 'items'>): Cents {
  return q.items.reduce((sum, item) => sum + item.priceCents, 0);
}

export function nextQuoteNumber(existing: Quote[], now: Date): string {
  const year = String(now.getFullYear());
  let last = 0;
  for (const quote of existing) {
    const match = /^(\d{4})-(\d+)$/.exec(quote.number);
    if (match && match[1] === year) last = Math.max(last, Number(match[2]));
  }
  return `${year}-${String(last + 1).padStart(3, '0')}`;
}

export function formatQuoteDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date);
}

export function quoteToText(q: Quote, business: BusinessProfile): string {
  const header = [
    business.name.trim(),
    [business.address.trim(), business.city.trim()].filter(Boolean).join(', '),
    [business.phone.trim(), business.email.trim()].filter(Boolean).join(' · '),
  ].filter(Boolean);
  const date = formatQuoteDate(q.createdAt);

  const blocks: string[][] = [
    header,
    [`Orçamento n.º ${q.number}`, date ? `Data: ${date}` : '', q.clientName.trim() ? `Cliente: ${q.clientName.trim()}` : ''],
    q.items.map((item) => `${item.description.trim()}: ${formatEuros(item.priceCents)}`),
    [`Total: ${formatEuros(quoteTotal(q))}`, VAT_NOTE_TEXT[q.vatNote]],
    [q.deadline.trim() ? `Prazo: ${q.deadline.trim()}` : '', q.notes.trim() ? `Observações: ${q.notes.trim()}` : ''],
    [QUOTE_FOOTER],
  ];
  return blocks
    .map((block) => block.filter(Boolean).join('\n'))
    .filter(Boolean)
    .join('\n\n');
}
