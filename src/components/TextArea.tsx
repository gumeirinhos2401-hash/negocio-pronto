import { describedBy, FieldLabel, FieldMessages } from './Field';
import './Field.css';

interface TextAreaProps {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  rows?: number;
  maxLength?: number;
}

export function TextArea({ label, id, value, onChange, error, hint, rows = 4, maxLength }: TextAreaProps) {
  return (
    <div className="campo">
      <FieldLabel id={id} label={label} />
      <textarea
        className="campo__controlo"
        id={id}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy({ id, error, hint })}
      />
      <FieldMessages id={id} error={error} hint={hint} />
    </div>
  );
}
