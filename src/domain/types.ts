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
