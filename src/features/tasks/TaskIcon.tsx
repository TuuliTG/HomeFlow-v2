import type { ReactNode, SVGProps } from 'react';

import type { TaskIconName } from '@/features/tasks/task';

/** Each icon's drawing, on a 24×24 grid with round strokes like `@/components/ui/icons`. */
const drawings: Record<TaskIconName, ReactNode> = {
  bed: (
    <>
      <path d="M3 19V6M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6" />
      <circle cx="7" cy="11.5" r="1.5" />
    </>
  ),
  dishes: (
    <>
      <path d="M3 3v5a2 2 0 0 0 4 0V3M5 3v18" />
      <circle cx="15.5" cy="12" r="5.5" />
      <circle cx="15.5" cy="12" r="2.5" />
    </>
  ),
  laundry: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <circle cx="12" cy="13" r="4.5" />
      <path d="M7.5 6.5h.01M10.5 6.5h3" />
    </>
  ),
  vacuum: <path d="M13 4h5M15.5 4 9.5 15M5 15h7a3 3 0 0 1 0 6H5a2 2 0 0 1 0-6zM14 21h6" />,
  cleaning: (
    <path d="M9 3h5l2 3M10 3v4M7 7h6v2l2 3v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8l2-3zM19 5h.01M21 8h.01M19 11h.01" />
  ),
  trash: <path d="M4 7h16M10 3h4v4M6 7l1 14h10l1-14M10 11v6M14 11v6" />,
  recycling: (
    <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5" />
  ),
  plants: (
    <path d="M12 21v-8M12 13c0-5 3-8 8-8 0 5-3 8-8 8zM12 15c0-3.5-2.2-5.5-6.5-5.5 0 3.5 2.2 5.5 6.5 5.5zM7 21h10" />
  ),
  pet: (
    <>
      <circle cx="5.5" cy="10" r="1.8" />
      <circle cx="9.5" cy="5.5" r="1.8" />
      <circle cx="14.5" cy="5.5" r="1.8" />
      <circle cx="18.5" cy="10" r="1.8" />
      <path d="M8 17.5c0-2.2 1.8-4.5 4-4.5s4 2.3 4 4.5a2.5 2.5 0 0 1-4 2 2.5 2.5 0 0 1-4-2z" />
    </>
  ),
  toys: <path d="M3.5 8 12 4l8.5 4v8.5L12 20.5l-8.5-4zM3.5 8 12 12l8.5-4M12 12v8.5" />,
  table: <path d="M3 10h18M5 10v10M19 10v10M8 10V7a4 4 0 0 1 8 0v3" />,
  cooking: (
    <path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM2 10h2M20 10h2M9 7c0-1.5 1.5-1.5 1.5-3M14 7c0-1.5 1.5-1.5 1.5-3" />
  ),
  shopping: (
    <>
      <path d="M3 4h2l2.5 11h10l2-8H6.2" />
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="17" cy="19" r="1.5" />
    </>
  ),
  car: (
    <>
      <path d="M5 17H3v-4l2-5a2 2 0 0 1 1.9-1.4h10.2A2 2 0 0 1 19 8l2 5v4h-2M9 17h6M3 13h18" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
  homework: (
    <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3M9 7h6M9 11h4" />
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  phone: (
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
  ),
  bills: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3" />,
};

interface TaskIconProps extends SVGProps<SVGSVGElement> {
  name: TaskIconName;
}

/** A task's own icon. Decorative: the task's title, or the icon's name beside it, says it in words. */
export function TaskIcon({ name, ...props }: TaskIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {drawings[name]}
    </svg>
  );
}
