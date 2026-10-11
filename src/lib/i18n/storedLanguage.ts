import {
  DEFAULT_LANGUAGE,
  isLanguage,
  type Language,
  preferredLanguage,
} from '@/lib/i18n/languages';

const LANGUAGE_KEY = 'homeflow:language';

/** The language chosen on this device, else the browser's if HomeFlow speaks it, else English. */
export function initialLanguage(): Language {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(LANGUAGE_KEY);
  } catch {
    // Storage can be unavailable (e.g. private browsing); fall back to the browser's language.
  }
  if (isLanguage(stored)) return stored;
  return preferredLanguage(navigator.languages) ?? DEFAULT_LANGUAGE;
}

/** Remembers the user's choice on this device. */
export function storeLanguage(language: Language) {
  try {
    localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // Nothing to do: the choice still holds until the app is reloaded.
  }
}
