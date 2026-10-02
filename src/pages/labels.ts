import type { CalendarCategory, CalendarStatus, Channel, Goal, Tone, VatNote } from '../domain/types';

// Interface names for the fixed option lists in the data model.

export const CHANNEL_LABELS: Record<Channel, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  google: 'Perfil da Empresa no Google',
};

export const GOAL_LABELS: Record<Goal, string> = {
  'divulgar-servico': 'Divulgar um serviço',
  'atrair-clientes': 'Atrair novos clientes',
  'lembrar-marcacoes': 'Lembrar as marcações',
  informar: 'Dar uma informação',
  agradecer: 'Agradecer aos clientes',
};

export const TONE_LABELS: Record<Tone, string> = {
  proximo: 'Próximo',
  profissional: 'Profissional',
  descontraido: 'Descontraído',
};

export const CATEGORY_LABELS: Record<CalendarCategory, string> = {
  promocao: 'Promoção',
  servico: 'Serviço',
  bastidores: 'Bastidores',
  testemunho: 'Testemunho',
  informacao: 'Informação',
  'data-especial': 'Data especial',
};

export const STATUS_LABELS: Record<CalendarStatus, string> = {
  planeada: 'Planeada',
  publicada: 'Publicada',
  cancelada: 'Cancelada',
};

export const VAT_LABELS: Record<VatNote, string> = {
  nenhuma: 'Sem nota sobre o IVA',
  incluido: 'IVA incluído nos valores',
  'nao-incluido': 'IVA não incluído nos valores',
};

export function toOptions<V extends string>(labels: Record<V, string>): { value: V; label: string }[] {
  return (Object.keys(labels) as V[]).map((value) => ({ value, label: labels[value] }));
}
