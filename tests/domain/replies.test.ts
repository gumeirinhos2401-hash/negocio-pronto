import { expect, test } from 'vitest';
import { buildReply, REPLY_TOPICS } from '../../src/domain/replies';
import { empty } from './fixtures';
test('seven topics', () => expect(REPLY_TOPICS).toHaveLength(7));
test('empty profile lists missing fields and promises nothing', () => {
  for (const { topic } of REPLY_TOPICS) {
    const r = buildReply(topic, empty);
    expect(r.text).not.toMatch(/undefined|null|€|\d/);
    expect(r.text.length).toBeGreaterThan(20);
  }
  expect(buildReply('horarios', empty).missing).toContain('Horário');
});
test('price reply lists only services with a price', () => {
  const r = buildReply('precos', { ...empty, services: [
    { id: 'a', name: 'Corte', priceCents: 1200 }, { id: 'b', name: 'Barba', priceCents: null }] });
  expect(r.text).toContain('Corte'); expect(r.text).toMatch(/12,00/); expect(r.text).not.toContain('Barba:');
});
test('complaint reply offers no refund or compensation', () =>
  expect(buildReply('reclamacoes', empty).text).not.toMatch(/reembols|devolu|compensa|oferta|gratuit/i));
