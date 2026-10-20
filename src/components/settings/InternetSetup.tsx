import { CheckCircle, Globe, Wifi } from 'lucide-react';
import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { sharingLinks, sharingTranslations } from '../../i18n/internetSharing';
import { settingsTranslations } from '../../i18n/settings';
import type { InternetPreference } from '../../services/appEnvironment';

export function InternetSetup({ preference, onSave, firstRun = false, onDone }: {
  preference: InternetPreference | null; onSave: (value: InternetPreference) => void; firstRun?: boolean; onDone?: () => void;
}) {
  const { language } = useLanguage(), t = sharingTranslations[language], labels = settingsTranslations[language];
  const [error, setError] = useState(false);
  const save = (value: InternetPreference) => { try { onSave(value); setError(false); } catch { setError(true); } };
  return <section data-internet-setup className="rounded-2xl border border-line bg-white p-5 space-y-4">
    <h2 className="text-xl font-black text-petrolio">{firstRun ? labels.setupTitle : labels.sharingTitle}</h2>
    <p>{labels.setupIntro}</p>
    <div role="group" aria-label={labels.setupTitle} className="grid sm:grid-cols-2 gap-3">
      {(['lan', 'internet'] as const).map(value => <button key={value} type="button" aria-pressed={preference === value} onClick={() => save(value)} className={`rounded-xl border-2 p-4 text-left font-bold inline-flex items-center gap-3 ${preference === value ? 'bg-petrolio text-white border-petrolio shadow-md' : 'bg-white border-line text-petrolio'}`}>
        {value === 'lan' ? <Wifi size={20} /> : <Globe size={20} />}
        <span className="flex-1">{value === 'lan' ? firstRun ? labels.lanForNow : labels.useLan : labels.enableInternet}</span>
        {preference === value && <CheckCircle size={20} />}
      </button>)}
    </div>
    {preference !== null && <p role="status" aria-live="polite" className="rounded-xl bg-emerald-50 border border-emerald-300 p-3 text-emerald-900">✓ {labels.currentPreference} <strong>{preference === 'internet' ? labels.internetEnabled : labels.lanOnly}</strong></p>}
    <p className="font-bold text-petrolio">{labels.setupActivation}</p>
    <details className="text-sm space-y-3"><summary className="cursor-pointer font-bold text-petrolio">{labels.cloudflareDocs}</summary>
      <p>{t.disclosure}</p><p>{t.traffic}</p><p className="text-muted">{t.limits}</p>
      <nav aria-label={labels.cloudflareDocs} className="flex flex-wrap gap-3 text-petrolio font-bold">{Object.entries(sharingLinks).map(([key, url]) => <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="underline">{t[key as keyof typeof sharingLinks]}</a>)}</nav>
    </details>
    {firstRun && preference !== null && onDone && <button type="button" onClick={onDone} className="btn-mandarino rounded-xl px-5 py-3 font-bold">{labels.continueSetup}</button>}
    {error && <p role="alert" className="text-rose-800">{labels.preferenceError}</p>}
    <p className="text-sm text-muted">{labels.setupHelp}</p>
  </section>;
}
