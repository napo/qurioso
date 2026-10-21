import type { Language } from './translations';

const it = {
  subtitle: 'Attività in classe · un solo dispositivo', exit: 'Esci',
  finished: 'Attività conclusa', score: 'Risposte collettive corrette: {correct} su {total}.',
  classAnswer: 'Risposta della classe: {answer}', notCollected: 'Non raccolta', solution: 'Soluzione: {answer}', restart: 'Ricomincia',
  progress: 'Domanda {current} di {total} · senza limite di tempo', image: 'Immagine della domanda',
  discuss: 'Discutete insieme, poi seleziona la risposta della classe.',
  correct: 'Risposta corretta!', review: 'Discutiamo la soluzione.', next: 'Prossima domanda', summary: 'Mostra riepilogo',
  confirm: 'Conferma risposta della classe', selected: 'Risposta selezionata: {letter}. Potete ancora cambiarla.',
  shortcuts: 'Tastiera: {numbers} o {letters} per scegliere · Invio per confermare · Invio, Spazio o → per proseguire',
  trueLetter: 'V', falseLetter: 'F',
  fullscreen: 'Schermo intero', exitFullscreen: 'Esci da schermo intero', fullscreenError: 'Il browser non ha attivato lo schermo intero. L’attività continua normalmente.',
};
type Text = Record<keyof typeof it, string>;
const en: Text = {
  subtitle: 'Classroom activity · single device', exit: 'Exit',
  finished: 'Activity complete', score: 'Correct class answers: {correct} of {total}.',
  classAnswer: 'Class answer: {answer}', notCollected: 'Not collected', solution: 'Solution: {answer}', restart: 'Start again',
  progress: 'Question {current} of {total} · no time limit', image: 'Question image',
  discuss: 'Discuss together, then select the class answer.',
  correct: 'Correct answer!', review: 'Let’s discuss the solution.', next: 'Next question', summary: 'Show summary',
  confirm: 'Confirm class answer', selected: 'Selected answer: {letter}. You can still change it.',
  shortcuts: 'Keyboard: {numbers} or {letters} to choose · Enter to confirm · Enter, Space or → to continue',
  trueLetter: 'T', falseLetter: 'F',
  fullscreen: 'Fullscreen', exitFullscreen: 'Exit fullscreen', fullscreenError: 'The browser did not enter fullscreen. The activity continues normally.',
};
const de: Text = {
  subtitle: 'Aktivität im Klassenraum · ein einziges Gerät', exit: 'Beenden',
  finished: 'Aktivität abgeschlossen', score: 'Richtige Antworten der Klasse: {correct} von {total}.',
  classAnswer: 'Antwort der Klasse: {answer}', notCollected: 'Nicht erfasst', solution: 'Lösung: {answer}', restart: 'Neu starten',
  progress: 'Frage {current} von {total} · ohne Zeitlimit', image: 'Bild zur Frage',
  discuss: 'Besprecht euch gemeinsam und wählt dann die Antwort der Klasse.',
  correct: 'Richtige Antwort!', review: 'Besprechen wir die Lösung.', next: 'Nächste Frage', summary: 'Zusammenfassung anzeigen',
  confirm: 'Antwort der Klasse bestätigen', selected: 'Ausgewählte Antwort: {letter}. Ihr könnt sie noch ändern.',
  shortcuts: 'Tastatur: {numbers} oder {letters} zum Auswählen · Eingabe zum Bestätigen · Eingabe, Leertaste oder → zum Weitergehen',
  trueLetter: 'W', falseLetter: 'F',
  fullscreen: 'Vollbild', exitFullscreen: 'Vollbild beenden', fullscreenError: 'Der Browser hat das Vollbild nicht aktiviert. Die Aktivität läuft normal weiter.',
};
export const classroomTranslations: Record<Language, Text> = { it, en, de };
