import type { ReactNode } from 'react';
import './Tag.css';

export type TagTone = 'neutral' | 'accent' | 'success' | 'muted';

const TONE_CLASS: Record<TagTone, string> = {
  neutral: 'etiqueta--neutra',
  accent: 'etiqueta--destaque',
  success: 'etiqueta--sucesso',
  muted: 'etiqueta--apagada',
};

export function Tag({ tone = 'neutral', children }: { tone?: TagTone; children: ReactNode }) {
  return <span className={`etiqueta ${TONE_CLASS[tone]}`}>{children}</span>;
}
