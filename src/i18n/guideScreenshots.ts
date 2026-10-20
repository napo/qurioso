import type { Language } from './translations';
import type { TutorialId } from './guide';
export const guideScreenshot: Record<TutorialId, string> = {
  start: 'library', classroom: 'classroom', network: 'lobby', participant: 'participant',
  create: 'editor', video: 'editor', internet: 'internet', backup: 'settings', import: 'import', results: 'results', problems: 'lobby',
};
export const guideScreenshotText: Record<Language, { caption: string; zoom: string; close: string }> = {
  it: { caption: 'Schermata reale di Qurioso Desktop con «Tipi di vulcani con geopop». Nomi e risultati sono dimostrativi.', zoom: 'Ingrandisci schermata', close: 'Chiudi immagine' },
  en: { caption: 'Actual Qurioso Desktop screen using “Tipi di vulcani con geopop”. Names and scores are illustrative.', zoom: 'Enlarge screenshot', close: 'Close image' },
  de: { caption: 'Echte Qurioso-Desktop-Ansicht mit „Tipi di vulcani con geopop“. Namen und Ergebnisse sind Beispieldaten.', zoom: 'Bild vergrößern', close: 'Bild schließen' },
};
