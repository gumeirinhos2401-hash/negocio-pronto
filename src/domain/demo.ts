import { suggestMonth } from './calendar';
import { isoDate } from './dates';
import { generatePost } from './posts';
import { nextQuoteNumber } from './quotes';
import type { BusinessProfile, CalendarEntry, Post, PostInput, Quote } from './types';

// Everything here is fictional. The ".example" domain is reserved and can never
// belong to a real business, and every record carries isExample: true.
const DEMO_BUSINESS: BusinessProfile = {
  name: 'Barbearia Exemplo',
  category: 'Barbearia',
  city: 'Braga',
  description: 'Barbearia de bairro. Negócio fictício, criado só para mostrar como a aplicação funciona.',
  hours: 'Terça a sábado, das 9h30 às 19h00',
  phone: '253 000 000',
  email: 'ola@barbearia.example',
  address: 'Rua do Exemplo, 10',
  bookingLink: 'https://barbearia.example/marcar',
  instagram: '@barbearia.exemplo',
  facebook: '',
  website: 'https://barbearia.example',
  services: [
    { id: 'exemplo-servico-1', name: 'Corte de cabelo', priceCents: 1200 },
    { id: 'exemplo-servico-2', name: 'Barba', priceCents: 800 },
    { id: 'exemplo-servico-3', name: 'Corte e barba', priceCents: 1800 },
    { id: 'exemplo-servico-4', name: 'Corte de criança', priceCents: null },
  ],
  accentColor: '#1B4DB1',
  isExample: true,
};

const DEMO_INPUTS: PostInput[] = [
  { channel: 'instagram', goal: 'divulgar-servico', service: 'Corte de cabelo', audience: 'quem vive ou trabalha no bairro', tone: 'proximo' },
  { channel: 'facebook', goal: 'lembrar-marcacoes', service: 'Corte e barba', audience: 'clientes habituais', tone: 'descontraido' },
  { channel: 'google', goal: 'informar', service: 'Barba', audience: 'quem nos procura pela primeira vez', tone: 'profissional' },
];

export function demoData(now: Date): { business: BusinessProfile; posts: Post[]; calendar: CalendarEntry[]; quotes: Quote[] } {
  const business: BusinessProfile = { ...DEMO_BUSINESS, services: DEMO_BUSINESS.services.map((s) => ({ ...s })) };
  const createdAt = now.toISOString();
  const today = isoDate(now);

  const posts: Post[] = DEMO_INPUTS.map((input, index) => ({
    ...input,
    ...generatePost(input, business),
    id: `exemplo-publicacao-${index + 1}`,
    createdAt,
    isExample: true,
  }));

  const calendar: CalendarEntry[] = suggestMonth(now.getFullYear(), now.getMonth(), business).map((entry, index) => ({
    ...entry,
    id: `exemplo-calendario-${index + 1}`,
    // Past entries show what the "publicada" state looks like.
    status: entry.date < today ? 'publicada' : 'planeada',
    isExample: true,
  }));

  const quotes: Quote[] = [{
    id: 'exemplo-orcamento-1',
    number: nextQuoteNumber([], now),
    createdAt,
    clientName: 'Cliente Exemplo',
    items: [
      { id: 'exemplo-linha-1', description: 'Corte e barba', priceCents: 1800 },
      { id: 'exemplo-linha-2', description: 'Corte de cabelo', priceCents: 1200 },
    ],
    deadline: 'Até ao fim do mês',
    notes: 'Orçamento fictício, só para exemplo.',
    vatNote: 'incluido',
    isExample: true,
  }];

  return { business, posts, calendar, quotes };
}
