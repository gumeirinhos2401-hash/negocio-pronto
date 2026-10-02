import { formatEuros } from './money';
import type { BusinessProfile, ReplyTopic } from './types';
import { isHttpUrl } from './validation';

export const REPLY_TOPICS: { topic: ReplyTopic; label: string }[] = [
  { topic: 'precos', label: 'Preços' },
  { topic: 'horarios', label: 'Horários' },
  { topic: 'localizacao', label: 'Localização' },
  { topic: 'reservas', label: 'Reservas' },
  { topic: 'atrasos', label: 'Atrasos' },
  { topic: 'cancelamentos', label: 'Cancelamentos' },
  { topic: 'reclamacoes', label: 'Reclamações' },
];

const clean = (text: string) => text.trim().replace(/\s+/g, ' ');
const withoutFinalStop = (text: string) => text.replace(/[.\s]+$/, '');

interface Draft { lines: string[]; missing: string[] }

// Each builder adds a sentence only when the profile field behind it is filled in;
// otherwise the field label goes into `missing` and the sentence is left out.
const BUILDERS: Record<ReplyTopic, (b: BusinessProfile, d: Draft) => void> = {
  precos(b, d) {
    const priced = b.services.filter((s) => s.priceCents !== null && clean(s.name));
    if (priced.length > 0) {
      d.lines.push('Olá! Obrigado pelo contacto. Estes são os nossos preços:');
      for (const s of priced) d.lines.push(`- ${clean(s.name)}: ${formatEuros(s.priceCents as number)}`);
      d.lines.push('Se procura outro serviço, diga-nos qual e indicamos o valor.');
    } else {
      d.missing.push('Serviços com preço');
      d.lines.push('Olá! Obrigado pelo contacto. Os preços dependem do serviço.');
      d.lines.push('Diga-nos o que procura e indicamos o valor.');
    }
  },
  horarios(b, d) {
    const hours = withoutFinalStop(clean(b.hours));
    if (hours) {
      d.lines.push(`Olá! O nosso horário é: ${hours}.`);
      d.lines.push('Se tiver alguma dúvida, é só dizer.');
    } else {
      d.missing.push('Horário');
      d.lines.push('Olá! Diga-nos em que dia e a que horas gostaria de vir e confirmamos se estamos abertos.');
    }
  },
  localizacao(b, d) {
    const address = withoutFinalStop(clean(b.address));
    const city = withoutFinalStop(clean(b.city));
    if (!address) d.missing.push('Morada');
    if (!city) d.missing.push('Cidade');
    const place = [address, city].filter(Boolean).join(', ');
    if (place) d.lines.push(`Olá! Estamos em ${place}.`);
    else d.lines.push('Olá! Obrigado pelo contacto.');
    d.lines.push('Diga-nos de onde vem e explicamos como chegar.');
  },
  reservas(b, d) {
    const link = b.bookingLink.trim();
    const phone = clean(b.phone);
    const hasLink = link !== '' && isHttpUrl(link);
    if (!hasLink) d.missing.push('Link de marcação');
    if (!phone) d.missing.push('Telefone');
    d.lines.push('Olá! Obrigado pelo interesse.');
    if (hasLink) d.lines.push(`Pode fazer a sua marcação aqui: ${link}`);
    if (phone) d.lines.push(hasLink ? `Se preferir, ligue para o ${phone}.` : `Para marcar, ligue para o ${phone}.`);
    if (!hasLink) {
      d.lines.push(phone
        ? 'Também pode dizer-nos por aqui o dia e a hora que prefere e confirmamos a disponibilidade.'
        : 'Diga-nos o dia e a hora que prefere e confirmamos a disponibilidade.');
    }
  },
  atrasos(b, d) {
    const phone = clean(b.phone);
    d.lines.push('Olá! Obrigado por avisar.');
    d.lines.push('Diga-nos, por favor, a que horas conta chegar, para vermos se conseguimos manter a marcação.');
    if (phone) d.lines.push(`Se for mais fácil, ligue para o ${phone}.`);
    else d.missing.push('Telefone');
  },
  cancelamentos(b, d) {
    const link = b.bookingLink.trim();
    d.lines.push('Olá! Obrigado por avisar.');
    d.lines.push('Se quiser marcar para outro dia, diga-nos qual lhe dá mais jeito.');
    if (link && isHttpUrl(link)) d.lines.push(`Também pode escolher nova data aqui: ${link}`);
    else d.missing.push('Link de marcação');
  },
  reclamacoes(b, d) {
    const phone = clean(b.phone);
    d.lines.push('Olá. Lamentamos que a experiência não tenha corrido como esperava.');
    d.lines.push('Pode contar-nos o que aconteceu, indicando o dia e o serviço em causa? Queremos perceber bem a situação antes de lhe responder.');
    if (phone) d.lines.push(`Se preferir falar connosco, ligue para o ${phone}.`);
    else d.missing.push('Telefone');
  },
};

export function buildReply(topic: ReplyTopic, business: BusinessProfile): { text: string; missing: string[] } {
  const draft: Draft = { lines: [], missing: [] };
  BUILDERS[topic](business, draft);
  const name = clean(business.name);
  if (name) draft.lines.push(name);
  else draft.missing.push('Nome do negócio');
  return { text: draft.lines.join('\n'), missing: draft.missing };
}
