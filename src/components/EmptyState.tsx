import { Button, ButtonLink } from './Button';
import './EmptyState.css';

export type EmptyStateAction = { label: string; onClick: () => void } | { label: string; to: string };

interface EmptyStateProps {
  title: string;
  text: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
}

function ActionButton({ action, primary }: { action: EmptyStateAction; primary: boolean }) {
  const variant = primary ? 'primary' : 'secondary';
  if ('to' in action) return <ButtonLink to={action.to} variant={variant}>{action.label}</ButtonLink>;
  return <Button variant={variant} onClick={action.onClick}>{action.label}</Button>;
}

export function EmptyState({ title, text, action, secondaryAction }: EmptyStateProps) {
  return (
    <div className="vazio">
      <h2 className="vazio__titulo">{title}</h2>
      <p className="vazio__texto">{text}</p>
      {(action || secondaryAction) && (
        <div className="vazio__acoes">
          {action && <ActionButton action={action} primary />}
          {secondaryAction && <ActionButton action={secondaryAction} primary={false} />}
        </div>
      )}
    </div>
  );
}
