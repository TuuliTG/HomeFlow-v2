import type { ReactNode } from 'react';

interface ComingSoonProps {
  children: ReactNode;
}

/** Placeholder card for screens whose feature has not been built yet. */
export function ComingSoon({ children }: ComingSoonProps) {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
      {children}
    </section>
  );
}
