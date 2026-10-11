import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { LanguageContext, type LanguageState } from '@/lib/i18n/i18n';
import type { Language } from '@/lib/i18n/languages';
import { initialLanguage, storeLanguage } from '@/lib/i18n/storedLanguage';

/** Picks the user's language and keeps `<html lang>` in step, so screen readers pronounce it right. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(initialLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const state = useMemo<LanguageState>(
    () => ({
      language,
      setLanguage: (chosen) => {
        storeLanguage(chosen);
        setLanguage(chosen);
      },
    }),
    [language],
  );

  return <LanguageContext value={state}>{children}</LanguageContext>;
}
