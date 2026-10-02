# Negócio Pronto MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local-first responsive web app that helps small businesses in Portugal write social posts, plan a monthly content calendar, answer customers with ready replies, and produce quotes in euros.

**Architecture:** Single-page app with no backend. A pure TypeScript domain layer (`src/domain`) holds types, text generators, validation and plan limits, and is unit tested. A storage layer (`src/storage`) persists each data area under its own versioned `localStorage` key. React pages (`src/pages`) compose reusable components (`src/components`) and read/write through one `useStore` hook per data area.

**Tech Stack:** Vite, React 19, TypeScript (strict), react-router-dom (HashRouter), plain CSS with custom properties, `@fontsource` self-hosted fonts, `lucide-react` icons, `jspdf` (text API only), Vitest.

**Spec:** `docs/spec.md` (the user brief, copied verbatim).

## Global Constraints

- All interface text in European Portuguese (pt-PT): "telemóvel", "utilizador", "morada", "descarregar", "definições", "marcação", "ecrã", "contacto". Never Brazilian forms ("celular", "usuário", "baixar", "tela").
- All money in euros, formatted with `Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })`. Store prices as integer cents.
- Generated text never contains a price, promotion, discount, review, rating, result or guarantee the user did not type. A missing value produces a neutral sentence or is left out; it is never filled with an invented one.
- The app never says a post was sent to a social network. Status "publicada" means the user marked it by hand; the UI says so.
- No Instagram, WhatsApp, Google or payment integration. No network requests at runtime (fonts are bundled).
- Checkout is a simulation and every checkout screen shows the label "Simulação — nenhum pagamento é cobrado".
- Demo data is fictional and every demo record carries `isExample: true` and a visible "Exemplo" tag.
- Free plan: 5 saved posts per calendar month. Pro: €9,90/mês, 7-day free trial, simulated.
- Data areas stay separate: business, posts, calendar, replies, quotes, plan. One storage key each.
- User text is rendered only as React text nodes. No `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`.
- Accessibility floor: visible labels on every field, error text next to the field and linked with `aria-describedby`, visible focus ring, 44px minimum touch targets, text contrast at least 4.5:1, `prefers-reduced-motion` respected, status changes announced through an `aria-live` region.
- Responsive at 375, 768, 1024 and 1440px with no horizontal scroll.

## Design direction

Subject: shops and service businesses on a Portuguese high street. The one memorable element is an azulejo tile band (an inline SVG pattern in cobalt) used in two places only: the landing hero and the header of the quote document. Everything else stays quiet.

- Colors: Papel `#F4F5F3` (page), Branco `#FFFFFF` (surface), Tinta `#18202B` (text), Pedra `#56606B` (secondary text), Linha `#D9DCD8` (borders), Azulejo `#1B4DB1` (the single accent), plus Erro `#B42318` and Sucesso `#1F7A4D` for states only.
- Type: Bricolage Grotesque (headings, 600/700) and Instrument Sans (body, 400/500/600). Body 16px, line-height 1.5. Sentence case everywhere, no all-caps labels.
- Layout: left aligned. Desktop uses a top bar with text navigation, not a sidebar. Mobile uses a bottom bar with five items: Painel, Publicações, Calendário, Respostas, Mais. Orçamentos, Definições and Planos sit under Mais.
- The dashboard is a "today" page: next planned post, posts left this month, three direct actions. No stat-card grid.
- Motion: only on user action (toast enter, dialog open). No scroll reveals.
- The user's own accent color (identity setting) applies only to the quote document, never to the app chrome.

## Review Focus

1. Empty business profile: every generator and reply must still produce usable text and must name the missing field instead of inventing a value.
2. Corrupt or old `localStorage` content: the app must start with defaults and not crash.
3. `localStorage` unavailable or full (private mode, quota): saving shows an error message and the page keeps working in memory.
4. Price input typed the Portuguese way ("12,50", "12.50", "12", "1 200,00", "abc", "-5"): parse to cents or reject with a field error.
5. Month boundaries for the free limit and the calendar: posts saved on the last day of a month must not count toward the next month; February and 31-day months render the correct number of days; the week starts on Monday.

Tests for each line sit in Task 2 and Task 3 below.

## File Structure

```
negocio-pronto/
  index.html
  package.json  tsconfig.json  vite.config.ts
  docs/spec.md
  src/
    main.tsx  App.tsx  styles/tokens.css  styles/base.css  styles/print.css
    domain/
      types.ts          all data types
      money.ts          parseEuros, formatEuros
      dates.ts          monthKey, daysInMonth, monthGrid, isoDate
      validation.ts     validators returning field -> message maps
      posts.ts          generatePost
      calendar.ts       suggestMonth
      replies.ts        REPLY_TOPICS, buildReply
      quotes.ts         quoteTotal, quoteToText, nextQuoteNumber
      plan.ts           planStatus, postsUsedThisMonth, canSavePost
      demo.ts           demoData (all isExample: true)
    storage/
      store.ts          load/save per key, safe parsing, memory fallback
      useStore.ts       React hook over store.ts
    components/
      AppShell.tsx  TopNav.tsx  BottomNav.tsx
      Button.tsx  Field.tsx  Select.tsx  TextArea.tsx
      Card.tsx  Tag.tsx  EmptyState.tsx  Toast.tsx  Dialog.tsx
      CopyButton.tsx  TileBand.tsx  ExampleTag.tsx
    pages/
      Landing.tsx  Dashboard.tsx  PostGenerator.tsx  CalendarPage.tsx
      Replies.tsx  Quotes.tsx  Settings.tsx  Plans.tsx  More.tsx  NotFound.tsx
    pdf/quotePdf.ts     jsPDF text layout for a quote
  tests/domain/*.test.ts
```

Routes (HashRouter): `/` Landing, `/painel`, `/publicacoes`, `/calendario`, `/respostas`, `/orcamentos`, `/definicoes`, `/planos`, `/mais`, `*` NotFound.

## Data model (`src/domain/types.ts`)

```ts
export type Cents = number;

export interface Service { id: string; name: string; priceCents: Cents | null }

export interface BusinessProfile {
  name: string; category: string; city: string; description: string;
  hours: string; phone: string; email: string; address: string; bookingLink: string;
  instagram: string; facebook: string; website: string;
  services: Service[];
  accentColor: string;          // hex, used only on the quote document
  isExample: boolean;
}

export type Channel = 'instagram' | 'facebook' | 'google';
export type Goal = 'divulgar-servico' | 'atrair-clientes' | 'lembrar-marcacoes' | 'informar' | 'agradecer';
export type Tone = 'proximo' | 'profissional' | 'descontraido';

export interface PostInput {
  channel: Channel; goal: Goal; service: string; audience: string; tone: Tone;
}
export interface Post extends PostInput {
  id: string; createdAt: string;            // ISO datetime
  title: string; caption: string; cta: string; hashtags: string[];
  isExample: boolean;
}

export type CalendarCategory = 'promocao' | 'servico' | 'bastidores' | 'testemunho' | 'informacao' | 'data-especial';
export type CalendarStatus = 'planeada' | 'publicada' | 'cancelada';
export interface CalendarEntry {
  id: string; date: string;                 // YYYY-MM-DD
  category: CalendarCategory; title: string; status: CalendarStatus;
  postId: string | null; isExample: boolean;
}

export type ReplyTopic = 'precos' | 'horarios' | 'localizacao' | 'reservas' | 'atrasos' | 'cancelamentos' | 'reclamacoes';
export type ReplyOverrides = Partial<Record<ReplyTopic, string>>;   // user-edited texts

export interface QuoteItem { id: string; description: string; priceCents: Cents }
export type VatNote = 'nenhuma' | 'incluido' | 'nao-incluido';
export interface Quote {
  id: string; number: string;               // "2026-001"
  createdAt: string; clientName: string;
  items: QuoteItem[]; deadline: string; notes: string; vatNote: VatNote;
  isExample: boolean;
}

export interface PlanState { tier: 'gratuito' | 'pro'; trialStartedAt: string | null }
```

Storage keys: `np:v1:negocio`, `np:v1:publicacoes`, `np:v1:calendario`, `np:v1:respostas`, `np:v1:orcamentos`, `np:v1:plano`.

---

### Task 1: Scaffold, tokens, storage

**Files:** create `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles/*.css`, `src/domain/types.ts`, `src/storage/store.ts`, `src/storage/useStore.ts`, `tests/domain/store.test.ts`, `docs/spec.md`.

**Interfaces — Produces:**
```ts
// store.ts
export type StoreKey = 'negocio' | 'publicacoes' | 'calendario' | 'respostas' | 'orcamentos' | 'plano';
export function load<T>(key: StoreKey, fallback: T, isValid: (v: unknown) => v is T): T;
export function save<T>(key: StoreKey, value: T): { ok: true } | { ok: false; reason: 'indisponivel' | 'cheio' };
export function clearAll(): void;
// useStore.ts
export function useStore<T>(key: StoreKey, fallback: T, isValid: (v: unknown) => v is T):
  [T, (next: T) => { ok: boolean }];
```

- [ ] Step 1: `npm create vite@latest negocio-pronto -- --template react-ts` inside `C:\Users\gustavo` (the folder already holds `docs/`; scaffold into a temp folder and move files if the tool refuses a non-empty folder). Install `react-router-dom lucide-react jspdf @fontsource-variable/bricolage-grotesque @fontsource-variable/instrument-sans` and dev `vitest jsdom @testing-library/react @testing-library/jest-dom`. Set `"strict": true`. Add scripts `test: vitest run`, `typecheck: tsc --noEmit`.
- [ ] Step 2: Write failing tests:

```ts
import { beforeEach, expect, test, vi } from 'vitest';
import { load, save } from '../../src/storage/store';
const isNum = (v: unknown): v is number => typeof v === 'number';
beforeEach(() => localStorage.clear());

test('returns fallback when key is missing', () => {
  expect(load('plano', 7, isNum)).toBe(7);
});
test('returns fallback when stored JSON is corrupt', () => {
  localStorage.setItem('np:v1:plano', '{not json');
  expect(load('plano', 7, isNum)).toBe(7);
});
test('returns fallback when stored value fails validation', () => {
  localStorage.setItem('np:v1:plano', '"text"');
  expect(load('plano', 7, isNum)).toBe(7);
});
test('save then load round-trips', () => {
  expect(save('plano', 3).ok).toBe(true);
  expect(load('plano', 7, isNum)).toBe(3);
});
test('save reports failure when storage throws', () => {
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('full', 'QuotaExceededError');
  });
  expect(save('plano', 3)).toEqual({ ok: false, reason: 'cheio' });
  spy.mockRestore();
});
```

- [ ] Step 3: Run `npm test` and confirm the tests fail because `store.ts` does not exist.
- [ ] Step 4: Implement `store.ts` (try/catch around every `localStorage` call, `JSON.parse` inside try, validator guard, in-memory `Map` fallback when storage throws on read) and `useStore.ts` (`useState` seeded by `load`, setter calls `save` and returns its result).
- [ ] Step 5: Write `tokens.css` with the palette and type scale from "Design direction", `base.css` (reset, focus ring `outline: 3px solid var(--azulejo); outline-offset: 2px`, `@media (prefers-reduced-motion: reduce)` removing transitions), and import both fonts in `main.tsx`.
- [ ] Step 6: `npm test` passes, `npm run typecheck` passes. Commit `feat: scaffold app, design tokens and safe local storage`.

### Task 2: Domain logic

**Files:** create `src/domain/{money,dates,validation,posts,calendar,replies,quotes,plan,demo}.ts` and `tests/domain/{money,dates,posts,replies,quotes,plan,validation}.test.ts`.

**Interfaces — Produces:**
```ts
// money.ts
export function parseEuros(input: string): Cents | null;      // null when invalid or negative
export function formatEuros(cents: Cents): string;            // "12,50 €"
// dates.ts
export function isoDate(d: Date): string;                     // YYYY-MM-DD, local time
export function monthKey(d: Date): string;                    // YYYY-MM
export function daysInMonth(year: number, month0: number): number;
export function monthGrid(year: number, month0: number): (string | null)[]; // Monday first, padded with null, length multiple of 7
// posts.ts
export function generatePost(input: PostInput, business: BusinessProfile): Pick<Post, 'title' | 'caption' | 'cta' | 'hashtags'>;
// calendar.ts
export function suggestMonth(year: number, month0: number, business: BusinessProfile): Omit<CalendarEntry, 'id'>[];
// replies.ts
export const REPLY_TOPICS: { topic: ReplyTopic; label: string }[];
export function buildReply(topic: ReplyTopic, business: BusinessProfile): { text: string; missing: string[] };
// quotes.ts
export function quoteTotal(q: Pick<Quote, 'items'>): Cents;
export function nextQuoteNumber(existing: Quote[], now: Date): string;
export function quoteToText(q: Quote, business: BusinessProfile): string;
// plan.ts
export const FREE_POST_LIMIT = 5; export const PRO_PRICE_CENTS = 990; export const TRIAL_DAYS = 7;
export function planStatus(plan: PlanState, now: Date): { kind: 'gratuito' } | { kind: 'teste'; daysLeft: number } | { kind: 'teste-terminado' };
export function postsUsedThisMonth(posts: Post[], now: Date): number;   // ignores isExample
export function canSavePost(posts: Post[], plan: PlanState, now: Date): boolean;
// validation.ts
export type Errors<K extends string> = Partial<Record<K, string>>;
export function validateBusiness(b: BusinessProfile): Errors<'name' | 'category' | 'city' | 'phone' | 'email' | 'bookingLink' | 'website'>;
export function validatePostInput(i: PostInput): Errors<'service' | 'audience'>;
export function validateQuoteDraft(d: { clientName: string; items: { description: string; price: string }[]; deadline: string }): Errors<'clientName' | 'items' | 'deadline'>;
// demo.ts
export function demoData(now: Date): { business: BusinessProfile; posts: Post[]; calendar: CalendarEntry[]; quotes: Quote[] };
```

Rules the implementation must follow:
- `generatePost`: builds text from sentence templates chosen by `goal` and `tone`, filled only with `business.name`, `business.city`, `input.service`, `input.audience` and `business.bookingLink`/`phone` for the call to action. No number, "%" or "€" may appear unless it is inside a string the user typed. Hashtags come from the category, city and service (lowercase, accents removed, no spaces), 5 to 8 of them, deduplicated. Channel changes length and shape: Instagram caption with hashtags, Facebook without a hashtag block, Google short (under 1500 characters) with no hashtags.
- `buildReply`: each topic has one template. When a needed field is empty the sentence that depends on it is dropped and the field label goes into `missing`. The price reply lists only services that have a price; with none it says prices are given on request. The complaint reply acknowledges and asks for details and promises no refund, compensation or deadline.
- `suggestMonth`: at most 3 entries per week, all `status: 'planeada'`, rotating the six categories. `data-especial` entries only for fixed-date Portuguese occasions (1 Jan, 14 Feb, 25 Abr, 1 Mai, 10 Jun, 1 Nov, 25 Dez, plus Dia da Mãe on the first Sunday of May and Dia do Pai on 19 Mar). Titles are prompts for the user ("Mostrar os bastidores de …"), never claims.
- `planStatus`: `tier === 'pro'` with `trialStartedAt` within 7 days gives `teste`; after 7 days gives `teste-terminado` and free limits apply. The MVP has no paid state.

- [ ] Step 1: Write failing tests:

```ts
// money.test.ts
import { expect, test } from 'vitest';
import { formatEuros, parseEuros } from '../../src/domain/money';
test.each([['12,50', 1250], ['12.50', 1250], ['12', 1200], ['1 200,00', 120000], ['0', 0], [' 9,9 ', 990]])
  ('parses %s', (input, cents) => expect(parseEuros(input)).toBe(cents));
test.each(['abc', '-5', '', '12,345', '1,2,3'])('rejects %s', (input) => expect(parseEuros(input)).toBeNull());
test('formats in pt-PT euros', () => expect(formatEuros(990).replace(/\s/g, ' ')).toBe('9,90 €'));

// dates.test.ts
import { daysInMonth, monthGrid, monthKey } from '../../src/domain/dates';
test('february in leap and common years', () => {
  expect(daysInMonth(2028, 1)).toBe(29); expect(daysInMonth(2027, 1)).toBe(28);
});
test('grid starts on Monday and is padded to full weeks', () => {
  const g = monthGrid(2026, 9);            // October 2026 starts on a Thursday
  expect(g.length % 7).toBe(0);
  expect(g.slice(0, 4)).toEqual([null, null, null, '2026-10-01']);
  expect(g.filter(Boolean).length).toBe(31);
});
test('monthKey uses local date', () => expect(monthKey(new Date(2026, 9, 31, 23, 59))).toBe('2026-10'));

// posts.test.ts
import { generatePost } from '../../src/domain/posts';
const empty = { name: '', category: '', city: '', description: '', hours: '', phone: '', email: '', address: '',
  bookingLink: '', instagram: '', facebook: '', website: '', services: [], accentColor: '#1B4DB1', isExample: false };
const input = { channel: 'instagram', goal: 'divulgar-servico', service: 'Corte de cabelo', audience: 'clientes do bairro', tone: 'proximo' } as const;
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
  expect(h.length).toBeGreaterThanOrEqual(3); expect(h.length).toBeLessThanOrEqual(8);
  expect(new Set(h).size).toBe(h.length);
  expect(h.every((t) => /^#[a-z0-9]+$/.test(t))).toBe(true);
});

// replies.test.ts
import { buildReply, REPLY_TOPICS } from '../../src/domain/replies';
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

// plan.test.ts
import { canSavePost, planStatus, postsUsedThisMonth } from '../../src/domain/plan';
const post = (createdAt: string, isExample = false) => ({ ...input, id: createdAt, createdAt, title: '', caption: '', cta: '', hashtags: [], isExample });
const now = new Date(2026, 10, 1, 9);                 // 1 Nov 2026
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

// quotes.test.ts
import { nextQuoteNumber, quoteTotal, quoteToText } from '../../src/domain/quotes';
test('total sums items', () => expect(quoteTotal({ items: [{ id: '1', description: 'a', priceCents: 1250 }, { id: '2', description: 'b', priceCents: 990 }] })).toBe(2240));
test('numbers are sequential per year', () => {
  expect(nextQuoteNumber([], now)).toBe('2026-001');
  expect(nextQuoteNumber([{ number: '2026-004' } as never, { number: '2025-009' } as never], now)).toBe('2026-005');
});
test('text has euros and omits empty business fields', () => {
  const t = quoteToText({ id: 'q', number: '2026-001', createdAt: now.toISOString(), clientName: 'Ana', items: [{ id: '1', description: 'Corte', priceCents: 1200 }], deadline: '', notes: '', vatNote: 'nenhuma', isExample: false }, empty);
  expect(t).toMatch(/12,00/); expect(t).toContain('Ana'); expect(t).not.toMatch(/undefined|null|IVA/);
});

// validation.test.ts
import { validateBusiness, validateQuoteDraft } from '../../src/domain/validation';
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
```

- [ ] Step 2: Run `npm test`, confirm the new tests fail on missing modules.
- [ ] Step 3: Implement the nine modules to the interfaces and rules above. Links are valid only when `new URL(value).protocol` is `http:` or `https:`.
- [ ] Step 4: `npm test` and `npm run typecheck` pass. Commit `feat: domain logic for posts, calendar, replies, quotes and plan`.

### Task 3: Components and app shell

**Files:** create everything under `src/components/`, `src/App.tsx` routes, `src/pages/NotFound.tsx`, `src/pages/More.tsx`, `tests/components/{Field,CopyButton}.test.tsx`.

**Interfaces — Produces:**
```tsx
<Button variant="primary" | "secondary" | "quiet" | "danger" type? disabled? onClick?>…</Button>
<Field label id value onChange error? hint? type? inputMode? required? autoComplete? />   // renders <label for>, error with role="alert" and aria-describedby
<TextArea label id value onChange error? hint? rows? />
<Select label id value onChange options={[{ value, label }]} error? />
<Card as?>…</Card>   <Tag tone="neutral" | "accent" | "success" | "muted">…</Tag>   <ExampleTag />
<EmptyState title text action? />                 // action: { label, onClick } or { label, to }
<Dialog open title onClose>…</Dialog>              // native <dialog>, focus trapped by showModal(), Esc closes
<CopyButton text label? />                         // navigator.clipboard with textarea fallback; toast "Texto copiado" or "Não foi possível copiar. Selecione o texto e copie manualmente."
useToast(): { show(message: string, tone?: 'success' | 'error'): void }   // <ToastProvider> renders an aria-live="polite" region
<TileBand height? />                               // decorative, aria-hidden
<AppShell>…</AppShell>                             // TopNav at >=768px, BottomNav below; skip link "Saltar para o conteúdo"
```

- [ ] Step 1: Write failing tests: `Field` links its error by `aria-describedby` and sets `aria-invalid`; `CopyButton` calls `navigator.clipboard.writeText` with the text and shows "Texto copiado"; when `writeText` rejects it shows the error message.
- [ ] Step 2: Run, confirm failure.
- [ ] Step 3: Implement components with one CSS file each next to the component, using only tokens. Touch targets 44px. `BottomNav` has exactly five links with icon and text label and `aria-current="page"`.
- [ ] Step 4: Tests and typecheck pass. Commit `feat: reusable components and responsive app shell`.

### Task 4: Pages

**Files:** create the ten files under `src/pages/` and `src/pdf/quotePdf.ts`.

**Interfaces — Consumes:** everything from Tasks 1 to 3. **Produces:** `export function downloadQuotePdf(q: Quote, business: BusinessProfile): void` (jsPDF `text`, `line`, `rect` only; file name `orcamento-<number>.pdf`).

Page requirements:
- **Landing `/`:** tile band, one plain headline saying what the app does, the four tools shown with a real example of each output (tagged Exemplo), plan summary, primary button "Começar" to `/painel`. Footer line: the app stores data only in this browser.
- **Dashboard `/painel`:** first visit with no business shows an empty state with two actions, "Preencher o perfil do negócio" and "Ver com dados de exemplo". With data: next planned calendar entry, "x de 5 publicações usadas este mês" (or trial days left), three actions. A banner appears while example data is loaded, with "Apagar dados de exemplo".
- **PostGenerator `/publicacoes`:** form (channel, goal, service picked from profile services or typed, audience, tone), "Gerar publicação", result in editable fields (title, caption, call to action, hashtags), `CopyButton` per field and "Copiar tudo", "Guardar publicação". List of saved posts with delete (confirm dialog). When `canSavePost` is false the save button is replaced by a message with the limit and a link to `/planos`; generating and copying still work. Toast on save: "Publicação guardada". Nothing on this page says "publicar" as an app action.
- **CalendarPage `/calendario`:** month grid (list by day under 768px), previous/next month, "Sugerir publicações para este mês" (asks before replacing existing planned suggestions), add/edit entry dialog (date, category, title), status control with the three states, legend for the six categories using text plus color. Note under the grid: "Marcar como publicada é só um registo seu. A Negócio Pronto não publica nas redes sociais."
- **Replies `/respostas`:** seven topics, each showing the built text in an editable area, the list of missing profile fields with a link to `/definicoes`, `CopyButton`, "Guardar alteração" and "Repor texto original".
- **Quotes `/orcamentos`:** form (client name, item rows with description and price, deadline, notes, VAT note select), live document preview with the tile band in the business accent color, total in euros, "Guardar orçamento", "Copiar texto", "Descarregar PDF". Saved list with delete. The document footer says "Este documento é um orçamento e não substitui uma fatura."
- **Settings `/definicoes`:** the business profile form in sections (Identificação, Contactos, Redes sociais, Serviços e preços, Identidade visual with a color input and preview), validation on save, toast "Definições guardadas". Section "Dados": "Carregar dados de exemplo", "Apagar dados de exemplo", "Apagar todos os dados" (danger, confirm dialog).
- **Plans `/planos`:** Gratuito (5 publicações por mês) and Pro (9,90 € por mês, teste gratuito de 7 dias). "Experimentar o Pro" opens a simulated checkout dialog with the label "Simulação — nenhum pagamento é cobrado", no card fields, a single confirm button "Iniciar teste (simulação)". Trial state shows days left and "Terminar teste".
- **More `/mais`:** links to Orçamentos, Definições, Planos. **NotFound:** message and link to `/painel`.

- [ ] Step 1: Implement pages in the order Settings, Dashboard, PostGenerator, Replies, Quotes, CalendarPage, Plans, Landing, More, NotFound. Run `npm run typecheck` after each.
- [ ] Step 2: Write `src/styles/print.css` so printing `/orcamentos` shows only the quote document.
- [ ] Step 3: `npm test`, `npm run typecheck`, `npm run build` pass. Commit `feat: MVP pages`.

### Task 5: Browser verification and review

- [ ] Step 1: `npm run dev`, then drive these flows with Playwright at 375px and 1280px: fill profile and save; load example data; generate, edit, copy and save a post; hit the 5-post limit; suggest a month and change a status; edit and copy a reply; create a quote and download the PDF; start and end the simulated trial; delete all data; reload and confirm persistence. Check the console for errors and each page for horizontal scroll.
- [ ] Step 2: Accessibility pass: keyboard-only run through each flow, focus visible, dialogs return focus, contrast of every token pair, labels and error links.
- [ ] Step 3: Security pass (claude-security plus manual): grep for `dangerouslySetInnerHTML|innerHTML|eval\(|new Function|document\.write`, confirm link validation, confirm no runtime network requests, run `npm audit`, add a Content-Security-Policy meta tag (`default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'`).
- [ ] Step 4: Fix findings, re-run tests and build. Commit `fix: review findings`.

## Out of scope for this MVP

Accounts and login, a backend or cloud sync, real payments, publishing to or reading from Instagram, Facebook, Google or WhatsApp, AI text generation through an external model, image or video creation, invoicing and tax calculation, multiple businesses or team members, analytics, notifications, other languages, a native app.
