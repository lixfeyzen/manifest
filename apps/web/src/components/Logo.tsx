/**
 * Manifest logomark: an abstract "ascending flow" (two stacked chevrons): an
 * order moving forward through the pipeline to fulfilled. Geometric, scalable,
 * and not a letter-in-a-box. Uses currentColor so callers set the tint.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 19 L16 9 L26 19"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 25 L16 19 L22 25"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.4"
      />
    </svg>
  );
}

/** Logomark + "Manifest" wordmark, used in the sidebar / auth screens. */
export function Wordmark({ className = '', subtitle }: { className?: string; subtitle?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <Logo className="h-7 w-7 shrink-0 text-brand-primary" />
      <span className="leading-tight">
        <span className="block text-sm font-semibold tracking-tight text-brand-ink">Manifest</span>
        {subtitle && <span className="block text-[11px] text-brand-muted">{subtitle}</span>}
      </span>
    </span>
  );
}
