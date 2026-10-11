import { createContext, useContext } from 'react';

import { DEFAULT_LANGUAGE, type Language, languages } from '@/lib/i18n/languages';
import type { Messages } from '@/locales/en';

export type { Messages };

export interface LanguageState {
  language: Language;
  setLanguage: (language: Language) => void;
}

/** English until `LanguageProvider` says otherwise, e.g. in tests that render one component. */
export const LanguageContext = createContext<LanguageState>({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => undefined,
});

export function useLanguage(): LanguageState {
  return useContext(LanguageContext);
}

/** The user's language's texts: `const t = useMessages()`, then `t.tasks.markDone`. */
export function useMessages(): Messages {
  return languages[useLanguage().language].messages;
}
