import type { Language } from './translations';

const it = {
  leave: 'Abbandona partita', joinError: 'Partita non trovata o server non raggiungibile. Controlla il PIN e riprova.',
  storageWarning: 'Questo browser non consente di conservare la credenziale: mantieni aperta la pagina per non perdere l’identità.',
  answerError: 'Risposta non ricevuta. Controlla la connessione e riprova prima che scada il tempo.',
  leaving: 'Uscita dalla partita in corso…', recovering: 'Recupero della partecipazione in corso…', retryRecovery: 'Riprova recupero', backToEntry: 'Torna all’ingresso',
  syncing: 'Sincronizzazione della partita in corso…',
  joinTitle: 'Partecipa al Quiz', pinHint: 'Inserisci il codice PIN proiettato sullo schermo', nickname: 'Il tuo soprannome', nicknamePlaceholder: 'Nome o soprannome...',
  avatar: 'Scegli il tuo Avatar', connecting: 'Connessione...', enter: 'Entra nel Quiz!', footer: 'Qurioso • Connessione HTTP/WebSocket diretta',
  connected: 'Connesso', ready: 'Pronto!', inLobby: 'Sei nella lobby di gioco! Guarda lo schermo del presentatore: il quiz inizierà tra poco.',
  stayHere: 'Rimani su questa schermata per rispondere alle domande', getReady: 'Teniti pronto!', questionComing: 'La domanda sta arrivando sul tuo telefono...',
  watchVideo: 'Guarda il video sullo schermo del docente', nextHere: 'La prossima domanda apparirà qui. Non chiudere questa pagina.',
  answerSent: 'Risposta Inviata!', answeredWait: 'Hai risposto con successo. Attendi che scada il tempo sullo schermo principale per scoprire se è corretta!',
  chooseAnswer: 'Scegli la risposta:', sending: 'Invio della risposta…', liveBadge: 'Qurioso in diretta su più dispositivi',
  correct: 'Risposta Esatta!', wrong: 'Ops, Non Esatta!', watchRanking: 'Guarda la classifica sullo schermo del presentatore!', waitingNext: 'In attesa della prossima domanda...',
  pinLabel: 'Codice PIN', roomPin: 'Stanza PIN: {pin}', questionN: 'Domanda {n}', correctAnswerIs: 'Risposta corretta: {answer}', streak: 'Serie attiva: {n} di fila!',
  recInvalid: 'La credenziale del partecipante non è valida. Puoi effettuare un nuovo ingresso.',
  recGone: 'Partita non più disponibile: è stata chiusa oppure il server è stato riavviato. Puoi effettuare un nuovo ingresso.',
  recExpired: 'La credenziale del partecipante è scaduta. Puoi effettuare un nuovo ingresso.', recEnded: 'Partita terminata. Puoi effettuare un nuovo ingresso.',
  recUnavailable: 'Recupero temporaneamente non disponibile. Controlla la connessione e riprova; la credenziale è stata conservata.',
  sessionEnded: 'Partita non più disponibile o credenziale scaduta. Puoi effettuare un nuovo ingresso.',
};
type Text = Record<keyof typeof it, string>;
const en: Text = {
  leave: 'Leave game', joinError: 'Game not found or server unreachable. Check the PIN and try again.',
  storageWarning: 'This browser cannot keep your credential: keep the page open so you don’t lose your identity.',
  answerError: 'Answer not received. Check the connection and try again before time runs out.',
  leaving: 'Leaving the game…', recovering: 'Recovering your participation…', retryRecovery: 'Retry recovery', backToEntry: 'Back to the entry page',
  syncing: 'Synchronizing the game…',
  joinTitle: 'Join the quiz', pinHint: 'Enter the PIN shown on the screen', nickname: 'Your nickname', nicknamePlaceholder: 'Name or nickname...',
  avatar: 'Choose your avatar', connecting: 'Connecting...', enter: 'Join the quiz!', footer: 'Qurioso • Direct HTTP/WebSocket connection',
  connected: 'Connected', ready: 'Ready!', inLobby: 'You are in the game lobby! Watch the presenter’s screen: the quiz will start shortly.',
  stayHere: 'Stay on this screen to answer the questions', getReady: 'Get ready!', questionComing: 'The question is coming to your phone...',
  watchVideo: 'Watch the video on the teacher’s screen', nextHere: 'The next question will appear here. Do not close this page.',
  answerSent: 'Answer sent!', answeredWait: 'Your answer was sent. Wait for the time to run out on the main screen to find out if it is correct!',
  chooseAnswer: 'Choose your answer:', sending: 'Sending your answer…', liveBadge: 'Qurioso live on multiple devices',
  correct: 'Correct answer!', wrong: 'Oops, not quite!', watchRanking: 'Watch the leaderboard on the presenter’s screen!', waitingNext: 'Waiting for the next question...',
  pinLabel: 'PIN code', roomPin: 'Room PIN: {pin}', questionN: 'Question {n}', correctAnswerIs: 'Correct answer: {answer}', streak: 'Streak: {n} in a row!',
  recInvalid: 'The participant credential is not valid. You can join again.',
  recGone: 'The game is no longer available: it was closed or the server was restarted. You can join again.',
  recExpired: 'The participant credential has expired. You can join again.', recEnded: 'The game has ended. You can join again.',
  recUnavailable: 'Recovery is temporarily unavailable. Check the connection and try again; your credential has been kept.',
  sessionEnded: 'The game is no longer available or the credential has expired. You can join again.',
};
const de: Text = {
  leave: 'Spiel verlassen', joinError: 'Spiel nicht gefunden oder Server nicht erreichbar. Prüfe die PIN und versuche es erneut.',
  storageWarning: 'Dieser Browser kann deine Zugangsdaten nicht speichern: Lass die Seite geöffnet, damit deine Identität erhalten bleibt.',
  answerError: 'Antwort nicht angekommen. Prüfe die Verbindung und versuche es erneut, bevor die Zeit abläuft.',
  leaving: 'Spiel wird verlassen…', recovering: 'Teilnahme wird wiederhergestellt…', retryRecovery: 'Wiederherstellung erneut versuchen', backToEntry: 'Zurück zum Einstieg',
  syncing: 'Spiel wird synchronisiert…',
  joinTitle: 'Am Quiz teilnehmen', pinHint: 'Gib die auf dem Bildschirm gezeigte PIN ein', nickname: 'Dein Spitzname', nicknamePlaceholder: 'Name oder Spitzname...',
  avatar: 'Wähle deinen Avatar', connecting: 'Verbindung wird hergestellt...', enter: 'Quiz beitreten!', footer: 'Qurioso • Direkte HTTP/WebSocket-Verbindung',
  connected: 'Verbunden', ready: 'Bereit!', inLobby: 'Du bist in der Lobby! Schau auf den Bildschirm der Lehrkraft: Das Quiz beginnt gleich.',
  stayHere: 'Bleib auf diesem Bildschirm, um die Fragen zu beantworten', getReady: 'Mach dich bereit!', questionComing: 'Die Frage kommt gleich auf dein Smartphone...',
  watchVideo: 'Schau das Video auf dem Bildschirm der Lehrkraft', nextHere: 'Die nächste Frage erscheint hier. Schließe diese Seite nicht.',
  answerSent: 'Antwort gesendet!', answeredWait: 'Deine Antwort ist angekommen. Warte, bis die Zeit auf dem Hauptbildschirm abgelaufen ist, um zu sehen, ob sie richtig ist!',
  chooseAnswer: 'Wähle deine Antwort:', sending: 'Antwort wird gesendet…', liveBadge: 'Qurioso live auf mehreren Geräten',
  correct: 'Richtige Antwort!', wrong: 'Leider nicht richtig!', watchRanking: 'Schau dir die Rangliste auf dem Bildschirm der Lehrkraft an!', waitingNext: 'Warten auf die nächste Frage...',
  pinLabel: 'PIN-Code', roomPin: 'Raum-PIN: {pin}', questionN: 'Frage {n}', correctAnswerIs: 'Richtige Antwort: {answer}', streak: 'Serie: {n} in Folge!',
  recInvalid: 'Die Zugangsdaten der Teilnahme sind ungültig. Du kannst erneut beitreten.',
  recGone: 'Das Spiel ist nicht mehr verfügbar: Es wurde beendet oder der Server neu gestartet. Du kannst erneut beitreten.',
  recExpired: 'Die Zugangsdaten der Teilnahme sind abgelaufen. Du kannst erneut beitreten.', recEnded: 'Das Spiel ist beendet. Du kannst erneut beitreten.',
  recUnavailable: 'Die Wiederherstellung ist vorübergehend nicht verfügbar. Prüfe die Verbindung und versuche es erneut; deine Zugangsdaten bleiben gespeichert.',
  sessionEnded: 'Das Spiel ist nicht mehr verfügbar oder die Zugangsdaten sind abgelaufen. Du kannst erneut beitreten.',
};
export const playerTranslations: Record<Language, Text> = { it, en, de };

/** Localized text for a participant recovery status; the service message stays as fallback. */
export const playerRecoveryText = (text: Text, status: string) =>
  ({ invalid: text.recInvalid, gone: text.recGone, expired: text.recExpired, ended: text.recEnded, unavailable: text.recUnavailable } as Record<string, string>)[status];
