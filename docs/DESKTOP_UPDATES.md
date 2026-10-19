# Aggiornamenti di Qurioso desktop

Il comportamento riprende il flusso di Referto Volley
(https://github.com/napo/analisirefertogara/blob/main/webapp/src/updates.js):
controllo all'avvio delle copie installate, avviso di nuova versione, scelta
**Scarica aggiornamento** / **Più tardi**, download con avanzamento e preferenza
per disattivare il controllo automatico. È adattato a Electron e agli installer
già pubblicati da Qurioso; non usa i plugin Tauri del progetto di riferimento.

## Uso

- All'avvio di una copia desktop installata viene controllata la nuova versione.
  Offline, errori GitHub e limiti API non interrompono l'avvio né aprono errori.
- Dal menu **Qurioso → Verifica aggiornamenti…** si può richiedere un controllo
  manuale, anche quando quello automatico è disabilitato. In questo caso gli
  errori vengono mostrati.
- **Controlla aggiornamenti all’avvio** salva la preferenza nel file
  `update-settings.json` del profilo desktop. Non modifica quiz o credenziali.
- **Scarica aggiornamento** scarica automaticamente l'installer compatibile in
  `<userData>/updates/download-<id>/`. Titolo della finestra e indicatore di sistema
  mostrano l'avanzamento. Il menu permette di annullare controllo/download.
- Il file completo è disponibile solo dopo verifica di dimensione e SHA-256.
  Un download fallito o annullato elimina i file parziali. Non occorre caricare
  l'intero installer in memoria.
- A download concluso si può mostrare il file; quando non risultano sessioni
  multiplayer attive ed è aperta la biblioteca, si può anche aprire l'installer.
  Questa condizione è ricontrollata prima dell'apertura. L'app non forza chiusura,
  installazione o riavvio. Per AppImage viene sempre mostrato il file: chiudere
  la vecchia app e usare/sostituire manualmente la nuova AppImage eseguibile.
- **Apri cartella aggiornamenti scaricati** permette di ritrovare i download
  anche dopo un riavvio. I file verificati non vengono cancellati automaticamente:
  possono essere rimossi manualmente dopo l'installazione.

L'installazione finale segue i passaggi del sistema: NSIS su Windows, apertura
DMG e sostituzione dell'app su macOS, gestore pacchetti per DEB/RPM. Non è un
aggiornamento silenzioso in-place. Gli installer non firmati possono generare
gli avvisi del sistema; SHA-256 verifica il contenuto rispetto ai metadati GitHub,
non sostituisce una firma del produttore o la notarizzazione macOS. Per replicare
anche l'installazione e il riavvio automatici di Tauri servirà in futuro una
filiera di pacchetti firmati e un updater specifico compatibile con ogni formato.

## Versioni e pubblicazione

Il confronto usa SemVer, incluso l'ordine numerico delle prerelease
(`beta.10 > beta.2`, `1.0.0 > 1.0.0-beta.10`), ed esclude downgrade e reinstallazioni.
Le copie stabili interrogano `/releases/latest` e ricevono solo versioni stabili.
Le copie beta interrogano le ultime 100 release e possono avanzare a una beta più
recente oppure a una stabile. Draft e numeri di versione non validi sono esclusi.

**Prima di pubblicare** aggiornare insieme `package.json` e `package-lock.json`.
Il tag deve essere esattamente `v<version>`, anche per le beta. La build desktop
dei tag esegue `scripts/check-release-version.mjs` e si ferma se non corrispondono.
Questo evita il problema delle release storiche `v1.0.0-beta.*` che contenevano
applicazioni e installer dichiarati `1.0.0`. Quei pacchetti non ricevono
retroattivamente questa funzione: è necessario installare una prima release che
contenga il nuovo codice. Non sono state pubblicate release in questo intervento.

Gli asset devono seguire `electron-builder.yml`, con versione e architettura
esplicite: Windows EXE, macOS DMG Intel/ARM, Linux AppImage/DEB/RPM.
Sono riconosciuti gli alias x64/x86_64/amd64 e ARM64/aarch64 dei relativi formati.
Su Linux si mantiene AppImage se avviato da AppImage, altrimenti si usa la famiglia
DEB/RPM di `/etc/os-release`, con fallback AppImage su distribuzioni non riconosciute.
Non si sceglie mai automaticamente un'architettura diversa.

## Confini di sicurezza e limiti

Tutto il controllo risiede nel processo principale Electron. Il renderer LAN,
gli iframe dei video e `quriosoDesktop` non ricevono API per scaricare/eseguire file.
Non vengono inviati quiz, punteggi, PIN o credenziali: solo normali richieste HTTPS
ai metadati GitHub e al file scelto. GitHub vede comunque IP e dati ordinari della
connessione. Sono ammessi solo asset del repository `napo/qurioso` e redirect
HTTPS verso i CDN GitHub previsti. Installer senza dimensione/digest verificabile
non vengono scaricati automaticamente: viene proposta la pagina delle versioni.
Il download ha timeout di 30 minuti e può essere annullato.

La versione web/PWA e l'APK Android sperimentale non usano questo updater desktop.
In particolare non si propone un APK debug come aggiornamento installabile sopra
un'altra copia con una chiave diversa. La versione web mantiene il suo ciclo di
pubblicazione/service worker esistente. Nessuna dipendenza è stata aggiunta.

## Collaudo

I test coprono versioni/canali, OS/CPU, hash e dimensione, redirect non consentiti,
file troncati/alterati, cancellazione, errori/offline, rinvio, apertura esplicita,
protezione delle attività e persistenza delle preferenze. Lo smoke Electron usa
metadati e byte controllati, verifica il menu reale e un download su disco; non
esegue installer né contatta GitHub per installare software durante il collaudo.

Restano da provare, dopo una nuova release coerente, il download reale e il
passaggio fra due versioni su Windows/macOS/Linux, gli eventuali proxy scolastici,
gli avvisi degli installer non firmati e la conservazione della biblioteca reale.
