import { describe, expect, it, vi } from 'vitest';

import { initialLanguage, storeLanguage } from '@/lib/i18n/storedLanguage';

describe('stored language', () => {
  it('starts in the language chosen on this device, over the browser’s', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-GB']);
    storeLanguage('fi');
    expect(initialLanguage()).toBe('fi');
  });

  it('ignores a stored value that is not a language HomeFlow speaks', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fi-FI']);
    localStorage.setItem('homeflow:language', 'sv');
    expect(initialLanguage()).toBe('fi');
  });

  it('falls back to the browser’s language, then English, when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);

    expect(() => {
      storeLanguage('fi');
    }).not.toThrow();
    expect(initialLanguage()).toBe('en');
  });
});
