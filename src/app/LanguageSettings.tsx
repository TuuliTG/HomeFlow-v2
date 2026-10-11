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
      className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4"
    >
      <h2 id={headingId} className="font-semibold text-slate-900">
        {t.heading}
      </h2>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
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
      <p id={hintId} className="text-sm text-slate-600">
        {t.hint}
      </p>
    </section>
  );
}
