import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';

// Shared form-field primitives so input styling and focus treatment can't drift
// (and aren't copy-pasted per page). Focus uses the SAME focus-visible outline as
// Button, so keyboard focus is one consistent system across the app.
const FIELD =
  'rounded-md border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-ink transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:opacity-60';

export function Label({
  className = '',
  children,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement> & { children: ReactNode }) {
  return (
    <label className={`block text-sm font-medium text-brand-ink ${className}`} {...props}>
      {children}
    </label>
  );
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${FIELD} ${className}`} {...props} />;
}

export function Select({
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select className={`${FIELD} ${className}`} {...props}>
      {children}
    </select>
  );
}
