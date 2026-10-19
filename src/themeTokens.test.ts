import { describe, expect, it } from 'vitest';

/** Every source file's text, so the test covers new files without being told about them. */
const sources = import.meta.glob<string>(['./**/*.{ts,tsx}', '!./**/*.test.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Tailwind's own colours, e.g. `text-slate-600` or `var(--color-red-700)`, and plain white or black backgrounds. */
const RAW_COLOUR =
  /\b(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b|\bbg-(?:white|black)\b/g;

describe('theme tokens', () => {
  it('styles the app only with the theme colours from index.css (ADR 0002)', () => {
    const rawColours = Object.entries(sources).flatMap(([path, text]) =>
      [...text.matchAll(RAW_COLOUR)].map(([match]) => `${path}: ${match}`),
    );
    expect(rawColours).toEqual([]);
  });
});
