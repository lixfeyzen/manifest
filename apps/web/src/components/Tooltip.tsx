'use client';

import { type ReactElement, cloneElement, isValidElement, useId } from 'react';

/**
 * Lightweight CSS tooltip: shows on hover and keyboard focus. The label is
 * associated with the trigger via aria-describedby so assistive tech announces
 * it (WAI-ARIA tooltip pattern). No dependency.
 */
export function Tooltip({ label, children }: { label: string; children: ReactElement }) {
  const id = useId();
  const child = isValidElement(children)
    ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, {
        'aria-describedby': id,
      })
    : children;

  return (
    <span className="group/tt relative inline-flex">
      {child}
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-brand-ink px-2 py-1 text-xs font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover/tt:opacity-100 group-focus-within/tt:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}
