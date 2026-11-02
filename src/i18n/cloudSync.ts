import type { Language } from './translations';
const en = {
  title: 'Cloud sync', intro: 'Keep your quizzes aligned between your devices through your own cloud account. Qurioso has no server: data go directly from this device to the service you choose, into a file you can see in your account.',
  what: 'Quizzes and their images are synced. Local video files, unsaved drafts, PINs, participants and scores are not. On another device a local video must be linked again.',
  connect: 'Connect {service}', connecting: 'Waiting for sign-in…', connected: 'Connected to {service}', syncNow: 'Sync now', syncing: 'Syncing…', signInAgain: 'Sign in again', disconnect: 'Disconnect',
  removeFile: 'Also move the file to the bin of the service', disconnectHint: 'Quizzes stay on this device.',
  never: 'Not synced yet.', last: 'Last sync: {time}', conflicts: 'The same quiz changed on two devices: both versions were kept ({count}).', skipped: 'Quizzes that cannot be synced and stay on this device: {count}.',
  'sign-in': 'Sign-in was not completed. Allow pop-up windows and try again.', file: 'This version of Qurioso cannot read the file on the service, so it was not changed. Update Qurioso on this device.',
  'too-large': 'The library is too large to sync (limit 96 MiB). Use smaller images or a backup.', storage: 'The service refused the request. Your quizzes on this device are safe.', offline: 'Service not reachable. Sync will try again.',
};
type CloudSyncMessages = typeof en;
const messages: Record<Language, CloudSyncMessages> = {
  en,
  it: {
    title: 'Sincronizzazione cloud', intro: 'Mantieni allineati i quiz tra i tuoi dispositivi tramite il tuo account cloud. Qurioso non ha un server: i dati vanno direttamente da questo dispositivo al servizio che scegli, in un file che puoi vedere nel tuo account.',
    what: 'Si sincronizzano i quiz e le loro immagini. Non si sincronizzano i file video locali, le bozze non salvate, i PIN, i partecipanti e i punteggi. Su un altro dispositivo il video locale va ricollegato.',
    connect: 'Collega {service}', connecting: 'In attesa dell’accesso…', connected: 'Collegato a {service}', syncNow: 'Sincronizza ora', syncing: 'Sincronizzazione…', signInAgain: 'Accedi di nuovo', disconnect: 'Scollega',
    removeFile: 'Sposta anche il file nel cestino del servizio', disconnectHint: 'I quiz restano su questo dispositivo.',
    never: 'Non ancora sincronizzato.', last: 'Ultima sincronizzazione: {time}', conflicts: 'Lo stesso quiz è cambiato su due dispositivi: sono state conservate entrambe le versioni ({count}).', skipped: 'Quiz che non si possono sincronizzare e restano su questo dispositivo: {count}.',
    'sign-in': 'L’accesso non è stato completato. Consenti le finestre pop-up e riprova.', file: 'Questa versione di Qurioso non riesce a leggere il file sul servizio, quindi non lo ha modificato. Aggiorna Qurioso su questo dispositivo.',
    'too-large': 'La biblioteca è troppo grande da sincronizzare (limite 96 MiB). Usa immagini più leggere o un backup.', storage: 'Il servizio ha rifiutato la richiesta. I quiz su questo dispositivo sono al sicuro.', offline: 'Servizio non raggiungibile. La sincronizzazione riproverà.',
  },
  de: {
    title: 'Cloud-Synchronisierung', intro: 'Halte deine Quiz über dein eigenes Cloud-Konto auf allen Geräten aktuell. Qurioso hat keinen Server: Die Daten gehen direkt von diesem Gerät zum gewählten Dienst, in eine Datei, die du in deinem Konto sehen kannst.',
    what: 'Synchronisiert werden Quiz und ihre Bilder, nicht aber lokale Videodateien, ungespeicherte Entwürfe, PINs, Teilnehmende und Punkte. Auf einem anderen Gerät muss ein lokales Video neu verknüpft werden.',
    connect: '{service} verbinden', connecting: 'Warten auf Anmeldung…', connected: 'Verbunden mit {service}', syncNow: 'Jetzt synchronisieren', syncing: 'Wird synchronisiert…', signInAgain: 'Erneut anmelden', disconnect: 'Trennen',
    removeFile: 'Datei auch in den Papierkorb des Dienstes verschieben', disconnectHint: 'Die Quiz bleiben auf diesem Gerät.',
    never: 'Noch nicht synchronisiert.', last: 'Letzte Synchronisierung: {time}', conflicts: 'Dasselbe Quiz wurde auf zwei Geräten geändert: Beide Versionen wurden behalten ({count}).', skipped: 'Quiz, die nicht synchronisiert werden können und auf diesem Gerät bleiben: {count}.',
    'sign-in': 'Die Anmeldung wurde nicht abgeschlossen. Erlaube Pop-up-Fenster und versuche es erneut.', file: 'Diese Qurioso-Version kann die Datei beim Dienst nicht lesen und hat sie daher nicht geändert. Aktualisiere Qurioso auf diesem Gerät.',
    'too-large': 'Die Bibliothek ist zu groß zum Synchronisieren (Grenze 96 MiB). Verwende kleinere Bilder oder ein Backup.', storage: 'Der Dienst hat die Anfrage abgelehnt. Deine Quiz auf diesem Gerät sind sicher.', offline: 'Dienst nicht erreichbar. Die Synchronisierung versucht es erneut.',
  },
};
export type CloudSyncMessage = keyof CloudSyncMessages;
export function cloudSyncText(language: Language, key: CloudSyncMessage, values: Record<string, string | number> = {}): string {
  return Object.entries(values).reduce((text, [name, value]) => text.replace(`{${name}}`, String(value)), messages[language][key]);
}
