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
  videoActivity: 'Attività in classe con video', videoDone: 'Domande svolte: {done} su {total}.', restartActivity: 'Ricomincia attività', backToEditor: 'Torna all’editor',
  videoError: 'Impossibile riprodurre il video. Controlla la connessione e che il video consenta la riproduzione incorporata. Per i file locali verifica che il formato MP4/WebM sia supportato dal browser.',
  noTimeLimit: 'Discussione senza limite di tempo', beyondDuration: 'Alcune domande sono alla fine o oltre la durata del video. Controlla i checkpoint nell’editor.',
  checkpointAt: 'Checkpoint {n} a {time}', configureVideo: 'Configurazione Video Quiz', configureHint: 'Scegli YouTube, Vimeo, un link diretto o un file locale. Le domande restano collegate ai checkpoint del quiz. Per conservare la scelta tra le sessioni, impostala nell’editor e salva il quiz.',
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
  videoActivity: 'Classroom activity with video', videoDone: 'Questions answered: {done} of {total}.', restartActivity: 'Restart activity', backToEditor: 'Back to the editor',
  videoError: 'The video cannot be played. Check the connection and that the video allows embedded playback. For local files, check that the browser supports the MP4/WebM format.',
  noTimeLimit: 'Discussion without a time limit', beyondDuration: 'Some questions are at or beyond the end of the video. Check the checkpoints in the editor.',
  checkpointAt: 'Checkpoint {n} at {time}', configureVideo: 'Video quiz setup', configureHint: 'Choose YouTube, Vimeo, a direct link or a local file. Questions stay linked to the quiz checkpoints. To keep the choice across sessions, set it in the editor and save the quiz.',
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
  videoActivity: 'Aktivität im Klassenraum mit Video', videoDone: 'Beantwortete Fragen: {done} von {total}.', restartActivity: 'Aktivität neu starten', backToEditor: 'Zurück zum Editor',
  videoError: 'Das Video kann nicht abgespielt werden. Prüfe die Verbindung und ob das Video eingebettet werden darf. Prüfe bei lokalen Dateien, ob der Browser das Format MP4/WebM unterstützt.',
  noTimeLimit: 'Besprechung ohne Zeitlimit', beyondDuration: 'Einige Fragen liegen am Ende oder hinter dem Ende des Videos. Prüfe die Checkpoints im Editor.',
  checkpointAt: 'Checkpoint {n} bei {time}', configureVideo: 'Videoquiz einrichten', configureHint: 'Wähle YouTube, Vimeo, einen direkten Link oder eine lokale Datei. Die Fragen bleiben mit den Checkpoints des Quiz verknüpft. Um die Auswahl dauerhaft zu speichern, lege sie im Editor fest und speichere das Quiz.',
  fullscreen: 'Vollbild', exitFullscreen: 'Vollbild beenden', fullscreenError: 'Der Browser hat das Vollbild nicht aktiviert. Die Aktivität läuft normal weiter.',
};
export const classroomTranslations: Record<Language, Text> = { it, en, de };
