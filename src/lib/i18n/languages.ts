import { en, type Messages } from '@/locales/en';
import { fi } from '@/locales/fi';

/**
 * The languages HomeFlow speaks (ADR 0002). To add one, copy `src/locales/en` to `src/locales/<code>`,
 * translate it (TypeScript reports anything missing) and list it here with its name in that language.
 */
export const languages = {
  en: { name: 'English', messages: en },
  fi: { name: 'Suomi', messages: fi },
} as const satisfies Record<string, { name: string; messages: Messages }>;

export type Language = keyof typeof languages;

export const DEFAULT_LANGUAGE: Language = 'en';

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && Object.hasOwn(languages, value);
}

/** The first of the browser's preferred languages ("fi-FI", "en-GB") HomeFlow speaks, if any. */
export function preferredLanguage(browserLanguages: readonly string[]): Language | undefined {
  return browserLanguages.map((tag) => tag.split('-')[0]?.toLowerCase()).find(isLanguage);
}
