import type { BusinessProfile, Goal, Post, PostInput, Tone } from './types';
import { isHttpUrl } from './validation';

interface Template { title: (s: string) => string; lines: (s: string) => [string, string] }

// Every template opens with the service so the user's own wording keeps its
// capitalisation. Templates carry no numbers, prices or claims about results.
const TEMPLATES: Record<Goal, Record<Tone, Template>> = {
  'divulgar-servico': {
    proximo: {
      title: (s) => `${s}: é connosco`,
      lines: (s) => [`${s} é um dos serviços que fazemos cá em casa.`, 'Se quiser saber como funciona, fale connosco.'],
    },
    profissional: {
      title: (s) => `${s}: serviço disponível`,
      lines: (s) => [`${s} faz parte dos serviços que prestamos.`, 'Estamos disponíveis para esclarecer qualquer dúvida.'],
    },
    descontraido: {
      title: (s) => `${s}? Tratamos disso`,
      lines: (s) => [`${s} é connosco.`, 'Apareçam ou mandem mensagem, que nós explicamos tudo.'],
    },
  },
  'atrair-clientes': {
    proximo: {
      title: (s) => `${s}: venha conhecer-nos`,
      lines: (s) => [`${s} é uma boa razão para nos fazer uma visita.`, 'Gostamos de receber quem ainda não nos conhece.'],
    },
    profissional: {
      title: (s) => `${s}: novos clientes são bem-vindos`,
      lines: (s) => [`${s} está disponível para novos clientes.`, 'Teremos todo o gosto em explicar como trabalhamos.'],
    },
    descontraido: {
      title: (s) => `${s}: ainda não nos conhece?`,
      lines: (s) => [`${s} também é para quem nunca cá veio.`, 'Apareçam, gostamos de caras novas.'],
    },
  },
  'lembrar-marcacoes': {
    proximo: {
      title: (s) => `${s}: não deixe para a última hora`,
      lines: (s) => [`${s} corre melhor com marcação.`, 'Marcando cedo, é mais fácil encontrar um horário que lhe dê jeito.'],
    },
    profissional: {
      title: (s) => `${s}: lembrete de marcação`,
      lines: (s) => [`${s} é feito por marcação.`, 'Recomendamos que marque com antecedência.'],
    },
    descontraido: {
      title: (s) => `${s}: já marcou?`,
      lines: (s) => [`${s} é melhor com marcação.`, 'Não deixem para a última hora.'],
    },
  },
  informar: {
    proximo: {
      title: (s) => `${s}: o que convém saber`,
      lines: (s) => [`${s} levanta sempre algumas perguntas, e nós gostamos de responder.`, 'Se tiver alguma dúvida, pergunte à vontade.'],
    },
    profissional: {
      title: (s) => `${s}: informação útil`,
      lines: (s) => [`${s}: deixamos aqui uma nota para quem procura este serviço.`, 'Para mais informações, contacte-nos.'],
    },
    descontraido: {
      title: (s) => `${s}: dúvidas?`,
      lines: (s) => [`${s} tem que se lhe diga.`, 'Perguntem o que quiserem, nós respondemos.'],
    },
  },
  agradecer: {
    proximo: {
      title: (s) => `${s}: obrigado pela confiança`,
      lines: (s) => [`${s} é feito a pensar em quem nos visita.`, 'O nosso obrigado a quem passa por cá.'],
    },
    profissional: {
      title: (s) => `${s}: agradecemos a preferência`,
      lines: (s) => [`${s}: agradecemos a todos os que nos escolhem.`, 'Contamos continuar a merecer a sua confiança.'],
    },
    descontraido: {
      title: (s) => `${s}: obrigado a todos`,
      lines: (s) => [`${s} sem clientes não tinha piada nenhuma.`, 'Obrigado por aparecerem.'],
    },
  },
};

const GENERIC_TAGS = ['comerciolocal', 'negociolocal', 'comerciodeproximidade', 'pequenosnegocios', 'portugal'];
const GOOGLE_MAX_LENGTH = 1500;

const clean = (text: string) => text.trim().replace(/\s+/g, ' ');

// Ends a sentence with a full stop unless the user's text already closes it.
const sentence = (text: string) => (/[.!?…]$/.test(text) ? text : `${text}.`);

function slug(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function buildHashtags(service: string, business: BusinessProfile): string[] {
  const category = clean(business.category);
  const city = clean(business.city);
  const words = service.split(' ').filter((word) => word.length > 3);
  const specific = [service, category, city, category && city ? category + city : '', service && city ? service + city : '', ...words]
    .map(slug)
    .filter((tag) => tag.length > 1 && tag.length <= 30);
  const tags = [...new Set(specific)].slice(0, 8);
  // Neutral tags fill the list only when the profile gives too few of its own.
  for (const tag of GENERIC_TAGS) {
    if (tags.length >= 6) break;
    if (!tags.includes(tag)) tags.push(tag);
  }
  return tags.map((tag) => `#${tag}`);
}

function signature(business: BusinessProfile): string {
  const name = clean(business.name);
  const city = clean(business.city);
  if (name && city) return sentence(`${name}, ${city}`);
  if (name) return sentence(name);
  if (city) return sentence(`Estamos em ${city}`);
  return '';
}

function callToAction(business: BusinessProfile): string {
  const link = business.bookingLink.trim();
  const phone = clean(business.phone);
  // No full stop after a link or a number, so copying it never picks up stray punctuation.
  if (link && isHttpUrl(link)) return `Faça a sua marcação em ${link}`;
  if (phone) return `Ligue-nos ou envie mensagem para o ${phone}`;
  return 'Envie-nos mensagem para saber mais.';
}

export function generatePost(input: PostInput, business: BusinessProfile): Pick<Post, 'title' | 'caption' | 'cta' | 'hashtags'> {
  const typedService = clean(input.service);
  const service = typedService || 'O nosso serviço';
  const audience = clean(input.audience);
  const template = TEMPLATES[input.goal][input.tone];
  const [opening, followUp] = template.lines(service);
  const audienceLine = audience ? sentence(`A pensar em ${audience}`) : '';
  const cta = callToAction(business);
  const title = template.title(service);

  if (input.channel === 'google') {
    // Google Business Profile updates are short and carry no hashtags.
    const text = [opening, followUp, audienceLine].filter(Boolean).join(' ');
    const caption = text.length > GOOGLE_MAX_LENGTH ? `${text.slice(0, GOOGLE_MAX_LENGTH - 1).trimEnd()}…` : text;
    return { title, caption, cta, hashtags: [] };
  }

  const lines = [opening, followUp, audienceLine, signature(business)].filter(Boolean);
  if (input.channel === 'facebook') {
    return { title, caption: lines.join(' '), cta, hashtags: [] };
  }
  return { title, caption: lines.join('\n\n'), cta, hashtags: buildHashtags(typedService, business) };
}
