# Sincronizzazione con Google Drive, Dropbox e OneDrive

Chi usa l'app può collegare il proprio servizio cloud, dispositivo per dispositivo: i quiz vengono copiati nel file
`Qurioso-biblioteca.json` del suo spazio e tenuti allineati tra i dispositivi collegati allo stesso account. Il codice è
in `src/services/cloudSync/` e `desktop/cloudAuth.cjs`, adattato da
[analisirefertogara](https://github.com/napo/analisirefertogara).

**Finché i client qui sotto non sono configurati, la funzione è nascosta.**

## Come funziona

- **Cosa viaggia**: quiz e immagini incorporate, in un unico file JSON (massimo 96 MiB) riscritto a ogni modifica.
  Non viaggiano file video locali, bozze, PIN, partecipanti, punteggi e credenziali. Il file ricevuto passa dalla stessa
  validazione dei backup. Un video locale arriva sull'altro dispositivo come descrizione da ricollegare.
- **Date**: `library['sync:state']` tiene la data di ogni modifica e cancellazione, separata dai quiz: export e backup non cambiano.
- **Unione**: se un quiz è cambiato da una parte sola vince quella; se è cambiato da entrambe vince la modifica più
  recente e l'altra resta come copia con un nuovo id. Se da una parte è stato modificato e dall'altra cancellato, vince
  la modifica. Le cancellazioni sono conservate 400 giorni.
- **Date sempre crescenti**: ogni dispositivo dà a un quiz, o alla sua cancellazione, una data più alta di quella che
  conosceva. Così una data sul servizio più vecchia di quella sincronizzata non è una modifica ma un file sovrascritto
  (Google Drive non ha scritture condizionate vere): vince la versione locale, che ripara il file.
- **Quiz inclusi**: quelli non modificati non viaggiano.
- **Concorrenza**: se il file è cambiato prima dell'upload il giro riparte; i quiz modificati durante una sincronizzazione non vengono sovrascritti.
  Se due dispositivi creano il file insieme, Dropbox e OneDrive rifiutano il secondo; su Google Drive vince il file
  più vecchio e l'altro va nel cestino. In entrambi i casi il giro riparte e unisce i quiz.
- **Risparmio di rete**: se la versione del file è quella dell'ultimo giro e sul dispositivo non è cambiato nulla, il
  file non viene scaricato.
- **Quando**: all'avvio, 4 secondi dopo ogni modifica, al ritorno nell'app, ogni 5 minuti e al ritorno della rete.
- **Nessun server**: i dati vanno direttamente dal dispositivo al servizio. Un dispositivo usa un solo servizio alla volta.

## Accesso per piattaforma

| Piattaforma | Google Drive | Dropbox e OneDrive |
|---|---|---|
| Web (solo `https://qurioso.it`) | Google Identity Services: il token dura un'ora, poi serve un tocco | Finestra con PKCE e `public/oauth-callback.html`; token di rinnovo in `localStorage` |
| Windows, macOS, Linux | Browser di sistema e ritorno su `127.0.0.1`, PKCE | Come Google |
| Android | Non disponibile | Non disponibile |

Sul desktop il token di rinnovo resta nel processo principale, cifrato con `safeStorage`; la pagina riceve solo token di
accesso a breve durata. Senza un portachiavi di sistema il token non viene scritto su disco e l'accesso dura la sessione.

## Configurazione (una volta)

Gli ID non sono segreti: vanno in `src/services/cloudSync/config.ts` (web) e `desktop/cloudConfig.cjs` (desktop).

### Google

1. Progetto su <https://console.cloud.google.com>, poi abilita **Google Drive API**.
2. **Branding**: nome «Qurioso», email di assistenza, home page, informativa privacy, dominio `qurioso.it` verificato in Search Console.
3. **Audience**: esterno, poi **Pubblica l'app** (in test i token di rinnovo scadono dopo 7 giorni).
4. **Accesso ai dati**: solo `.../auth/drive.file`, ambito non sensibile.
5. **Client**: Applicazione web (origine `https://qurioso.it`, nessun redirect) e App desktop.
6. Il secret desktop non va nel repository: sta nel secret GitHub `GOOGLE_DESKTOP_CLIENT_SECRET`, che `scripts/write-cloud-secrets.mjs` scrive in `desktop/cloudSecrets.cjs`, ignorato da git, durante la build. Per le prove locali si crea a mano lo stesso file con `module.exports = { googleDesktopSecret: '...' };`.

### Dropbox

App con accesso circoscritto, tipo cartella dell'app, client pubblici consentiti, autorizzazioni `files.content.read`,
`files.content.write`, `files.metadata.read`. Indirizzi di ritorno: `https://qurioso.it/oauth-callback.html` e `http://localhost:53682/`.

### OneDrive

App in Microsoft Entra, solo account personali, autorizzazioni `Files.ReadWrite.AppFolder` e `offline_access`.
Piattaforma SPA: `https://qurioso.it/oauth-callback.html`. Piattaforma Mobile e desktop: `http://localhost`.

## Privacy

Collegare un servizio è una scelta esplicita. Finché non si collega, l'app non contatta il servizio; lo script di Google
viene richiesto solo quando l'utente si avvicina al pulsante. «Scollega» lascia i quiz sul dispositivo, cancella i token,
revoca l'accesso dove possibile e, se richiesto, sposta il file nel cestino. Informativa: `public/privacy.html`,
pubblicata su <https://qurioso.it/privacy.html>.

## Limiti

- Non ancora provata con i servizi reali: i test usano servizi simulati e un vero server di ritorno locale.
- OneDrive accetta solo account Microsoft personali; gli amministratori di account scolastici Google possono bloccare l'accesso.
- Una copia creata da un conflitto ha lo stesso titolo dell'originale e il suo video locale va ricollegato.
