import { Link } from 'react-router';

import { PlusIcon } from '@/components/ui/icons';

interface AddLinkProps {
  to: string;
  /** What it adds, e.g. "New task": the link's accessible name and tooltip. */
  label: string;
}

/** A round plus button that opens a form to add something, beside a page title. */
export function AddLink({ to, label }: AddLinkProps) {
  return (
    <Link
      to={to}
      aria-label={label}
      title={label}
      className="bg-brand-700 hover:bg-brand-900 flex size-11 shrink-0 items-center justify-center rounded-full text-white"
    >
      <PlusIcon className="size-6" strokeWidth={2.4} />
    </Link>
  );
}
