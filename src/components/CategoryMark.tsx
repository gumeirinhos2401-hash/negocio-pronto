import type { ReactNode } from 'react';
import type { CalendarCategory } from '../domain/types';
import './CategoryMark.css';

// Each category has its own shape, so it can be told apart without relying on color.
const SHAPES: Record<CalendarCategory, ReactNode> = {
  promocao: <circle cx="6" cy="6" r="5" />,
  servico: <rect x="1.5" y="1.5" width="9" height="9" />,
  bastidores: <path fillRule="evenodd" d="M6 1a5 5 0 1 0 0 10A5 5 0 0 0 6 1Zm0 2.6a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8Z" />,
  testemunho: <path d="M6 0.5 11.5 6 6 11.5 0.5 6Z" />,
  informacao: <path d="M6 1 11.5 11H0.5Z" />,
  'data-especial': <path d="M6 0C6.6 3.6 8.4 5.4 12 6 8.4 6.6 6.6 8.4 6 12 5.4 8.4 3.6 6.6 0 6 3.6 5.4 5.4 3.6 6 0Z" />,
};

export function CategoryMark({ category }: { category: CalendarCategory }) {
  return (
    <svg className="marca-categoria" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
      {SHAPES[category]}
    </svg>
  );
}
