import { useContext } from 'react';
import type { BusinessProfile, CalendarEntry, Post, Quote } from '../domain/types';
import { DataContext, type DataContextValue } from './DataProvider';

export { DEFAULT_ACCENT, EMPTY_BUSINESS, FREE_PLAN, SAVE_ERROR } from './DataProvider';

function useData(): DataContextValue {
  const context = useContext(DataContext);
  if (!context) throw new Error('This page needs a DataProvider above it.');
  return context;
}

// One hook per data area. Each returns the value and a setter that takes the
// whole new value; the provider works out what changed and tells the server.
export const useBusiness = () => { const c = useData(); return [c.data.business, c.setBusiness] as const; };
export const usePosts = () => { const c = useData(); return [c.data.posts, c.setPosts] as const; };
export const useCalendar = () => { const c = useData(); return [c.data.calendar, c.setCalendar] as const; };
export const useReplyOverrides = () => { const c = useData(); return [c.data.overrides, c.setOverrides] as const; };
export const useQuotes = () => { const c = useData(); return [c.data.quotes, c.setQuotes] as const; };
export const usePlan = () => { const c = useData(); return [c.data.plan, c.setPlan] as const; };

// Posts saved this month as the server counts them: deleting a post does not lower it.
export const usePostsUsedThisMonth = () => useData().data.postsUsedThisMonth;

export function useAccountData() {
  const { loadExamples, removeExamples, deleteAllData } = useData();
  return { loadExamples, removeExamples, deleteAllData };
}

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
