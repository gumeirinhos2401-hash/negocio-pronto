import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'botao--primario',
  secondary: 'botao--secundario',
  quiet: 'botao--discreto',
  danger: 'botao--perigo',
};

function classes(variant: ButtonVariant, extra?: string): string {
  return ['botao', VARIANT_CLASS[variant], extra].filter(Boolean).join(' ');
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ variant = 'secondary', type = 'button', className, ...rest }: ButtonProps) {
  return <button type={type} className={classes(variant, className)} {...rest} />;
}

interface ButtonLinkProps {
  to: string;
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
}

// A route link that looks like a button, for actions that only change page.
export function ButtonLink({ to, variant = 'secondary', className, children }: ButtonLinkProps) {
  return <Link to={to} className={classes(variant, className)}>{children}</Link>;
}
