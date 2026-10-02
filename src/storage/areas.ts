import { useCallback } from 'react';
import { useToast } from '../components/Toast';
import { demoData } from '../domain/demo';
import type { BusinessProfile, CalendarEntry, PlanState, Post, Quote, ReplyOverrides } from '../domain/types';
import { isBusiness, isCalendar, isPlan, isPosts, isQuotes, isReplyOverrides } from './guards';
import type { StoreKey } from './store';
import { useStore } from './useStore';

export const DEFAULT_ACCENT = '#1B4DB1';

export const EMPTY_BUSINESS: BusinessProfile = {
  name: '', category: '', city: '', description: '', hours: '', phone: '', email: '', address: '', bookingLink: '',
  instagram: '', facebook: '', website: '', services: [], accentColor: DEFAULT_ACCENT, isExample: false,
};
export const FREE_PLAN: PlanState = { tier: 'gratuito', trialStartedAt: null };
const NO_POSTS: Post[] = [];
const NO_ENTRIES: CalendarEntry[] = [];
const NO_QUOTES: Quote[] = [];
const NO_OVERRIDES: ReplyOverrides = {};

export const SAVE_ERROR = 'Não foi possível guardar neste navegador. Os dados ficam disponíveis só até fechar a página.';

// One data area. The setter returns true when the value reached localStorage;
// when it did not, the value stays in memory and the user is told.
function useArea<T>(key: StoreKey, fallback: T, isValid: (v: unknown) => v is T): [T, (next: T) => boolean] {
  const [value, setValue] = useStore(key, fallback, isValid);
  const toast = useToast();
  const update = useCallback((next: T) => {
    const { ok } = setValue(next);
    if (!ok) toast.show(SAVE_ERROR, 'error');
    return ok;
  }, [setValue, toast]);
  return [value, update];
}

export const useBusiness = () => useArea('negocio', EMPTY_BUSINESS, isBusiness);
export const usePosts = () => useArea('publicacoes', NO_POSTS, isPosts);
export const useCalendar = () => useArea('calendario', NO_ENTRIES, isCalendar);
export const useReplyOverrides = () => useArea('respostas', NO_OVERRIDES, isReplyOverrides);
export const useQuotes = () => useArea('orcamentos', NO_QUOTES, isQuotes);
export const usePlan = () => useArea('plano', FREE_PLAN, isPlan);

export interface ExampleAreas {
  business: BusinessProfile;
  posts: Post[];
  calendar: CalendarEntry[];
  quotes: Quote[];
}

export function hasExamples(areas: ExampleAreas): boolean {
  return areas.business.isExample
    || areas.posts.some((post) => post.isExample)
    || areas.calendar.some((entry) => entry.isExample)
    || areas.quotes.some((quote) => quote.isExample);
}

// Drops every record tagged as an example and keeps the user's own records.
export function removeExamples(areas: ExampleAreas): ExampleAreas {
  return {
    business: areas.business.isExample ? EMPTY_BUSINESS : areas.business,
    posts: areas.posts.filter((post) => !post.isExample),
    calendar: areas.calendar.filter((entry) => !entry.isExample),
    quotes: areas.quotes.filter((quote) => !quote.isExample),
  };
}

// Replaces the business profile with the fictional one and adds the example
// records next to the user's own posts, calendar entries and quotes.
export function addExamples(areas: ExampleAreas, now: Date): ExampleAreas {
  const own = removeExamples(areas);
  const demo = demoData(now);
  return {
    business: demo.business,
    posts: [...demo.posts, ...own.posts],
    calendar: [...demo.calendar, ...own.calendar],
    quotes: [...demo.quotes, ...own.quotes],
  };
}
