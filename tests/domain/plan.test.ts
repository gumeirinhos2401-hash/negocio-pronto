import { expect, test } from 'vitest';
import { canSavePost, planStatus, postsUsedThisMonth } from '../../src/domain/plan';
import { input, now } from './fixtures';
const post = (createdAt: string, isExample = false) => ({ ...input, id: createdAt, createdAt, title: '', caption: '', cta: '', hashtags: [], isExample });
test('posts from last month and examples do not count', () => {
  const posts = [post(new Date(2026, 9, 31, 23).toISOString()), post(new Date(2026, 10, 1, 8).toISOString()), post(new Date(2026, 10, 1, 8).toISOString(), true)];
  expect(postsUsedThisMonth(posts, now)).toBe(1);
});
test('free plan blocks the sixth post, trial does not', () => {
  const five = Array.from({ length: 5 }, (_, i) => post(new Date(2026, 10, 1, i).toISOString()));
  expect(canSavePost(five, { tier: 'gratuito', trialStartedAt: null }, now)).toBe(false);
  expect(canSavePost(five, { tier: 'pro', trialStartedAt: new Date(2026, 9, 30).toISOString() }, now)).toBe(true);
});
test('trial ends after 7 days', () => {
  expect(planStatus({ tier: 'pro', trialStartedAt: new Date(2026, 9, 30).toISOString() }, now)).toEqual({ kind: 'teste', daysLeft: 5 });
  expect(planStatus({ tier: 'pro', trialStartedAt: new Date(2026, 9, 20).toISOString() }, now)).toEqual({ kind: 'teste-terminado' });
});
