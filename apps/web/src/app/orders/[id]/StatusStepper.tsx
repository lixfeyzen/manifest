'use client';

import { Check, X } from 'lucide-react';
import type { OrderStatus } from '@/lib/types';

const STEPS = [
  { key: 'PENDING', label: 'Created' },
  { key: 'PAID', label: 'Paid' },
  { key: 'FULFILLING', label: 'Fulfilling' },
  { key: 'FULFILLED', label: 'Fulfilled' },
] as const;

const ORDER = ['PENDING', 'PAID', 'FULFILLING', 'FULFILLED'];

/**
 * Horizontal lifecycle stepper. Connector fill sweeps and check icons pop; the
 * `key={status}` makes a real advance (e.g. PAID→FULFILLING) replay just the new
 * segment — a live transition moment, not noise. Static under reduced motion.
 */
export function StatusStepper({ status }: { status: OrderStatus }) {
  const failed = status === 'FAILED';
  const currentIdx = failed ? 2 : ORDER.indexOf(status);

  return (
    <ol key={status} className="flex items-center">
      {STEPS.map((step, i) => {
        const done = !failed && i <= currentIdx;
        const doneBeforeFail = failed && i < currentIdx;
        const failedHere = failed && i === currentIdx;
        const isComplete = done || doneBeforeFail;
        const isCurrent = !failed && i === currentIdx && status !== 'FULFILLED';

        const circle = failedHere
          ? 'bg-red-500 text-white'
          : isComplete
            ? 'bg-brand-primary text-white'
            : `bg-brand-bg text-brand-muted ring-1 ring-inset ring-brand-border ${
                isCurrent ? 'ring-2 ring-brand-primary/30' : ''
              }`;

        const connectorFilled = i < currentIdx && !failedHere;

        return (
          <li key={step.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${circle}`}
              >
                {failedHere ? (
                  <X className="mf-pop h-4 w-4" />
                ) : isComplete ? (
                  <Check className="mf-pop h-4 w-4" />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={`text-xs font-medium ${
                  failedHere ? 'text-red-600' : isComplete ? 'text-brand-ink' : 'text-brand-muted'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span className="relative mx-2 mb-5 h-0.5 flex-1 overflow-hidden rounded bg-brand-border">
                <span
                  className={`absolute inset-0 origin-left rounded bg-brand-primary transition-transform duration-200 ease-[var(--ease-out)] ${
                    connectorFilled ? 'scale-x-100' : 'scale-x-0'
                  }`}
                  style={{ transitionDelay: `${i * 80}ms` }}
                />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
