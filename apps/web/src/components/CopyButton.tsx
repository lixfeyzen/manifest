'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

/** Small inline "copy to clipboard" affordance with transient confirmation. */
export function CopyButton({ value, ariaLabel = 'Copy' }: { value: string; ariaLabel?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* clipboard unavailable — no-op */
        }
      }}
      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-brand-muted transition-colors hover:bg-brand-bg hover:text-brand-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-primary"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
