import type { ReactNode } from 'react';
import { Card } from '@/components/Card';

export const metadata = { title: 'How it works' };

const REPO = 'https://github.com/lixfeyzen/manifest';

// The webhook-to-fulfilled pipeline, in order.
const STEPS = [
  {
    n: '1',
    title: 'Payment webhook arrives',
    body: 'The payment provider posts to the webhook endpoint. Its HMAC signature is verified against the raw body before anything else runs, so a forged call is rejected up front.',
  },
  {
    n: '2',
    title: 'Order paid, job queued',
    body: 'In a single transaction the order is marked Paid and a fulfillment job is placed on the queue. The webhook returns immediately; the slow work happens out of band.',
  },
  {
    n: '3',
    title: 'Worker fulfills',
    body: 'A separate worker process reserves stock with one atomic, conditional update (it can never go negative), then issues the invoice. Every step is safe to retry.',
  },
  {
    n: '4',
    title: 'Fulfilled',
    body: 'The order reaches Fulfilled and the invoice number is recorded. Each stage also writes an entry to the order timeline, so the whole history stays auditable.',
  },
];

// The reliability guarantees, stated as problem then mechanism (all implemented).
const GUARANTEES = [
  {
    title: 'Idempotent webhooks',
    problem: 'Providers retry, so the same payment can arrive more than once.',
    how: 'A processed-event record with a unique constraint turns the duplicate into a no-op. One invoice, never two.',
  },
  {
    title: 'No oversold stock',
    problem: 'Two orders can race for the last unit in inventory.',
    how: 'Stock is decremented only when enough remains, in one conditional update, so the database itself prevents going negative.',
  },
  {
    title: 'Self-healing',
    problem: 'A worker can crash mid-fulfillment and leave an order stuck.',
    how: 'A reconciliation sweep periodically re-queues orders that have been paid or fulfilling for too long, so nothing is lost.',
  },
  {
    title: 'Signed webhooks',
    problem: 'A public endpoint can be hit by forged requests.',
    how: 'Every webhook is authenticated with an HMAC signature over the raw body; without the shared secret it cannot be forged.',
  },
];

const STACK = [
  'Next.js (App Router)',
  'Fastify + GraphQL',
  'BullMQ + Redis',
  'Prisma + PostgreSQL',
  'TypeScript',
  'Vitest + Playwright',
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-ink">How it works</h1>
        <p className="mt-2 max-w-prose text-sm text-brand-muted">
          Manifest turns a payment webhook into a fulfilled order. The hard part is not the happy
          path; it is staying correct when events arrive twice, stock runs out, or a worker dies.
          Here is the design.
        </p>
      </header>

      <section>
        <Eyebrow>The pipeline</Eyebrow>
        <ol className="mt-4 space-y-3">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-primary-soft font-mono text-xs font-semibold text-brand-primary">
                {s.n}
              </span>
              <div>
                <p className="text-sm font-medium text-brand-ink">{s.title}</p>
                <p className="mt-0.5 max-w-prose text-sm text-brand-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <Eyebrow>Built for correctness under failure</Eyebrow>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {GUARANTEES.map((g) => (
            <Card key={g.title} className="p-4">
              <p className="text-sm font-semibold text-brand-ink">{g.title}</p>
              <p className="mt-1.5 text-xs text-brand-muted">{g.problem}</p>
              <p className="mt-2 text-xs text-brand-ink">{g.how}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <Eyebrow>Stack</Eyebrow>
        <div className="mt-4 flex flex-wrap gap-2">
          {STACK.map((t) => (
            <span
              key={t}
              className="rounded-full border border-brand-border bg-brand-surface px-3 py-1 text-xs text-brand-muted"
            >
              {t}
            </span>
          ))}
        </div>
      </section>

      <a
        href={REPO}
        target="_blank"
        rel="noreferrer"
        className="inline-flex text-sm font-medium text-brand-primary transition-colors hover:text-brand-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
      >
        View the source on GitHub
      </a>
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
      {children}
    </p>
  );
}
