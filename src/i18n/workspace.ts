import type { Language } from './translations';

const it = {
  included: 'Quiz incluso', web: 'Qurioso Web', desktop: 'Qurioso Desktop', local: 'Qurioso · server locale',
  title: 'Prepara la lezione, scegli come giocare.', webTitle: 'Lezioni e quiz per la tua classe.',
  intro: 'Crea o modifica un quiz, poi scegli come raccogliere le risposte.',
  classroom: 'Lezione in aula', classroomHint: 'Proietta il quiz e scegli la risposta insieme alla classe. Basta il tuo computer.',
  network: 'Quiz sui dispositivi', networkHint: 'Ogni partecipante risponde dal proprio telefono o computer. LAN, oppure Internet con Cloudflare.',
  mode: 'Come vuoi usare i quiz?', selected: 'Selezionato', library: 'Scegli un quiz',
  networkReady: 'Il server è pronto. Apri un quiz, poi scegli in partita se usare solo la LAN o attivare il tunnel Internet.',
  networkWaiting: 'In attesa del server locale…',
  docs: 'Come funzionano LAN e Internet',
  devicesTitle: 'Vuoi che ogni studente risponda dal proprio dispositivo?', devicesDownload: 'Scarica Qurioso per il computer',
  imageCredits: 'Crediti dell’immagine', newQuiz: 'Nuovo quiz', classicQuiz: 'Quiz classico', videoQuiz: 'Quiz video', serverStatus: 'Stato del server',
  serverLan: 'LAN', internetActive: 'Internet attivo', internetInterrupted: 'Internet interrotto', serverStarting: 'Server in avvio…', serverPort: 'Porta {port}',
};
type Text = Record<keyof typeof it, string>;
const en: Text = {
  included: 'Included quiz',
  web: 'Qurioso Web', desktop: 'Qurioso Desktop', local: 'Qurioso · local server',
  title: 'Prepare your lesson, choose how to play.', webTitle: 'Lessons and quizzes for your classroom.',
  intro: 'Create or edit a quiz, then choose how to collect answers.',
  classroom: 'Classroom lesson', classroomHint: 'Project the quiz and choose the answer together. Your computer is all you need.',
  network: 'Quiz on participants’ devices', networkHint: 'Everyone answers on their own phone or computer. Use the LAN, or the Internet through Cloudflare.',
  mode: 'How would you like to use your quizzes?', selected: 'Selected', library: 'Choose a quiz',
  networkReady: 'The server is ready. Open a quiz, then choose in the game whether to use the LAN only or start the Internet tunnel.',
  networkWaiting: 'Waiting for the local server…', docs: 'How LAN and Internet access work',
  devicesTitle: 'Want every student to answer on their own device?', devicesDownload: 'Download Qurioso for your computer',
  imageCredits: 'Image credits', newQuiz: 'New quiz', classicQuiz: 'Classic quiz', videoQuiz: 'Video quiz', serverStatus: 'Server status',
  serverLan: 'LAN', internetActive: 'Internet active', internetInterrupted: 'Internet interrupted', serverStarting: 'Server starting…', serverPort: 'Port {port}',
};
const de: Text = {
  included: 'Enthaltenes Quiz',
  web: 'Qurioso Web', desktop: 'Qurioso Desktop', local: 'Qurioso · lokaler Server',
  title: 'Unterricht vorbereiten, Spielweise wählen.', webTitle: 'Unterricht und Quiz für deine Klasse.',
  intro: 'Erstelle oder bearbeite ein Quiz und wähle dann, wie die Antworten gesammelt werden.',
  classroom: 'Unterricht im Klassenraum', classroomHint: 'Projiziere das Quiz und wähle die Antwort gemeinsam mit der Klasse. Dein Computer genügt.',
  network: 'Quiz auf den Geräten', networkHint: 'Alle antworten auf dem eigenen Smartphone oder Computer. Im LAN oder über das Internet mit Cloudflare.',
  mode: 'Wie möchtest du die Quiz nutzen?', selected: 'Ausgewählt', library: 'Quiz auswählen',
  networkReady: 'Der Server ist bereit. Öffne ein Quiz und wähle im Spiel zwischen LAN und Internet-Tunnel.',
  networkWaiting: 'Warten auf den lokalen Server…', docs: 'So funktionieren LAN und Internet',
  devicesTitle: 'Soll jede Schülerin und jeder Schüler auf dem eigenen Gerät antworten?', devicesDownload: 'Qurioso für den Computer herunterladen',
  imageCredits: 'Bildnachweis', newQuiz: 'Neues Quiz', classicQuiz: 'Klassisches Quiz', videoQuiz: 'Videoquiz', serverStatus: 'Serverstatus',
  serverLan: 'LAN', internetActive: 'Internet aktiv', internetInterrupted: 'Internet unterbrochen', serverStarting: 'Server startet…', serverPort: 'Port {port}',
};
export const workspaceTranslations: Record<Language, Text> = { it, en, de };
