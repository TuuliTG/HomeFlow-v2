import { describe, expect, it } from 'vitest';

/** Every source file's text, so the test covers new files without being told about them. */
const sources = import.meta.glob<string>(['./**/*.{ts,tsx}', '!./**/*.test.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Tailwind's own palettes, as `tailwindcss/theme.css` defines them (`--color-<name>-50`). */
const palettes = (
  'slate gray zinc neutral stone mauve olive mist taupe red orange amber yellow lime green emerald teal cyan sky ' +
  'blue indigo violet purple fuchsia pink rose'
).split(' ');

/**
 * A palette colour (`text-slate-600`, `var(--color-red-700)`), white or black other than white text on a
 * filled colour, or an arbitrary colour like `bg-[#fff]`.
 */
const RAW_COLOUR = new RegExp(
  [
    `\\b(?:${palettes.join('|')})-\\d{2,3}\\b`,
    String.raw`\b(?:bg|border|ring|outline|divide|fill|stroke)-(?:white|black)\b`,
    String.raw`\btext-black\b`,
    String.raw`-\[(?:#|rgb|hsl|oklch)`,
  ].join('|'),
  'g',
);

describe('theme tokens', () => {
  it('styles the app only with the theme colours from index.css (ADR 0002)', () => {
    const rawColours = Object.entries(sources).flatMap(([path, text]) =>
      [...text.matchAll(RAW_COLOUR)].map(([match]) => `${path}: ${match}`),
    );
    expect(rawColours).toEqual([]);
  });
});
