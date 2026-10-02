import { monthKey } from './dates';
import type { PlanState, Post } from './types';

export const FREE_POST_LIMIT = 5; export const PRO_PRICE_CENTS = 990; export const TRIAL_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

// The MVP has no paid state: "pro" only ever means a simulated trial.
export function planStatus(plan: PlanState, now: Date): { kind: 'gratuito' } | { kind: 'teste'; daysLeft: number } | { kind: 'teste-terminado' } {
  if (plan.tier !== 'pro' || plan.trialStartedAt === null) return { kind: 'gratuito' };
  const startedAt = new Date(plan.trialStartedAt).getTime();
  if (Number.isNaN(startedAt)) return { kind: 'gratuito' };
  const remaining = TRIAL_DAYS * DAY_MS - (now.getTime() - startedAt);
  if (remaining <= 0) return { kind: 'teste-terminado' };
  return { kind: 'teste', daysLeft: Math.min(TRIAL_DAYS, Math.ceil(remaining / DAY_MS)) };
}

export function postsUsedThisMonth(posts: Post[], now: Date): number {
  const current = monthKey(now);
  return posts.filter((post) => !post.isExample && monthKey(new Date(post.createdAt)) === current).length;
}

export function canSavePost(posts: Post[], plan: PlanState, now: Date): boolean {
  if (planStatus(plan, now).kind === 'teste') return true;
  return postsUsedThisMonth(posts, now) < FREE_POST_LIMIT;
}
