import type { Language } from './translations';

const it = {
  web: 'Qurioso Web', desktop: 'Qurioso Desktop', local: 'Qurioso · server locale',
  title: 'Prepara la lezione, scegli come giocare.', webTitle: 'Lezioni e quiz per la tua classe.',
  intro: 'Crea o modifica un quiz, poi scegli come raccogliere le risposte.',
  classroom: 'Lezione in aula', classroomHint: 'Proietta il quiz e scegli la risposta insieme alla classe. Basta il tuo computer.',
  network: 'Quiz sui dispositivi', networkHint: 'Ogni partecipante risponde dal proprio telefono o computer. LAN, oppure Internet con Cloudflare.',
  mode: 'Come vuoi usare i quiz?', selected: 'Selezionato', library: 'Scegli un quiz',
  webDesktopTitle: 'Vuoi risposte dai dispositivi dei partecipanti?',
  webDesktopHint: 'Qurioso Desktop include tutte le funzioni web e il server per i quiz in LAN. Il tunnel Cloudflare permette anche di partecipare da Internet. I partecipanti usano il browser, senza installare nulla.',
  transfer: 'Puoi trasferire i quiz tra web e desktop con un backup dalle Impostazioni.',
  networkReady: 'Il server è pronto. Apri un quiz, poi scegli in partita se usare solo la LAN o attivare il tunnel Internet.',
  networkWaiting: 'In attesa del server locale…',
  docs: 'Come funzionano LAN e Internet',
};
type Text = Record<keyof typeof it, string>;
const en: Text = {
  web: 'Qurioso Web', desktop: 'Qurioso Desktop', local: 'Qurioso · local server',
  title: 'Prepare your lesson, choose how to play.', webTitle: 'Lessons and quizzes for your classroom.',
  intro: 'Create or edit a quiz, then choose how to collect answers.',
  classroom: 'Classroom lesson', classroomHint: 'Project the quiz and choose the answer together. Your computer is all you need.',
  network: 'Quiz on participants’ devices', networkHint: 'Everyone answers on their own phone or computer. Use the LAN, or the Internet through Cloudflare.',
  mode: 'How would you like to use your quizzes?', selected: 'Selected', library: 'Choose a quiz',
  webDesktopTitle: 'Want answers from participants’ devices?',
  webDesktopHint: 'Qurioso Desktop includes all web features and a server for LAN quizzes. The Cloudflare tunnel also lets people join over the Internet. Participants use their browser without installing anything.',
  transfer: 'Transfer quizzes between web and desktop with a backup from Settings.',
  networkReady: 'The server is ready. Open a quiz, then choose in the game whether to use the LAN only or start the Internet tunnel.',
  networkWaiting: 'Waiting for the local server…', docs: 'How LAN and Internet access work',
};
const de: Text = {
  web: 'Qurioso Web', desktop: 'Qurioso Desktop', local: 'Qurioso · lokaler Server',
  title: 'Unterricht vorbereiten, Spielweise wählen.', webTitle: 'Unterricht und Quiz für deine Klasse.',
  intro: 'Erstelle oder bearbeite ein Quiz und wähle dann, wie die Antworten gesammelt werden.',
  classroom: 'Unterricht im Klassenraum', classroomHint: 'Projiziere das Quiz und wähle die Antwort gemeinsam mit der Klasse. Dein Computer genügt.',
  network: 'Quiz auf den Geräten', networkHint: 'Alle antworten auf dem eigenen Smartphone oder Computer. Im LAN oder über das Internet mit Cloudflare.',
  mode: 'Wie möchtest du die Quiz nutzen?', selected: 'Ausgewählt', library: 'Quiz auswählen',
  webDesktopTitle: 'Antworten von den Geräten der Teilnehmenden?',
  webDesktopHint: 'Qurioso Desktop enthält alle Webfunktionen und einen Server für LAN-Quiz. Der Cloudflare-Tunnel ermöglicht auch die Teilnahme über das Internet. Teilnehmende nutzen ihren Browser ohne Installation.',
  transfer: 'Übertrage Quiz zwischen Web und Desktop mit einer Sicherung aus den Einstellungen.',
  networkReady: 'Der Server ist bereit. Öffne ein Quiz und wähle im Spiel zwischen LAN und Internet-Tunnel.',
  networkWaiting: 'Warten auf den lokalen Server…', docs: 'So funktionieren LAN und Internet',
};
export const workspaceTranslations: Record<Language, Text> = { it, en, de };
