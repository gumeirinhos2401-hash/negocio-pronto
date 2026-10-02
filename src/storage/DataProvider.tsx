import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, ApiFailure } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/Button';
import { useToast } from '../components/Toast';
import type { BusinessProfile, CalendarEntry, PlanState, Post, Quote, ReplyOverrides } from '../domain/types';

export const DEFAULT_ACCENT = '#1B4DB1';
export const EMPTY_BUSINESS: BusinessProfile = {
  name: '', category: '', city: '', description: '', hours: '', phone: '', email: '', address: '', bookingLink: '',
  instagram: '', facebook: '', website: '', services: [], accentColor: DEFAULT_ACCENT, isExample: false,
};
export const FREE_PLAN: PlanState = { tier: 'gratuito', trialStartedAt: null };
export const SAVE_ERROR = 'Não foi possível guardar. Os dados foram repostos como estavam no servidor.';

export interface Data {
  business: BusinessProfile;
  posts: Post[];
  calendar: CalendarEntry[];
  overrides: ReplyOverrides;
  quotes: Quote[];
  plan: PlanState;
  postsUsedThisMonth: number;
}

interface ServerPlan extends PlanState { postsUsedThisMonth: number }
interface ServerData {
  business: BusinessProfile | null;
  posts: Post[];
  entries: CalendarEntry[];
  overrides: ReplyOverrides;
  quotes: Quote[];
  plan: ServerPlan;
}

const fromServer = (body: ServerData): Data => ({
  business: body.business ?? EMPTY_BUSINESS,
  posts: body.posts,
  calendar: body.entries,
  overrides: body.overrides,
  quotes: body.quotes,
  plan: { tier: body.plan.tier, trialStartedAt: body.plan.trialStartedAt },
  postsUsedThisMonth: body.plan.postsUsedThisMonth,
});

export interface DataContextValue {
  data: Data;
  setBusiness(next: BusinessProfile): boolean;
  setPosts(next: Post[]): boolean;
  setCalendar(next: CalendarEntry[]): boolean;
  setOverrides(next: ReplyOverrides): boolean;
  setQuotes(next: Quote[]): boolean;
  setPlan(next: PlanState): boolean;
  loadExamples(): Promise<boolean>;
  removeExamples(): Promise<boolean>;
  deleteAllData(): Promise<boolean>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const DataContext = createContext<DataContextValue | null>(null);

const postBody = ({ id, channel, goal, service, audience, tone, title, caption, cta, hashtags }: Post) =>
  ({ id, channel, goal, service, audience, tone, title, caption, cta, hashtags });
const entryBody = ({ date, category, title, status, postId }: CalendarEntry) => ({ date, category, title, status, postId });
const quoteBody = ({ clientName, items, deadline, notes, vatNote }: Quote) =>
  ({ clientName, items: items.map(({ description, priceCents }) => ({ description, priceCents })), deadline, notes, vatNote });
const businessBody = ({ isExample: _isExample, ...business }: BusinessProfile) => business;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function diff<T extends { id: string }>(before: T[], after: T[], body: (item: T) => unknown) {
  const old = new Map(before.map((item) => [item.id, item]));
  const kept = new Set(after.map((item) => item.id));
  return {
    added: after.filter((item) => !old.has(item.id)),
    changed: after.filter((item) => old.has(item.id) && !same(body(old.get(item.id)!), body(item))),
    removed: before.filter((item) => !kept.has(item.id)),
  };
}

// Holds the account's data. Pages change it through the setters: the screen
// updates at once, the change is sent to the server in the background, and if
// the server refuses it the user is told and the data is loaded again.
export function DataProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const { sessionEnded } = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const current = useRef<Data | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const replace = useCallback((next: Data) => {
    current.current = next;
    setData(next);
  }, []);
  const patch = useCallback((change: Partial<Data>) => {
    if (current.current) replace({ ...current.current, ...change });
  }, [replace]);

  const reload = useCallback(async () => {
    try {
      replace(fromServer(await api<ServerData>('GET', '/api/bootstrap')));
      setLoadError(null);
    } catch (error) {
      if (error instanceof ApiFailure && error.status === 401) sessionEnded();
      else setLoadError(error instanceof ApiFailure ? error.message : SAVE_ERROR);
    }
  }, [replace, sessionEnded]);

  useEffect(() => { void reload(); }, [reload]);

  const fail = useCallback(async (error: unknown) => {
    if (error instanceof ApiFailure && error.status === 401) {
      sessionEnded();
      return;
    }
    toast.show(error instanceof ApiFailure && error.status !== 0 && error.status < 500 ? error.message : SAVE_ERROR, 'error');
    await reload();
  }, [reload, sessionEnded, toast]);

  // Requests run one after another, in the order the user made the changes.
  const send = useCallback((work: () => Promise<void>) => {
    queue.current = queue.current.then(work).catch(fail);
  }, [fail]);

  const run = useCallback(async (work: () => Promise<ServerData | void>): Promise<boolean> => {
    await queue.current;
    try {
      const body = await work();
      if (body) replace(fromServer(body));
      else await reload();
      return true;
    } catch (error) {
      await fail(error);
      return false;
    }
  }, [fail, reload, replace]);

  const value = useMemo<DataContextValue | null>(() => data && {
    data,
    setBusiness(next) {
      patch({ business: next });
      send(async () => { await api('PUT', '/api/business', businessBody(next)); });
      return true;
    },
    setPosts(next) {
      const { added, removed } = diff(current.current!.posts, next, postBody);
      patch({ posts: next });
      send(async () => {
        for (const post of removed) await api('DELETE', `/api/posts/${post.id}`);
        for (const post of added) {
          const saved = await api<{ plan: ServerPlan }>('POST', '/api/posts', postBody(post));
          patch({ postsUsedThisMonth: saved.plan.postsUsedThisMonth });
        }
      });
      return true;
    },
    setCalendar(next) {
      const { added, changed, removed } = diff(current.current!.calendar, next, entryBody);
      patch({ calendar: next });
      send(async () => {
        for (const entry of removed) await api('DELETE', `/api/calendar/${entry.id}`);
        for (const entry of added) await api('POST', '/api/calendar', { id: entry.id, ...entryBody(entry) });
        for (const entry of changed) await api('PATCH', `/api/calendar/${entry.id}`, entryBody(entry));
      });
      return true;
    },
    setOverrides(next) {
      patch({ overrides: next });
      send(async () => { await api('PUT', '/api/replies', next); });
      return true;
    },
    setQuotes(next) {
      const { added, changed, removed } = diff(current.current!.quotes, next, quoteBody);
      patch({ quotes: next });
      send(async () => {
        for (const quote of removed) await api('DELETE', `/api/quotes/${quote.id}`);
        for (const quote of changed) await api('PUT', `/api/quotes/${quote.id}`, quoteBody(quote));
        for (const quote of added) {
          // The server assigns the number; take it in case it differs from the one shown.
          const saved = await api<{ quote: Quote }>('POST', '/api/quotes', { id: quote.id, ...quoteBody(quote) });
          patch({ quotes: current.current!.quotes.map((q) => (q.id === quote.id ? { ...q, number: saved.quote.number } : q)) });
        }
      });
      return true;
    },
    setPlan(next) {
      patch({ plan: next });
      send(async () => {
        const saved = await api<{ plan: ServerPlan }>(next.tier === 'pro' ? 'POST' : 'DELETE', '/api/plan/trial');
        patch({ plan: { tier: saved.plan.tier, trialStartedAt: saved.plan.trialStartedAt }, postsUsedThisMonth: saved.plan.postsUsedThisMonth });
      });
      return true;
    },
    loadExamples: () => run(() => api<ServerData>('POST', '/api/demo')),
    removeExamples: () => run(() => api<ServerData>('DELETE', '/api/demo')),
    deleteAllData: () => run(() => api('DELETE', '/api/data')),
  }, [data, patch, run, send]);

  if (loadError) {
    return (
      <div className="estado-pagina" role="alert">
        <p>{loadError}</p>
        <Button onClick={() => void reload()}>Tentar de novo</Button>
      </div>
    );
  }
  if (!value) return <p className="estado-pagina" role="status">A carregar os seus dados…</p>;
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
