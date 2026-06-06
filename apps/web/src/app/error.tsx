'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/Button';

// Route-level error boundary. Any uncaught error in a page or client island lands
// here on a branded, recoverable screen instead of the framework default.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log for debugging; a production app would forward this to error monitoring.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-brand-ink">Something broke</h1>
      <p className="mt-2 text-sm text-brand-muted">
        Manifest hit an unexpected error rendering this view. Trying again usually clears it.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link href="/" className="text-sm text-brand-muted transition-colors hover:text-brand-ink">
          Back to dashboard
        </Link>
      </div>
      {error.digest && (
        <p className="mt-4 font-mono text-xs text-brand-muted">ref: {error.digest}</p>
      )}
    </div>
  );
}
