import { useId } from 'react';

import { inputClassName } from '@/components/ui/formStyles';
import { useLanguage, useMessages } from '@/lib/i18n/i18n';
import { isLanguage, languages } from '@/lib/i18n/languages';

/** Chooses the language HomeFlow is shown in on this device. */
export function LanguageSettings() {
  const t = useMessages().app.language;
  const { language, setLanguage } = useLanguage();
  const headingId = useId();
  const hintId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="bg-surface shadow-card mt-6 flex flex-col gap-3 rounded-2xl p-4"
    >
      <h2 id={headingId} className="text-ink font-semibold">
        {t.heading}
      </h2>
      <label className="text-ink flex flex-col gap-1 text-sm font-medium">
        {t.label}
        <select
          value={language}
          aria-describedby={hintId}
          onChange={(event) => {
            if (isLanguage(event.target.value)) setLanguage(event.target.value);
          }}
          className={`${inputClassName} w-fit`}
        >
          {Object.entries(languages).map(([code, { name }]) => (
            // Each language is named in itself, so anyone can find their own.
            <option key={code} value={code} lang={code}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <p id={hintId} className="text-ink-muted text-sm">
        {t.hint}
      </p>
    </section>
  );
}
