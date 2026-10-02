import { expect, test } from 'vitest';
import type { Quote } from '../../src/domain/types';
import { buildQuotePdf } from '../../src/pdf/quotePdf';
import { empty, now } from '../domain/fixtures';

const quote: Quote = {
  id: 'q', number: '2026-001', createdAt: now.toISOString(), clientName: 'Ana Conceição',
  items: [{ id: '1', description: 'Corte e barba', priceCents: 1800 }],
  deadline: 'Até ao fim do mês', notes: 'Pagamento no dia.', vatNote: 'incluido', isExample: false,
};

test('a short quote fits on one page, even with an empty profile', async () => {
  const doc = await buildQuotePdf(quote, empty);
  expect(doc.getNumberOfPages()).toBe(1);
});

test('long notes and many items continue on further pages', async () => {
  const notes = Array.from({ length: 120 }, (_, i) => `Linha ${i + 1} das observações, com texto suficiente para ocupar a largura.`).join('\n');
  const items = Array.from({ length: 60 }, (_, i) => ({ id: String(i), description: `Serviço ${i + 1}`, priceCents: 1000 }));
  const doc = await buildQuotePdf({ ...quote, notes, items }, { ...empty, name: 'Café Exemplo', accentColor: '#1F7A4D' });
  expect(doc.getNumberOfPages()).toBeGreaterThan(2);
});
