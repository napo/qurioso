import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, Translations, translations } from '../i18n/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  languages: { code: Language; label: string; flag: string }[];
}

const AVAILABLE_LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
];

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const supported = (value: string | null | undefined): value is Language => value === 'it' || value === 'en' || value === 'de';
    if (typeof window !== 'undefined') {
      const explicit = new URLSearchParams(window.location.search).get('lang');
      if (supported(explicit)) return explicit;
      try {
        const saved = window.localStorage.getItem('qurioso_language');
        if (supported(saved)) return saved;
      } catch {}
      // Desktop: the system language passed by Electron, already falling back to English.
      const systemLanguage = window.quriosoDesktop?.systemLanguage;
      if (supported(systemLanguage)) return systemLanguage;
      const browserLanguage = window.navigator.language?.slice(0, 2).toLowerCase();
      if (supported(browserLanguage)) return browserLanguage;
    }
    return 'it';
  });

  useEffect(() => {
    document.documentElement.lang = language;
    try { window.localStorage.setItem('qurioso_language', language); } catch {}
    window.quriosoDesktop?.menu?.setLanguage?.(language);
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('lang', lang);
        window.history.replaceState(window.history.state, '', url);
      } catch {}
    }
  };

  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, languages: AVAILABLE_LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
