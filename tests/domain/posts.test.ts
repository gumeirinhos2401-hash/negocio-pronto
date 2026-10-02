import { expect, test } from 'vitest';
import { generatePost } from '../../src/domain/posts';
import { empty, input } from './fixtures';
test('never invents prices, discounts or ratings', () => {
  for (const goal of ['divulgar-servico', 'atrair-clientes', 'lembrar-marcacoes', 'informar', 'agradecer'] as const)
    for (const tone of ['proximo', 'profissional', 'descontraido'] as const)
      for (const channel of ['instagram', 'facebook', 'google'] as const) {
        const p = generatePost({ ...input, goal, tone, channel }, empty);
        const all = [p.title, p.caption, p.cta].join(' ');
        expect(all).not.toMatch(/€|%|\d|desconto|promoção|grátis|estrelas|garantid/i);
      }
});
test('works with an empty profile and mentions the service', () => {
  const p = generatePost(input, empty);
  expect(p.caption).toContain('Corte de cabelo');
  expect(p.caption).not.toMatch(/undefined|null| ,| \./);
});
test('google posts have no hashtags, instagram has 5 to 8 unique', () => {
  expect(generatePost({ ...input, channel: 'google' }, empty).hashtags).toEqual([]);
  const h = generatePost(input, { ...empty, category: 'Barbearia', city: 'Braga' }).hashtags;
  expect(h.length).toBeGreaterThanOrEqual(5); expect(h.length).toBeLessThanOrEqual(8);
  expect(new Set(h).size).toBe(h.length);
  expect(h.every((t) => /^#[a-z0-9]+$/.test(t))).toBe(true);
});
