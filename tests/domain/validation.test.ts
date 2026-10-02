import { expect, test } from 'vitest';
import { validateBusiness, validateQuoteDraft } from '../../src/domain/validation';
import { empty } from './fixtures';
test('business needs a name and rejects bad email and links', () => {
  const e = validateBusiness({ ...empty, email: 'a@', bookingLink: 'javascript:alert(1)', website: 'ftp://x' });
  expect(e.name).toBeTruthy(); expect(e.email).toBeTruthy(); expect(e.bookingLink).toBeTruthy(); expect(e.website).toBeTruthy();
  expect(validateBusiness({ ...empty, name: 'Café', bookingLink: 'https://exemplo.pt/marcar' })).toEqual({});
});
test('quote needs a client and at least one valid priced item', () => {
  expect(validateQuoteDraft({ clientName: '', items: [], deadline: '' })).toMatchObject({ clientName: expect.any(String), items: expect.any(String) });
  expect(validateQuoteDraft({ clientName: 'Ana', items: [{ description: 'Corte', price: 'abc' }], deadline: '' }).items).toBeTruthy();
  expect(validateQuoteDraft({ clientName: 'Ana', items: [{ description: 'Corte', price: '12,50' }], deadline: '' })).toEqual({});
});
