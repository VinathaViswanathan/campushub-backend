import styles from './FormField.module.css';

export interface FormFieldProps {
  id: string;
  label: string;
  type: 'date' | 'time';
  value: string;
  onChange: (value: string) => void;
  /** Validation message shown under the input and linked with aria-describedby. */
  error?: string;
  disabled?: boolean;
  min?: string;
  step?: number;
}

/** A labelled input with its validation message. */
export function FormField({ id, label, type, value, onChange, error, disabled, min, step }: FormFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        min={min}
        step={step}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error !== undefined}
        aria-describedby={error ? errorId : undefined}
        disabled={disabled}
      />
      {error && (
        <p id={errorId} className={styles.fieldError}>
          {error}
        </p>
      )}
    </div>
  );
}
