import { CalendarDays, Ellipsis, House, MessageSquareText, PenLine, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
}

// Desktop top bar: every page, as text.
export const TOP_NAV: NavItem[] = [
  { to: '/painel', label: 'Painel' },
  { to: '/publicacoes', label: 'Publicações' },
  { to: '/calendario', label: 'Calendário' },
  { to: '/respostas', label: 'Respostas' },
  { to: '/orcamentos', label: 'Orçamentos' },
  { to: '/definicoes', label: 'Definições' },
  { to: '/planos', label: 'Planos' },
];

// Mobile bottom bar: exactly five items. The rest sits under "Mais".
export const BOTTOM_NAV: (NavItem & { icon: LucideIcon })[] = [
  { to: '/painel', label: 'Painel', icon: House },
  { to: '/publicacoes', label: 'Publicações', icon: PenLine },
  { to: '/calendario', label: 'Calendário', icon: CalendarDays },
  { to: '/respostas', label: 'Respostas', icon: MessageSquareText },
  { to: '/mais', label: 'Mais', icon: Ellipsis },
];

// Pages reached through "Mais" on mobile.
export const MORE_ROUTES = ['/orcamentos', '/definicoes', '/planos'];
