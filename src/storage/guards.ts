import type {
  BusinessProfile, CalendarEntry, PlanState, Post, Quote, QuoteItem, ReplyOverrides, Service,
} from '../domain/types';

// Type guards for everything read back from localStorage. Stored content that
// fails a guard is ignored and the app starts that area from its default.

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isCents = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const allStr = (r: Rec, keys: string[]) => keys.every((key) => isStr(r[key]));
const oneOf = (v: unknown, values: readonly string[]) => isStr(v) && values.includes(v);
const listOf = <T>(v: unknown, isItem: (item: unknown) => item is T): v is T[] => Array.isArray(v) && v.every(isItem);

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const CHANNELS = ['instagram', 'facebook', 'google'];
const GOALS = ['divulgar-servico', 'atrair-clientes', 'lembrar-marcacoes', 'informar', 'agradecer'];
const TONES = ['proximo', 'profissional', 'descontraido'];
const CATEGORIES = ['promocao', 'servico', 'bastidores', 'testemunho', 'informacao', 'data-especial'];
const STATUSES = ['planeada', 'publicada', 'cancelada'];
const TOPICS = ['precos', 'horarios', 'localizacao', 'reservas', 'atrasos', 'cancelamentos', 'reclamacoes'];
const VAT_NOTES = ['nenhuma', 'incluido', 'nao-incluido'];

function isService(v: unknown): v is Service {
  return isRec(v) && isStr(v.id) && isStr(v.name) && (v.priceCents === null || isCents(v.priceCents));
}

export function isBusiness(v: unknown): v is BusinessProfile {
  return isRec(v)
    && allStr(v, ['name', 'category', 'city', 'description', 'hours', 'phone', 'email', 'address', 'bookingLink', 'instagram', 'facebook', 'website'])
    && listOf(v.services, isService)
    && isStr(v.accentColor) && HEX_COLOR.test(v.accentColor)
    && isBool(v.isExample);
}

function isPost(v: unknown): v is Post {
  return isRec(v)
    && allStr(v, ['id', 'createdAt', 'service', 'audience', 'title', 'caption', 'cta'])
    && oneOf(v.channel, CHANNELS) && oneOf(v.goal, GOALS) && oneOf(v.tone, TONES)
    && listOf(v.hashtags, isStr)
    && isBool(v.isExample);
}

export function isPosts(v: unknown): v is Post[] {
  return listOf(v, isPost);
}

function isCalendarEntry(v: unknown): v is CalendarEntry {
  return isRec(v)
    && allStr(v, ['id', 'title'])
    && isStr(v.date) && ISO_DAY.test(v.date)
    && oneOf(v.category, CATEGORIES) && oneOf(v.status, STATUSES)
    && (v.postId === null || isStr(v.postId))
    && isBool(v.isExample);
}

export function isCalendar(v: unknown): v is CalendarEntry[] {
  return listOf(v, isCalendarEntry);
}

export function isReplyOverrides(v: unknown): v is ReplyOverrides {
  return isRec(v) && Object.entries(v).every(([topic, text]) => TOPICS.includes(topic) && isStr(text));
}

function isQuoteItem(v: unknown): v is QuoteItem {
  return isRec(v) && isStr(v.id) && isStr(v.description) && isCents(v.priceCents);
}

function isQuote(v: unknown): v is Quote {
  return isRec(v)
    && allStr(v, ['id', 'number', 'createdAt', 'clientName', 'deadline', 'notes'])
    && listOf(v.items, isQuoteItem)
    && oneOf(v.vatNote, VAT_NOTES)
    && isBool(v.isExample);
}

export function isQuotes(v: unknown): v is Quote[] {
  return listOf(v, isQuote);
}

export function isPlan(v: unknown): v is PlanState {
  return isRec(v) && oneOf(v.tier, ['gratuito', 'pro']) && (v.trialStartedAt === null || isStr(v.trialStartedAt));
}
