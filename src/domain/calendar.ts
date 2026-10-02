import { daysInMonth, isoDate, mondayIndex } from './dates';
import type { BusinessProfile, CalendarCategory, CalendarEntry } from './types';

const MAX_PER_WEEK = 3;
// Tuesday, Thursday and Saturday, as Monday-first weekday indexes.
const PREFERRED_WEEKDAYS = [1, 3, 5];

// Fixed-date occasions in Portugal, keyed by "month-day" (month is 1 to 12).
const OCCASIONS: Record<string, string> = {
  '1-1': 'Ano Novo',
  '2-14': 'Dia dos Namorados',
  '3-19': 'Dia do Pai',
  '4-25': 'Dia da Liberdade',
  '5-1': 'Dia do Trabalhador',
  '6-10': 'Dia de Portugal',
  '11-1': 'Dia de Todos os Santos',
  '12-25': 'Natal',
};

type RegularCategory = Exclude<CalendarCategory, 'data-especial'>;
const ROTATION: RegularCategory[] = ['servico', 'bastidores', 'informacao', 'testemunho', 'promocao'];

// Titles are prompts for the owner, never statements about the business.
const PROMPTS: Record<RegularCategory, string[]> = {
  servico: ['Apresentar um dos seus serviços', 'Explicar passo a passo como funciona um serviço'],
  bastidores: ['Mostrar os bastidores de um dia de trabalho', 'Apresentar quem atende os clientes', 'Mostrar o espaço e como se prepara o dia'],
  informacao: ['Lembrar o horário de funcionamento', 'Explicar como fazer uma marcação', 'Dizer onde fica e como chegar'],
  testemunho: ['Pedir a um cliente autorização para partilhar a sua opinião', 'Partilhar uma opinião real de um cliente, com autorização'],
  promocao: ['Anunciar uma promoção, se tiver alguma a decorrer', 'Divulgar uma campanha sua, com as condições reais'],
};

function occasionName(year: number, month0: number, day: number): string | null {
  // Dia da Mãe is the first Sunday of May.
  if (month0 === 4 && day <= 7 && new Date(year, month0, day).getDay() === 0) return 'Dia da Mãe';
  return OCCASIONS[`${month0 + 1}-${day}`] ?? null;
}

export function suggestMonth(year: number, month0: number, business: BusinessProfile): Omit<CalendarEntry, 'id'>[] {
  const serviceNames = business.services.map((s) => s.name.trim()).filter(Boolean);
  const used: Record<RegularCategory, number> = { servico: 0, bastidores: 0, informacao: 0, testemunho: 0, promocao: 0 };
  let rotation = 0;

  const regularTitle = (category: RegularCategory): string => {
    const count = used[category]++;
    if (category === 'servico' && serviceNames.length > 0) {
      return `Apresentar o serviço: ${serviceNames[count % serviceNames.length]}`;
    }
    return PROMPTS[category][count % PROMPTS[category].length];
  };

  // Group the days of the month into Monday-first weeks.
  const weeks: number[][] = [];
  for (let day = 1; day <= daysInMonth(year, month0); day++) {
    if (weeks.length === 0 || mondayIndex(new Date(year, month0, day)) === 0) weeks.push([]);
    weeks[weeks.length - 1].push(day);
  }

  const entries: Omit<CalendarEntry, 'id'>[] = [];
  const add = (day: number, category: CalendarCategory, title: string) =>
    entries.push({ date: isoDate(new Date(year, month0, day)), category, title, status: 'planeada', postId: null, isExample: false });

  for (const week of weeks) {
    const special = week.filter((day) => occasionName(year, month0, day) !== null).slice(0, MAX_PER_WEEK);
    const regular = week
      .filter((day) => !special.includes(day) && PREFERRED_WEEKDAYS.includes(mondayIndex(new Date(year, month0, day))))
      .slice(0, MAX_PER_WEEK - special.length);
    for (const day of [...special, ...regular].sort((a, b) => a - b)) {
      const occasion = special.includes(day) ? occasionName(year, month0, day) : null;
      if (occasion) {
        add(day, 'data-especial', `${occasion}: assinalar a data com uma publicação`);
      } else {
        const category = ROTATION[rotation++ % ROTATION.length];
        add(day, category, regularTitle(category));
      }
    }
  }
  return entries;
}
