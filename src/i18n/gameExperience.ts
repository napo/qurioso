import type { Language } from './translations';

const it = {
  lookAtTeacher: 'Leggi domanda e risposte sullo schermo del docente. Qui scegli lettera o simbolo.', answer: 'Risposta',
  finished: 'Gara conclusa', ranking: 'Classifica finale', score: 'Punteggio finale', position: 'Posizione', of: 'su', points: 'punti',
  share: 'Condividi risultato', close: 'Chiudi finestra', preparing: 'Preparazione immagine…', imageError: 'Impossibile preparare l’immagine. Riprova.',
  shareError: 'La condivisione non è disponibile. Premi di nuovo per scaricare l’immagine e condividerla dal dispositivo.',
  downloaded: 'Download dell’immagine richiesto. Puoi condividerla sui social o nelle app di messaggistica dal tuo dispositivo.',
  closeHelp: 'Il browser non consente la chiusura automatica. Puoi chiudere questa scheda o finestra manualmente.',
  shareHint: 'L’immagine include il quiz, il tuo nome e avatar e la classifica con i nomi dei partecipanti. Condividila solo se vuoi rendere visibile la classifica. PIN e credenziali sono esclusi.',
  full: 'Video a schermo intero', exitFull: 'Esci da schermo intero', esc: 'Esc per uscire dallo schermo intero',
  fullError: 'Il browser non ha attivato lo schermo intero. Puoi riprovare dal pulsante del video; la gara continua.',
  questionImage: 'Immagine della domanda', presenterVideo: 'Video del presentatore', videoHeading: 'Quiz video in rete · Video solo sullo schermo del docente', playing: 'Video in riproduzione', paused: 'Video in pausa', setup: 'Configurazione video', checkpointPaused: 'Video in pausa · domanda e risultati',
  play: 'Riproduci video', pause: 'Pausa video', positionVideo: 'Posizione del video', loading: 'Caricamento video locale…', retry: 'Riprova', changeVideo: 'Scegli un altro video',
  loadError: 'Caricamento non riuscito. Verifica il video o scegli una nuova sorgente.', syncError: 'Sessione non sincronizzata. Controlla la connessione e riprova senza avanzare il video.',
  playError: 'Impossibile riprodurre il video. Riprova o scegli un’altra sorgente.', mediaError: 'Impossibile caricare il video. Verifica connessione e formato oppure scegli una nuova sorgente.',
  checkpointHint: 'domande ai checkpoint salvati. Il video si avvia dopo l’ingresso dei partecipanti. I salti avanti aprono tutte le domande attraversate, in ordine; quelle oltre la durata vengono svolte alla fine.',
};
type Text = Record<keyof typeof it, string>;
const en: Text = {
  lookAtTeacher: 'Read the question and answers on the teacher’s screen. Choose a letter or symbol here.', answer: 'Answer',
  finished: 'Game finished', ranking: 'Final ranking', score: 'Final score', position: 'Position', of: 'of', points: 'points',
  share: 'Share result', close: 'Close window', preparing: 'Preparing image…', imageError: 'Cannot prepare the image. Please retry.',
  shareError: 'Sharing is unavailable. Press again to download the image and share it from your device.',
  downloaded: 'Image download requested. You can share it to social media or messaging apps from your device.',
  closeHelp: 'The browser does not allow this window to close automatically. You can close this tab or window manually.',
  shareHint: 'The image includes the quiz, your name and avatar, and the ranking with participants’ names. Share it only if you want to make the ranking visible. PIN and credentials are excluded.',
  full: 'Fullscreen video', exitFull: 'Exit fullscreen', esc: 'Press Esc to exit fullscreen',
  fullError: 'The browser did not enter fullscreen. You can retry using the video button; the game continues.',
  questionImage: 'Question image', presenterVideo: 'Presenter video', videoHeading: 'Network video quiz · Video on the teacher’s screen only', playing: 'Video playing', paused: 'Video paused', setup: 'Video setup', checkpointPaused: 'Video paused · question and results',
  play: 'Play video', pause: 'Pause video', positionVideo: 'Video position', loading: 'Loading local video…', retry: 'Retry', changeVideo: 'Choose another video',
  loadError: 'Loading failed. Check the video or choose a new source.', syncError: 'Session out of sync. Check your connection and retry without advancing the video.',
  playError: 'Cannot play the video. Retry or choose another source.', mediaError: 'Cannot load the video. Check the connection and format or choose a new source.',
  checkpointHint: 'questions at saved checkpoints. The video starts after participants join. Seeking forward opens all crossed questions in order; questions beyond the duration are shown at the end.',
};
const de: Text = {
  lookAtTeacher: 'Lies Frage und Antworten auf dem Bildschirm der Lehrkraft. Wähle hier Buchstabe oder Symbol.', answer: 'Antwort',
  finished: 'Spiel beendet', ranking: 'Endrangliste', score: 'Endpunktzahl', position: 'Platz', of: 'von', points: 'Punkte',
  share: 'Ergebnis teilen', close: 'Fenster schließen', preparing: 'Bild wird vorbereitet…', imageError: 'Das Bild konnte nicht erstellt werden. Versuche es erneut.',
  shareError: 'Teilen ist nicht verfügbar. Drücke erneut, um das Bild herunterzuladen und von deinem Gerät aus zu teilen.',
  downloaded: 'Bilddownload angefordert. Du kannst das Bild von deinem Gerät aus in sozialen Medien oder Messenger-Apps teilen.',
  closeHelp: 'Der Browser erlaubt das automatische Schließen nicht. Du kannst diesen Tab oder dieses Fenster manuell schließen.',
  shareHint: 'Das Bild enthält das Quiz, deinen Namen und Avatar sowie die Rangliste mit den Namen der Teilnehmenden. Teile es nur, wenn du die Rangliste veröffentlichen möchtest. PIN und Zugangsdaten sind ausgeschlossen.',
  full: 'Video im Vollbild', exitFull: 'Vollbild beenden', esc: 'Esc drücken, um das Vollbild zu beenden',
  fullError: 'Der Browser hat das Vollbild nicht aktiviert. Versuche es über die Videoschaltfläche erneut; das Spiel läuft weiter.',
  questionImage: 'Bild zur Frage', presenterVideo: 'Video der Lehrkraft', videoHeading: 'Video-Netzwerkquiz · Video nur auf dem Bildschirm der Lehrkraft', playing: 'Video läuft', paused: 'Video pausiert', setup: 'Videoeinrichtung', checkpointPaused: 'Video pausiert · Frage und Ergebnisse',
  play: 'Video abspielen', pause: 'Video pausieren', positionVideo: 'Videoposition', loading: 'Lokales Video wird geladen…', retry: 'Erneut versuchen', changeVideo: 'Anderes Video auswählen',
  loadError: 'Laden fehlgeschlagen. Prüfe das Video oder wähle eine neue Quelle.', syncError: 'Sitzung nicht synchron. Prüfe die Verbindung und versuche es erneut, ohne im Video vorzuspulen.',
  playError: 'Video kann nicht abgespielt werden. Versuche es erneut oder wähle eine andere Quelle.', mediaError: 'Video kann nicht geladen werden. Prüfe Verbindung und Format oder wähle eine neue Quelle.',
  checkpointHint: 'Fragen an gespeicherten Checkpoints. Das Video startet nach dem Beitritt der Teilnehmenden. Beim Vorspulen werden alle übersprungenen Fragen der Reihe nach geöffnet; Fragen jenseits der Videodauer erscheinen am Ende.',
};
export const gameExperienceTranslations: Record<Language, Text> = { it, en, de };
