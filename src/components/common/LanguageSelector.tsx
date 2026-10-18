import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export const LanguageSelector: React.FC = () => {
  const { language, setLanguage, languages } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLang = languages.find((l) => l.code === language) || languages[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-label={{ it: 'Lingua', en: 'Language', de: 'Sprache' }[language]}
        onKeyDown={event => { if (event.key === 'Escape') setIsOpen(false); }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface-soft hover:bg-surface-hover text-xs font-semibold text-muted border border-line transition cursor-pointer"
        title="Cambia Lingua / Change Language / Sprache wechseln"
      >
        <span className="text-sm">{currentLang.flag}</span>
        <span className="uppercase text-[11px] font-bold tracking-wider">{currentLang.code}</span>
        <ChevronDown className="w-3 h-3 text-muted" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-36 rounded-2xl bg-white border border-line shadow-lg py-1 z-50 animate-in fade-in zoom-in-95 duration-150">
          {languages.map((l) => (
            <button
              key={l.code}
              type="button"
              lang={l.code}
              aria-pressed={language === l.code}
              onClick={() => {
                setLanguage(l.code);
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium text-left transition cursor-pointer ${
                language === l.code
                  ? 'bg-petrolio/30 text-petrolio font-bold'
                  : 'text-muted hover:bg-surface-hover hover:text-ink'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>{l.flag}</span>
                <span>{l.label}</span>
              </div>
              {language === l.code && <span className="text-accent-ink font-bold text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
