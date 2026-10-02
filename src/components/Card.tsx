import type { ReactNode } from 'react';
import './Card.css';

interface CardProps {
  as?: 'div' | 'section' | 'article' | 'li';
  className?: string;
  children: ReactNode;
}

// A surface for things that are objects in their own right, such as a generated post.
export function Card({ as: Element = 'div', className, children }: CardProps) {
  return <Element className={['cartao', className].filter(Boolean).join(' ')}>{children}</Element>;
}
