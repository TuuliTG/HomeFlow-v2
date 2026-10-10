import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function BaseIcon({ children, ...props }: IconProps) {
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
      {children}
    </svg>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </BaseIcon>
  );
}

export function CheckListIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m4 7 2 2 3-3M4 15l2 2 3-3M13 8h7M13 16h7" />
    </BaseIcon>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
    </BaseIcon>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </BaseIcon>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m3 11 9-7 9 7M5 9.5V20h14V9.5M10 20v-5h4v5" />
    </BaseIcon>
  );
}

export function NewsIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2h-1M8 9h5M8 13h5M8 16h3" />
    </BaseIcon>
  );
}

export function ThumbsUpIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M7 10v11H4V10zM7 10l4-7a2 2 0 0 1 3 2l-1 4h6a2 2 0 0 1 2 2.3l-1.4 7A2 2 0 0 1 17.6 21H7" />
    </BaseIcon>
  );
}
