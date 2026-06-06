import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p className="font-mono text-sm font-medium text-brand-muted">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand-ink">Page not found</h1>
      <p className="mt-2 text-sm text-brand-muted">
        The page or order you are looking for does not exist, or it may have been removed.
      </p>
      <Link
        href="/orders"
        className="mt-6 inline-flex items-center rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
      >
        Back to orders
      </Link>
    </div>
  );
}
