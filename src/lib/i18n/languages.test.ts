import { describe, expect, it } from 'vitest';

import { isLanguage, preferredLanguage } from '@/lib/i18n/languages';

describe('preferredLanguage', () => {
  it("picks the first of the browser's languages HomeFlow speaks, by its main tag", () => {
    expect(preferredLanguage(['sv-FI', 'fi-FI', 'en-GB'])).toBe('fi');
    expect(preferredLanguage(['en-US', 'fi'])).toBe('en');
    expect(preferredLanguage(['FI'])).toBe('fi');
  });

  it('finds none when HomeFlow speaks none of them', () => {
    expect(preferredLanguage(['sv-SE', 'de'])).toBeUndefined();
    expect(preferredLanguage([])).toBeUndefined();
  });
});

describe('isLanguage', () => {
  it('accepts only the codes of the languages HomeFlow speaks', () => {
    expect(isLanguage('fi')).toBe(true);
    expect(isLanguage('sv')).toBe(false);
    expect(isLanguage('toString')).toBe(false);
    expect(isLanguage(null)).toBe(false);
  });
});
