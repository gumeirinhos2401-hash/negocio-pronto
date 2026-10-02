import type { HTMLAttributes, HTMLInputTypeAttribute } from 'react';
import './Field.css';

export interface FieldMessagesProps {
  id: string;
  error?: string;
  hint?: string;
}

// Ids of the hint and error elements, in the order a screen reader should read them.
export function describedBy({ id, error, hint }: FieldMessagesProps): string | undefined {
  const ids = [hint ? `${id}-ajuda` : '', error ? `${id}-erro` : ''].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

export function FieldLabel({ id, label, required }: { id: string; label: string; required?: boolean }) {
  return (
    <div className="campo__rotulo">
      <label htmlFor={id}>{label}</label>
      {required && <span className="campo__obrigatorio">obrigatório</span>}
    </div>
  );
}

export function FieldMessages({ id, error, hint }: FieldMessagesProps) {
  return (
    <>
      {hint && <p className="campo__ajuda" id={`${id}-ajuda`}>{hint}</p>}
      {error && <p className="campo__erro" id={`${id}-erro`} role="alert">{error}</p>}
    </>
  );
}

interface FieldProps {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  type?: HTMLInputTypeAttribute;
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
  required?: boolean;
  autoComplete?: string;
  maxLength?: number;
}

export function Field({ label, id, value, onChange, error, hint, type = 'text', inputMode, required, autoComplete, maxLength }: FieldProps) {
  return (
    <div className="campo">
      <FieldLabel id={id} label={label} required={required} />
      <input
        className="campo__controlo"
        id={id}
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete ?? 'off'}
        maxLength={maxLength}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy({ id, error, hint })}
      />
      <FieldMessages id={id} error={error} hint={hint} />
    </div>
  );
}
