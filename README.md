# Qurioso ⚡ — Interactive Multiplayer & Video Quiz Studio

Applicazione interattiva moderna sviluppata in **React 19 + TypeScript + Vite + Tailwind CSS** pronta per essere depositata su GitHub per generare le build multipiattaforma (**Linux, Windows, macOS e Android**).

---

## 🌍 Supporto Multilingue / Multilingual / Mehrsprachig
Qurioso include il supporto completo per 3 lingue con selettore in tempo reale:
- 🇮🇹 **Italiano** (predefinito)
- 🇬🇧 **English**
- 🇩🇪 **Deutsch**

---

## 🌟 Caratteristiche Principali

1. **Creazione Quiz Interattivi**
   - Domande a scelta multipla (fino a 6 risposte) e Vero/Falso.
   - Simboli geometrici per distinguere le risposte, con superfici chiare nella palette petrolio e mandarino.
   - Impostazione del timer per domanda (5s - 60s), moltiplicatori di punteggio e immagini di copertina.
   - Salvataggio locale persistente ed esportazione/importazione rapida in file JSON.

2. **Partecipazione Online con QR Code & PIN di Gioco**
   - **Schermo Presentatore / Proiettore**: Genera automaticamente un QR Code nitido e un Game PIN a 6 cifre.
   - **Sessione Personalizzata per Utente**: I partecipanti scansionano il QR Code con il proprio smartphone per entrare istantaneamente nella sessione, scegliendo Nickname e Avatar personalizzato.
   - **Sincronizzazione in Tempo Reale**: I pulsanti su smartphone si aggiornano istantaneamente allo scadere dei round con calcolo automatico della velocità di risposta e bonus streak!
   - **Simulatore Bot Integrato**: Permette al presentatore di testare l'esperienza anche da solo con un click ("+3 Bot Test").

3. **Modalità Video Quiz con Pause Automatiche**
   - Carica qualsiasi video (HTML5 MP4/WebM o preset ad alta definizione).
   - **Sequenza definita dall'utente**: Il video si interrompe ai secondi/minuti specificati nella timeline.
   - **Sequenza casuale**: Qurioso calcola pause distribuite casualmente lungo la durata del video.
   - Al checkpoint il video va in pausa automatica, appare la domanda del quiz e dopo la risposta il video riprende regolarmente.

4. **Classifiche e Analisi Risposte**
   - Grafico a barre istantaneo sul presentatore per visualizzare la distribuzione delle scelte dei giocatori.
   - Podio scenografico a 3 livelli con fuochi d'artificio e coriandoli animati.
   - Tabella completa con posizione, accuratezza %, risposte corrette e tempo medio di reazione.
   - Esportazione dei risultati in formato **CSV (per Excel / Google Sheets)** o **JSON**.

---

## 🚀 Deposito su GitHub e Build Multi-Piattaforma

### 1. Inizializzare e caricare su GitHub

Nel terminale del tuo progetto, esegui:

```bash
git init
git add .
git commit -m "feat: initial commit of Qurioso"
git branch -M main
git remote add origin https://github.com/TUO-USERNAME/qurioso.git
git push -u origin main
```

---

### 2. Build per Android (APK & AAB)

Il repository include già il file di configurazione `capacitor.config.json`. Per compilare l'applicazione Android:

```bash
# Compila il bundle di produzione
npm run build

# Installa Capacitor per Android
npm install @capacitor/core @capacitor/android
npx cap add android

# Sincronizza i file web con il progetto Android nativo
npx cap sync android

# Apri il progetto in Android Studio per esportare l'APK o l'AAB per Google Play
npx cap open android
```

Inoltre, il workflow di GitHub Actions in `.github/workflows/build-multiplatform.yml` compila automaticamente l'APK di debug ad ogni push!

---

### 3. Build per Desktop (Linux, Windows, macOS)

Puoi confezionare gli eseguibili desktop nativi usando Electron:

```bash
# Installa electron e electron-builder
npm install --save-dev electron electron-builder

# Compila l'applicazione web
npm run build

# Per Linux (genera pacchetti .deb e .AppImage)
npx electron-builder --linux deb AppImage

# Per Windows (genera il file di installazione Setup.exe NSIS)
npx electron-builder --win nsis

# Per macOS (genera il file .dmg)
npx electron-builder --mac dmg
```

---

### 4. Installazione Immediata PWA (Progressive Web App)

Qurioso è una PWA completa con Service Worker e Web App Manifest integrati. Gli utenti possono:
- Su **Android e Chrome/Edge Desktop**: Cliccare il pulsante **"Installa App"** direttamente nella barra superiore.
- Su **iPhone / iPad (iOS Safari)**: Toccare l'icona **Condividi** e selezionare **"Aggiungi alla schermata Home"**.

---

## 🛠️ Sviluppo Locale

```bash
# Installa le dipendenze
npm install

# Avvia HTTP + WebSocket: il terminale mostra la porta scelta automaticamente
npm run dev

# Compila per il rilascio in produzione
npm run build
```

Richiede **Node.js 22.12 o successivo**. Il file `package-lock.json` permette anche l'installazione riproducibile con `npm ci`.

A ogni avvio il sistema sceglie una **porta libera**. Il terminale mostra l’indirizzo del presentatore (`http://localhost:PORTA`) e gli indirizzi Wi-Fi/LAN (`http://IP-LOCALE:PORTA`). Un unico server gestisce sia HTTP sia WebSocket; il QR Code include la porta effettiva e, quando apri l’app da localhost, usa automaticamente l’indirizzo LAN per i telefoni.

I dispositivi devono essere sulla stessa rete, con traffico tra client consentito e firewall che permetta le connessioni alla porta scelta. Una porta casuale evita conflitti ma non rende il computer raggiungibile da Internet. Per un utilizzo con regole firewall fisse puoi impostare una porta stabile:

```bash
PORT=4444 npm run dev
```

`PORT=0` (predefinito) ripristina la scelta automatica; viene letto anche un eventuale file `.env`.

**Archivio del browser:** IndexedDB, `localStorage` e installazioni PWA appartengono all’indirizzo completo, inclusa la porta. Cambiando porta i quiz salvati in precedenza non vengono mostrati (restano nell’archivio del vecchio indirizzo). Per mantenere lo stesso archivio usa una porta fissa oppure esporta/importa i quiz in JSON. La porta automatica è utile soprattutto per prove e sessioni temporanee.

Per eseguire il bundle compilato con il server multiplayer:

```bash
npm run build
NODE_ENV=production npm start
```

`npm run preview` mostra soltanto il frontend: per le partite tra dispositivi serve il server avviato con `npm start` o `npm run dev`. Non sono necessarie chiavi Gemini: il codice attuale non effettua chiamate AI. La variabile `PORT` permette di scegliere una porta fissa.

I quiz e le immagini incorporate vengono salvati nel browser (IndexedDB, con recupero dei quiz precedenti da `localStorage`); le sessioni multiplayer sono in memoria e si perdono riavviando il server. Il server attuale non autentica i ruoli di presentatore e giocatore: prima di esporlo pubblicamente occorrono controlli di accesso e validazione delle richieste.

### Logo e icone

- `public/logo.svg`: logo originale petrolio/mandarino fornito dall'autore.
- `public/icon.svg`: sola Q estratta dai tracciati originali, con dettagli del viso e coda, senza ridisegni.
- `public/icon-192.png`, `public/icon-512.png` e `public/apple-touch-icon.png`: versioni per PWA e schermata Home.

Le istruzioni desktop sopra descrivono un possibile percorso di confezionamento: il progetto non include ancora l'entry point né la configurazione Electron. La build web è direttamente eseguibile; i pacchetti desktop richiedono ulteriore lavoro. Anche l'app Android necessita di un server multiplayer raggiungibile: Capacitor da solo non incorpora il backend Node.js.

---

## 👤 Autore
**Maurizio Napolitano**
Email: [maurizio.napolitano@gmail.com](mailto:maurizio.napolitano@gmail.com)

---

## 📄 Licenza
Rilasciato sotto licenza **GNU Affero General Public License v3** (AGPL-3.0-or-later).
Vedi il file [LICENSE](./LICENSE) per tutti i dettagli.

### Tema visivo

L’interfaccia usa uno sfondo bianco, il petrolio originale `#075E63` e il mandarino originale `#FF963B`. Superfici secondarie e bordi usano tinte leggere; il testo sul mandarino è scuro per mantenere contrasto. I token condivisi sono definiti in `src/index.css`.

### Sorgenti video e checkpoint

Dalla pagina iniziale premi **Crea quiz video**, oppure nell’editor scegli **Quiz con video** nella sezione **Tipo di quiz** in alto. Poi scegli un file **MP4/WebM dal computer** oppure incolla un link **YouTube**, **Vimeo** o diretto al video e premi **Usa link**. Per ogni domanda imposta il checkpoint in secondi nella colonna a destra e salva il quiz. Dalla scheda del quiz scegli **Esegui Modalità Video con Pause**.

I lettori YouTube e Vimeo mettono in pausa il video ai checkpoint e riprendono con **Continua Video**. Richiedono Internet e video che consentano la riproduzione incorporata; eventuali restrizioni del proprietario o della piattaforma vengono segnalate come errore di riproduzione. Non vengono scaricati video dalle piattaforme.

I file caricati vengono conservati come Blob in IndexedDB, sul computer del presentatore. Restano disponibili riaprendo il quiz allo stesso indirizzo/porta. L’esportazione JSON include anche i dati del video: il file esportato può quindi essere grande. Importando il JSON su un altro computer il video locale rimane utilizzabile senza dover cercare nuovamente il file originale.

In **Prova Video Quiz → Configura Video** puoi cambiare sorgente per la sessione corrente; per conservarla nel quiz usa l’editor. Il dimostrativo usa il trailer di Big Buck Bunny ospitato da W3C, lungo circa 33 secondi; richiede Internet. I vecchi link dimostrativi non accessibili vengono sostituiti automaticamente anche nei quiz salvati.

I checkpoint seguono i tempi impostati sulle domande. Il rilevamento gestisce aggiornamenti del tempo distanziati e avanzamenti manuali: le domande non vengono saltate quando il lettore supera il secondo esatto del checkpoint.

### Immagini nei quiz

Nell’editor, **Copertina del quiz** e **Immagine della domanda** permettono di incollare un URL, scegliere un file JPG/PNG/WebP dal computer (fino a 15 MB) oppure usare **Cerca su Commons**. Le immagini locali grandi vengono ridimensionate fino a 1600 pixel sul lato lungo; le immagini scelte da Commons vengono scaricate e incorporate nel quiz.

Le immagini incorporate restano disponibili senza Internet e sono incluse nell’esportazione/importazione JSON. Per Commons vengono conservati titolo, autore, licenza e link alla pagina sorgente, mostrati nell’editor e accanto alle immagini durante il gioco. La ricerca su Commons richiede Internet e non necessita di chiavi API. Google Immagini non è integrato.

L’archivio IndexedDB evita il limite ristretto di `localStorage`; entrambi restano legati all’indirizzo e alla porta. Un salvataggio fallito viene segnalato e mantiene aperto l’editor, così il quiz può essere esportato in JSON.

### Ricerca video senza credenziali

In **Crea quiz video**, scrivi un argomento e premi **Cerca su YouTube** o **Cerca su Vimeo**: il sito si apre in una nuova scheda con la ricerca compilata. Copia il link del video scelto, torna a Qurioso e incollalo in **Incolla il link del video**, poi premi **Usa link**.

Qurioso non richiede collegamenti di account, chiavi API o registrazioni per sviluppatori. Puoi anche caricare un file MP4/WebM dal computer. I video online richiedono Internet e devono consentire la riproduzione incorporata.

### Due modalità di utilizzo

- **Quiz in Rete**: Qurioso viene avviato sul computer del docente. Gli studenti, collegati alla stessa rete locale, rispondono ciascuno dal proprio dispositivo tramite QR e PIN. Questa modalità richiede il server locale.
- **Attività in classe**: docente e studenti usano un unico dispositivo, eventualmente collegato al proiettore. Il docente seleziona la risposta concordata dalla classe. Le domande non hanno scadenza automatica; nei quiz video il filmato si ferma ai checkpoint e riparte dopo la risposta e il confronto. Per i quiz classici è disponibile il riepilogo delle risposte collettive.

L’attività in classe funziona anche con il solo sito statico (`npm run build`, pubblicando il contenuto di `dist`, ad esempio su GitHub Pages): chi lo usa non deve installare software. I pulsanti LAN sono disponibili quando viene rilevato il server di Qurioso. Non vengono raccolte risposte individuali dagli smartphone nella modalità classe. Quiz e file rimangono nell’archivio del browser del docente; esportare il JSON permette di trasferirli. I video YouTube/Vimeo richiedono Internet.

### Pagina iniziale e GitHub Pages

La pagina iniziale presenta Qurioso e offre due percorsi:

- **Apri Attività in classe** apre `?app=classroom`, con libreria, creazione quiz e attività collettive direttamente nel browser. Non avvia connessioni multiplayer né mostra pulsanti PIN o installazione.
- **Quiz in Rete** apre la sezione `#quiz-in-rete`, con istruzioni LAN e download desktop. Le build vengono lette dalla più recente Release stabile di `napo/qurioso`: sono collegati soltanto installer `.exe`, `.msi`, `.dmg`, `.pkg`, `.AppImage`, `.deb` e `.rpm`. Se mancano, viene indicato chiaramente; i sorgenti e gli artifact CI non vengono presentati come installer.

L’app locale completa rimane raggiungibile con `?app=network`; i link QR con `?pin=...` continuano ad aprire direttamente la schermata partecipante. La modalità classe e quella locale mantengono lo stesso archivio se usate dallo stesso indirizzo e browser.

Il workflow `.github/workflows/pages.yml` verifica e pubblica `dist` su GitHub Pages a ogni push su `main`, oppure tramite avvio manuale. In **Settings → Pages → Build and deployment** la sorgente deve essere **GitHub Actions**. La build usa percorsi relativi per funzionare anche sotto `/qurioso/`. La pubblicazione della pagina non genera gli installer desktop: il confezionamento delle applicazioni resta separato.
