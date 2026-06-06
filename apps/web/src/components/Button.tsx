import type { ButtonHTMLAttributes, ReactNode } from 'react';

// One canonical button treatment so radius / padding / focus never drift between
// pages. `Button` is for real <button>s; `buttonStyles` is for <Link>s that should
// look like a button.
type Variant = 'primary' | 'secondary';

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-brand-primary text-white hover:bg-brand-primary-dark focus-visible:outline-brand-primary',
  secondary:
    'border border-brand-border bg-brand-surface text-brand-ink hover:border-brand-chalice hover:bg-brand-surface-2 focus-visible:outline-brand-primary',
};

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export function buttonStyles(variant: Variant = 'primary', className = ''): string {
  return `${BASE} ${VARIANT[variant]} ${className}`.trim();
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button className={buttonStyles(variant, className)} {...props}>
      {children}
    </button>
  );
}
