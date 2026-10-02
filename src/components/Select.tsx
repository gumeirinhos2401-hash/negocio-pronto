import { describedBy, FieldLabel, FieldMessages } from './Field';
import './Field.css';

interface SelectProps<V extends string> {
  label: string;
  id: string;
  value: V;
  onChange: (value: V) => void;
  options: { value: V; label: string }[];
  error?: string;
  hint?: string;
}

export function Select<V extends string>({ label, id, value, onChange, options, error, hint }: SelectProps<V>) {
  return (
    <div className="campo">
      <FieldLabel id={id} label={label} />
      <select
        className="campo__controlo"
        id={id}
        value={value}
        onChange={(event) => {
          // Only values from the option list are passed on.
          const chosen = options.find((option) => option.value === event.target.value);
          if (chosen) onChange(chosen.value);
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy({ id, error, hint })}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <FieldMessages id={id} error={error} hint={hint} />
    </div>
  );
}
