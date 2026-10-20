import type { Language } from './translations';

const it = {
  lanAccess: 'Accesso LAN', publicAccess: 'Accesso Internet · Cloudflare',
  lanHelp: 'Link e QR funzionano per chi è sulla stessa rete del docente.',
  publicHelp: 'Link e QR ora usano l’indirizzo pubblico. Possono partecipare anche persone fuori dalla LAN. Mantieni Qurioso aperto e Internet connesso.',
  pendingHelp: 'Il tunnel non è ancora pronto: link e QR restano della LAN. Attendi la conferma di attivazione prima di invitare partecipanti da Internet.',
  failedHelp: 'Il link pubblico non è disponibile. Link e QR mostrati sono tornati alla LAN. Apri il pannello Cloudflare per controllare il problema e riprovare.',
  tunnelButton: 'Tunnel Internet', configure: 'Configura Cloudflare', openPanel: 'Apri controlli Cloudflare',
  qrUpdated: 'Link e QR aggiornati all’indirizzo pubblico',

  title: 'Condividi su Internet', experimental: 'Sperimentale', close: 'Chiudi', start: 'Attiva condivisione', retry: 'Riprova', stop: 'Interrompi condivisione', reconnectHelp: 'Il collegamento a Cloudflare non risponde. I partecipanti esterni potrebbero essere disconnessi. Qurioso tenta il ripristino automatico; puoi interrompere la condivisione e riprovare. Controlla la connessione e la guida Cloudflare.',
  intro: 'Condividi questa partita tramite Cloudflare, anche con partecipanti fuori dalla LAN. Non serve un account.', reconnecting: 'Connessione Cloudflare persa: tentativo di ripristino automatico',
  disclosure: 'Al primo utilizzo Qurioso scarica il componente cloudflared dai rilasci ufficiali di Cloudflare e ne verifica l’integrità. Viene salvato nella cartella dati dell’app e riutilizzato. Il download può richiedere alcuni minuti.',
  traffic: 'Durante la condivisione, il traffico della partita, inclusi i nomi dei partecipanti e le risposte, passa attraverso Cloudflare. Chi possiede il link può raggiungere la pagina di partecipazione. Il docente continua a controllare il quiz nell’app locale.',
  limits: 'Il computer del docente e Internet devono restare attivi. Il link è temporaneo e può cambiare a ogni avvio. I Quick Tunnel sono pensati per test e dimostrazioni e non garantiscono disponibilità. Il tunnel si chiude interrompendo la condivisione, uscendo dalla partita o chiudendo Qurioso.',
  local: 'Qurioso locale', localActive: 'attivo', idle: 'Condivisione Internet disattivata', downloading: 'Download e verifica del componente Cloudflare', connecting: 'Connessione a Cloudflare', active: 'Condivisione Internet attiva', stopping: 'Chiusura della condivisione', error: 'Condivisione Internet interrotta',
  docs: 'Guida Cloudflare', downloads: 'Download ufficiali', service: 'Stato servizi Cloudflare', privacy: 'Privacy Cloudflare',
  details: 'Dettagli tecnici', copy: 'Copia dettagli', copied: 'Dettagli copiati.', copyFailed: 'Copia non disponibile. Seleziona i dettagli.',
  errors: {
    download_unavailable: 'La versione richiesta del componente Cloudflare non è più disponibile per il download. Riprova o aggiorna Qurioso. Consulta i download ufficiali di Cloudflare.',
    download: 'Impossibile scaricare il componente Cloudflare. Controlla Internet: un firewall o un proxy potrebbe bloccare il download. Riprova o consulta la guida Cloudflare.',
    integrity: 'Il componente Cloudflare non supera la verifica di integrità. Qurioso non lo eseguirà. Riprova per scaricare una copia verificata.',
    network: 'Impossibile stabilire la connessione a Cloudflare. Controlla Internet. Un firewall o un proxy potrebbe bloccare il servizio: consulta la guida Cloudflare o il referente della rete.',
    interrupted: 'La condivisione tramite Cloudflare si è interrotta. I partecipanti esterni potrebbero essere disconnessi. Riprova: verrà generato un link che potrebbe essere diverso.',
    launch: 'Il sistema non riesce ad avviare il componente Cloudflare. Potrebbe essere bloccato dalle impostazioni del computer. Consulta la guida Cloudflare e il referente del dispositivo.',
    unsupported: 'Il componente Cloudflare non è disponibile in questa versione di Qurioso per il tuo sistema o processore. Consulta i download ufficiali.',
    local: 'Qurioso non riesce ad attivare la condivisione di questa partita. Verifica che la sessione sia aperta e riprova. La guida Cloudflare descrive il servizio esterno utilizzato.',
  },
};
type Text = Omit<{ [K in keyof typeof it]: string }, 'errors'> & { errors: Record<keyof typeof it.errors, string> };
const en: Text = {
  lanAccess: 'LAN access', publicAccess: 'Internet access · Cloudflare',
  lanHelp: 'The link and QR code work for people on the teacher’s network.',
  publicHelp: 'The link and QR code now use the public address. People outside the LAN can join too. Keep Qurioso open and connected to the Internet.',
  pendingHelp: 'The tunnel is not ready yet: the link and QR code still use the LAN address. Wait for activation to be confirmed before inviting people over the Internet.',
  failedHelp: 'The public link is unavailable. The displayed link and QR code have returned to the LAN address. Open the Cloudflare panel to check the problem and retry.',
  tunnelButton: 'Internet tunnel', configure: 'Configure Cloudflare', openPanel: 'Open Cloudflare controls',
  qrUpdated: 'Link and QR code updated to the public address',

  title: 'Share over the Internet', experimental: 'Experimental', close: 'Close', start: 'Start sharing', retry: 'Retry', stop: 'Stop sharing', reconnectHelp: 'The Cloudflare connection is not responding. Remote participants may be disconnected. Qurioso is reconnecting automatically; you can stop sharing and retry. Check Internet access and the Cloudflare guide.',
  intro: 'Share this game through Cloudflare with participants outside your LAN. No account is required.', reconnecting: 'Cloudflare connection lost: reconnecting automatically',
  disclosure: 'On first use, Qurioso downloads cloudflared from official Cloudflare releases and verifies its integrity. It is stored in the app data folder and reused. The download may take a few minutes.',
  traffic: 'While sharing, game traffic, including participant names and answers, passes through Cloudflare. Anyone with the link can reach the participant page. The teacher keeps controlling the quiz in the local app.',
  limits: 'Keep the teacher’s computer and Internet connection running. The link is temporary and can change on each start. Quick Tunnels are intended for testing and demonstrations, with no uptime guarantee. Sharing stops when you stop it, leave the game or close Qurioso.',
  local: 'Local Qurioso', localActive: 'running', idle: 'Internet sharing off', downloading: 'Downloading and verifying the Cloudflare component', connecting: 'Connecting to Cloudflare', active: 'Internet sharing active', stopping: 'Stopping sharing', error: 'Internet sharing interrupted',
  docs: 'Cloudflare guide', downloads: 'Official downloads', service: 'Cloudflare service status', privacy: 'Cloudflare privacy',
  details: 'Technical details', copy: 'Copy details', copied: 'Details copied.', copyFailed: 'Copy unavailable. Select the details.',
  errors: {
    download_unavailable: 'The required Cloudflare component version is no longer available to download. Retry or update Qurioso. See the official Cloudflare downloads.',
    download: 'Cannot download the Cloudflare component. Check Internet access: a firewall or proxy may block the download. Retry or read the Cloudflare guide.',
    integrity: 'The Cloudflare component failed its integrity check. Qurioso will not run it. Retry to download a verified copy.',
    network: 'Cannot connect to Cloudflare. Check Internet access. A firewall or proxy may block the service: consult the Cloudflare guide or your network administrator.',
    interrupted: 'Sharing through Cloudflare was interrupted. Remote participants may be disconnected. Retry: the new link may be different.',
    launch: 'The system cannot launch the Cloudflare component. Device settings may block it. Consult the Cloudflare guide and your device administrator.',
    unsupported: 'This Qurioso version has no Cloudflare component for your system or processor. See the official downloads.',
    local: 'Qurioso cannot enable sharing for this game. Check that the session is open and retry. The Cloudflare guide describes the external service used.',
  },
};
const de: Text = {
  lanAccess: 'LAN-Zugang', publicAccess: 'Internetzugang · Cloudflare',
  lanHelp: 'Link und QR-Code funktionieren für Personen im Netzwerk der Lehrkraft.',
  publicHelp: 'Link und QR-Code verwenden jetzt die öffentliche Adresse. Auch Personen außerhalb des LANs können teilnehmen. Qurioso und die Internetverbindung müssen aktiv bleiben.',
  pendingHelp: 'Der Tunnel ist noch nicht bereit: Link und QR-Code verwenden weiterhin die LAN-Adresse. Warte auf die Aktivierungsbestätigung, bevor du Personen über das Internet einlädst.',
  failedHelp: 'Der öffentliche Link ist nicht verfügbar. Link und QR-Code zeigen wieder die LAN-Adresse. Öffne das Cloudflare-Fenster, um das Problem zu prüfen und es erneut zu versuchen.',
  tunnelButton: 'Internet-Tunnel', configure: 'Cloudflare einrichten', openPanel: 'Cloudflare-Steuerung öffnen',
  qrUpdated: 'Link und QR-Code auf die öffentliche Adresse aktualisiert',

  title: 'Über das Internet teilen', experimental: 'Experimentell', close: 'Schließen', start: 'Freigabe starten', retry: 'Erneut versuchen', stop: 'Freigabe beenden', reconnectHelp: 'Die Cloudflare-Verbindung antwortet nicht. Externe Teilnehmende könnten getrennt sein. Qurioso versucht die Verbindung automatisch wiederherzustellen; du kannst die Freigabe beenden und erneut versuchen. Prüfe die Internetverbindung und die Cloudflare-Anleitung.',
  intro: 'Teile dieses Spiel über Cloudflare mit Teilnehmenden außerhalb deines LANs. Ein Konto ist nicht nötig.', reconnecting: 'Cloudflare-Verbindung verloren: automatischer Wiederverbindungsversuch',
  disclosure: 'Beim ersten Start lädt Qurioso cloudflared aus den offiziellen Cloudflare-Veröffentlichungen herunter und prüft die Integrität. Die Komponente wird im App-Datenordner gespeichert und wiederverwendet. Der Download kann einige Minuten dauern.',
  traffic: 'Während der Freigabe läuft der Spielverkehr einschließlich Namen und Antworten über Cloudflare. Wer den Link hat, kann die Teilnahmeseite öffnen. Die Lehrkraft steuert das Quiz weiterhin in der lokalen App.',
  limits: 'Der Computer der Lehrkraft und die Internetverbindung müssen aktiv bleiben. Der Link ist vorübergehend und kann sich bei jedem Start ändern. Quick Tunnels sind für Tests und Vorführungen gedacht, ohne Verfügbarkeitsgarantie. Die Freigabe endet beim Beenden, Verlassen des Spiels oder Schließen von Qurioso.',
  local: 'Lokales Qurioso', localActive: 'aktiv', idle: 'Internetfreigabe aus', downloading: 'Cloudflare-Komponente wird geladen und geprüft', connecting: 'Verbindung zu Cloudflare', active: 'Internetfreigabe aktiv', stopping: 'Freigabe wird beendet', error: 'Internetfreigabe unterbrochen',
  docs: 'Cloudflare-Anleitung', downloads: 'Offizielle Downloads', service: 'Cloudflare-Dienststatus', privacy: 'Cloudflare-Datenschutz',
  details: 'Technische Details', copy: 'Details kopieren', copied: 'Details kopiert.', copyFailed: 'Kopieren nicht verfügbar. Details auswählen.',
  errors: {
    download_unavailable: 'Die benötigte Cloudflare-Version ist nicht mehr zum Download verfügbar. Versuche es erneut oder aktualisiere Qurioso. Siehe die offiziellen Cloudflare-Downloads.',
    download: 'Die Cloudflare-Komponente kann nicht geladen werden. Prüfe die Internetverbindung: Eine Firewall oder ein Proxy könnte den Download blockieren. Versuche es erneut oder lies die Cloudflare-Anleitung.',
    integrity: 'Die Integritätsprüfung der Cloudflare-Komponente ist fehlgeschlagen. Qurioso führt sie nicht aus. Lade erneut eine geprüfte Kopie herunter.',
    network: 'Verbindung zu Cloudflare nicht möglich. Prüfe die Internetverbindung. Eine Firewall oder ein Proxy könnte den Dienst blockieren: Siehe Cloudflare-Anleitung oder Netzwerkbetreuung.',
    interrupted: 'Die Freigabe über Cloudflare wurde unterbrochen. Externe Teilnehmende könnten getrennt sein. Versuche es erneut: Der neue Link kann anders sein.',
    launch: 'Das System kann die Cloudflare-Komponente nicht starten. Geräteeinstellungen könnten sie blockieren. Siehe Cloudflare-Anleitung und Gerätebetreuung.',
    unsupported: 'Diese Qurioso-Version hat keine Cloudflare-Komponente für dein System oder deinen Prozessor. Siehe die offiziellen Downloads.',
    local: 'Qurioso kann dieses Spiel nicht freigeben. Prüfe, ob die Sitzung geöffnet ist, und versuche es erneut. Die Cloudflare-Anleitung beschreibt den externen Dienst.',
  },
};
export const sharingTranslations: Record<Language, Text> = { it, en, de };
export const sharingLinks = {
  docs: 'https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/',
  downloads: 'https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/',
  service: 'https://www.cloudflarestatus.com/', privacy: 'https://www.cloudflare.com/privacypolicy/',
};
