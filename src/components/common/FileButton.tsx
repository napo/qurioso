import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { chooseFileText } from '../../i18n/fileButton';

/** A translated file picker: the native input stays reachable by keyboard and assistive technology, only its untranslatable face is hidden. */
export function FileButton({ label, className = '', ...input }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & { label?: string }) {
  const { language } = useLanguage();
  return <label className={`file-button btn-secondary inline-flex w-fit items-center rounded-xl px-3 py-2 text-sm ${input.disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${className}`}>
    <input type="file" className="sr-only" {...input} />
    {label ?? chooseFileText[language]}
  </label>;
}
