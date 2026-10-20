import type { Language } from './translations';

// Keep home/header labels small; the tutorial content loads only when the guide opens.
export const guideNavigation: Record<Language, { nav: string; title: string }> = {
  it: { nav: 'Guida', title: 'Guida passo passo' },
  en: { nav: 'Guide', title: 'Step-by-step guide' },
  de: { nav: 'Anleitung', title: 'Schritt-für-Schritt-Anleitung' },
};
