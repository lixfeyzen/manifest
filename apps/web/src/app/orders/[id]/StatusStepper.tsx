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
 * Horizontal lifecycle stepper. Shows how far an order has progressed; a FAILED
 * order is rendered as a failure at the fulfilling step.
 */
export function StatusStepper({ status }: { status: OrderStatus }) {
  const failed = status === 'FAILED';
  const currentIdx = failed ? 2 : ORDER.indexOf(status);

  return (
    <ol className="flex items-center">
      {STEPS.map((step, i) => {
        const done = !failed && i <= currentIdx;
        const doneBeforeFail = failed && i < currentIdx;
        const failedHere = failed && i === currentIdx;
        const isComplete = done || doneBeforeFail;

        const circle = failedHere
          ? 'bg-red-500 text-white'
          : isComplete
            ? 'bg-brand-primary text-white'
            : 'bg-brand-bg text-brand-muted ring-1 ring-inset ring-brand-border';

        return (
          <li key={step.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${circle}`}
              >
                {failedHere ? (
                  <X className="h-4 w-4" />
                ) : isComplete ? (
                  <Check className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={`text-xs font-medium ${
                  failedHere
                    ? 'text-red-600'
                    : isComplete
                      ? 'text-brand-ink'
                      : 'text-brand-muted'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                className={`mx-2 mb-5 h-0.5 flex-1 rounded ${
                  i < currentIdx && !failedHere ? 'bg-brand-primary' : 'bg-brand-border'
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
