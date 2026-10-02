import { z } from 'zod';
import { isHttpUrl } from '../../src/domain/validation';

const text = (max: number) => z.string().trim().max(max);
const link = text(300).refine((value) => value === '' || isHttpUrl(value), 'O link tem de começar por https:// ou http://.');

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Indique um email válido.'),
  password: z.string().min(10, 'A palavra-passe precisa de pelo menos 10 caracteres.').max(200),
}).strict();

export const passwordSchema = z.object({ password: z.string().min(1).max(200) }).strict();

export const businessSchema = z.object({
  name: text(80).min(1, 'Indique o nome do negócio.'),
  category: text(60),
  city: text(60),
  description: text(500),
  hours: text(200),
  phone: text(30),
  email: text(254).refine((value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Indique um email válido.'),
  address: text(200),
  bookingLink: link,
  instagram: text(100),
  facebook: text(100),
  website: link,
  services: z.array(z.object({
    id: text(64).min(1),
    name: text(80).min(1),
    priceCents: z.number().int().min(0).max(100_000_000).nullable(),
  }).strict()).max(50),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Indique uma cor no formato #RRGGBB.'),
}).strict();

export const postInputSchema = z.object({
  channel: z.enum(['instagram', 'facebook', 'google']),
  goal: z.enum(['divulgar-servico', 'atrair-clientes', 'lembrar-marcacoes', 'informar', 'agradecer']),
  service: text(80).min(1, 'Indique o serviço ou produto de que quer falar.'),
  audience: text(120).min(1, 'Indique a quem se dirige a publicação.'),
  tone: z.enum(['proximo', 'profissional', 'descontraido']),
}).strict();

export const postSchema = postInputSchema.extend({
  title: text(150),
  caption: text(2200).min(1, 'A legenda não pode ficar vazia.'),
  cta: text(300),
  hashtags: z.array(z.string().regex(/^#[^\s#]{1,50}$/)).max(30),
}).strict();

function isRealDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Indique a data no formato AAAA-MM-DD.').refine(isRealDate, 'Essa data não existe.');

export const calendarEntrySchema = z.object({
  date: dateSchema,
  category: z.enum(['promocao', 'servico', 'bastidores', 'testemunho', 'informacao', 'data-especial']),
  title: text(150).min(1, 'Indique o título.'),
  status: z.enum(['planeada', 'publicada', 'cancelada']),
  postId: z.string().max(64).nullable(),
}).strict();

export const calendarPatchSchema = calendarEntrySchema.partial().strict();

export const monthQuerySchema = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional() });

const replyText = text(2000).optional();
export const replyOverridesSchema = z.object({
  precos: replyText, horarios: replyText, localizacao: replyText, reservas: replyText,
  atrasos: replyText, cancelamentos: replyText, reclamacoes: replyText,
}).strict();

export const quoteSchema = z.object({
  clientName: text(100).min(1, 'Indique o nome do cliente.'),
  items: z.array(z.object({
    description: text(200).min(1, 'Indique a descrição do serviço.'),
    priceCents: z.number().int().min(0).max(100_000_000),
  }).strict()).min(1, 'Adicione pelo menos um serviço.').max(50),
  deadline: text(200),
  notes: text(2000),
  vatNote: z.enum(['nenhuma', 'incluido', 'nao-incluido']),
}).strict();
