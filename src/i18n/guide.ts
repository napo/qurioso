import type { Language } from './translations';
import { guideNavigation } from './guideNavigation';

export const tutorialIds = ["start", "classroom", "network", "participant", "create", "video", "internet", "backup", "import", "results", "problems"] as const;
export type TutorialId = typeof tutorialIds[number];
export type GuideAction = 'classroom' | 'downloads' | 'library' | 'cloudflareDocs' | 'status';
export interface GuideStep { title: string; body: string; action?: GuideAction }
export interface GuideLesson { title: string; summary: string; audience: 'web' | 'desktop' | 'both'; needs: string; steps: GuideStep[] }
const it = {
  ...guideNavigation.it,
  "intro": "Scegli cosa vuoi fare e segui un passaggio alla volta. Puoi cambiare lingua senza perdere il punto.",
  "topics": "Scegli un tutorial",
  "step": "Passo",
  "of": "di",
  "previous": "Indietro",
  "next": "Avanti",
  "nextTopic": "Tutorial successivo",
  "restart": "Torna al primo tutorial",
  "requirements": "Prima di cominciare",
  "home": "Pagina iniziale",
  "steps": "Passaggi del tutorial",
  "web": "Nel browser",
  "desktop": "App desktop del docente",
  "both": "Browser e app desktop",
  "end": "Fine di questo tutorial",
  "classroom": "Apri Attività in classe",
  "downloads": "Download dell’app desktop",
  "library": "Apri la biblioteca",
  "cloudflareDocs": "Documentazione Cloudflare",
  "status": "Stato dei servizi Cloudflare",
  "privacy": "Privacy Cloudflare",
  "references": "Riferimenti utili",
  "tutorial": "Tutorial",
  "tip": "Da ricordare"
};
type GuideText = Record<keyof typeof it, string>;
const en: GuideText = {
  ...guideNavigation.en,
  "intro": "Choose what you want to do and follow one step at a time. You can change language without losing your place.",
  "topics": "Choose a tutorial",
  "step": "Step",
  "of": "of",
  "previous": "Back",
  "next": "Next",
  "nextTopic": "Next tutorial",
  "restart": "Back to the first tutorial",
  "requirements": "Before you start",
  "home": "Home",
  "steps": "Tutorial steps",
  "web": "In your browser",
  "desktop": "Teacher’s desktop app",
  "both": "Browser and desktop app",
  "end": "End of this tutorial",
  "classroom": "Open Classroom activities",
  "downloads": "Download the desktop app",
  "library": "Open the library",
  "cloudflareDocs": "Cloudflare documentation",
  "status": "Cloudflare service status",
  "privacy": "Cloudflare privacy",
  "references": "Useful references",
  "tutorial": "Tutorial",
  "tip": "Remember"
};
const de: GuideText = {
  ...guideNavigation.de,
  "intro": "Wähle dein Vorhaben und folge den Schritten nacheinander. Du kannst die Sprache wechseln, ohne deine Position zu verlieren.",
  "topics": "Tutorial auswählen",
  "step": "Schritt",
  "of": "von",
  "previous": "Zurück",
  "next": "Weiter",
  "nextTopic": "Nächstes Tutorial",
  "restart": "Zum ersten Tutorial",
  "requirements": "Bevor du beginnst",
  "home": "Startseite",
  "steps": "Tutorial-Schritte",
  "web": "Im Browser",
  "desktop": "Desktop-App der Lehrkraft",
  "both": "Browser und Desktop-App",
  "end": "Ende dieses Tutorials",
  "classroom": "Klassenaktivitäten öffnen",
  "downloads": "Desktop-App herunterladen",
  "library": "Bibliothek öffnen",
  "cloudflareDocs": "Cloudflare-Dokumentation",
  "status": "Cloudflare-Dienststatus",
  "privacy": "Cloudflare-Datenschutz",
  "references": "Hilfreiche Links",
  "tutorial": "Tutorial",
  "tip": "Gut zu wissen"
};
export const guideTranslations: Record<Language, GuideText> = { it, en, de };

export const guideLessons: Record<Language, Record<TutorialId, GuideLesson>> = {
  "it": {
    "start": {
      "title": "Scegliere come usare Qurioso",
      "summary": "Capisci quando basta il browser e quando serve l’app desktop.",
      "audience": "both",
      "needs": "Un browser sul computer del docente.",
      "steps": [
        {
          "title": "Una risposta per tutta la classe",
          "body": "Scegli Attività in classe se proietti le domande, ascolti la discussione e selezioni tu la risposta collettiva. Funziona su qurioso.it senza installare eseguibili; gli studenti non devono collegare il telefono.",
          "action": "classroom"
        },
        {
          "title": "Una risposta da ogni dispositivo",
          "body": "Scegli Quiz in rete se ciascuno studente deve rispondere individualmente. Il docente scarica e avvia l’app desktop; i partecipanti usano il browser del telefono o del computer.",
          "action": "downloads"
        },
        {
          "title": "Stessa rete oppure Internet",
          "body": "Sulla stessa LAN o Wi-Fi non serve Cloudflare. Per partecipare da reti diverse puoi abilitare la condivisione Internet nell’app desktop. Il sito qurioso.it non ospita le partite e installarlo come app web non aggiunge un server."
        },
        {
          "title": "Conserva i tuoi contenuti",
          "body": "La biblioteca del sito e quella dell’app desktop sono separate. Crea o modifica quiz nella versione che preferisci e usa un backup dalle Impostazioni per trasferirli. Cambiare browser o dispositivo non sincronizza automaticamente la biblioteca."
        }
      ]
    },
    "classroom": {
      "title": "Fare un’attività in classe",
      "summary": "Un solo schermo, discussione e risposta collettiva.",
      "audience": "both",
      "needs": "Il computer del docente; un proiettore o un grande schermo se vuoi mostrare le domande.",
      "steps": [
        {
          "title": "Apri la biblioteca",
          "body": "Sul sito scegli Attività in classe dalla home; nell’app desktop seleziona Lezione in aula. Puoi usare i quiz già inclusi oppure crearne uno tuo. Non serve avviare un server e non è richiesta la registrazione.",
          "action": "classroom"
        },
        {
          "title": "Scegli il quiz",
          "body": "Premi Attività in classe nella scheda del quiz. Se contiene un video, si aprirà l’attività con video e domande ai checkpoint."
        },
        {
          "title": "Discuti e rispondi",
          "body": "Mostra la domanda, lascia il tempo per confrontarsi e seleziona sul tuo dispositivo la risposta concordata. In questa modalità non c’è un limite di tempo per la risposta collettiva."
        },
        {
          "title": "Leggi la spiegazione e continua",
          "body": "Guarda l’esito e l’eventuale spiegazione, poi passa alla domanda successiva. Nei quiz video riprendi il filmato quando la classe è pronta. Alla fine puoi consultare il riepilogo o uscire."
        }
      ]
    },
    "network": {
      "title": "Condurre un quiz in rete",
      "summary": "Prepara il computer del docente e fai entrare i partecipanti.",
      "audience": "desktop",
      "needs": "L’app desktop sul computer del docente e i dispositivi dei partecipanti sulla stessa LAN o Wi-Fi.",
      "steps": [
        {
          "title": "Scarica e avvia l’app",
          "body": "Dalla home apri i download e scegli la versione per Windows, macOS o Linux. Avvia Qurioso sul computer del docente: la sola pagina web non può condurre una gara in rete.",
          "action": "downloads"
        },
        {
          "title": "Apri un quiz in rete",
          "body": "Nell’app desktop seleziona Quiz sui dispositivi, poi Quiz video in rete nella scheda Tipi di vulcani con geopop. Il quiz incluso resta disponibile anche nelle biblioteche già salvate. Puoi avviare allo stesso modo i tuoi quiz con checkpoint validi."
        },
        {
          "title": "Mostra indirizzo, PIN e QR",
          "body": "Nella lobby mostra ai partecipanti il QR della partita. In alternativa comunica l’indirizzo del server e il PIN. Per la LAN scegli un indirizzo raggiungibile dagli altri dispositivi, non localhost o 127.0.0.1."
        },
        {
          "title": "Attendi gli ingressi e avvia",
          "body": "Controlla i nomi nella lobby. Quando tutti sono pronti premi il pulsante per iniziare. I partecipanti vedono i comandi per rispondere; le domande e le risposte complete sono sullo schermo del docente."
        },
        {
          "title": "Gestisci la gara",
          "body": "Mostra risultati e classifica tra le domande, poi continua con la domanda successiva o riprendi il video. Alla fine mostra la classifica finale. Lascia l’app aperta durante tutta la partita."
        }
      ]
    },
    "participant": {
      "title": "Partecipare dal telefono",
      "summary": "Entra nella partita e rispondi senza scorrere i testi.",
      "audience": "web",
      "needs": "Il link o il QR del docente; sulla LAN, il telefono deve essere sulla stessa rete.",
      "steps": [
        {
          "title": "Apri il collegamento del docente",
          "body": "Scansiona il QR o apri il link ricevuto. Non serve installare l’app. Il solo PIN inserito su qurioso.it non individua la partita sul computer del docente."
        },
        {
          "title": "Scegli nome e avatar",
          "body": "Inserisci il tuo nome o soprannome, scegli un avatar ed entra. Aspetta l’avvio della gara nella lobby. Evita di aprire più schede per la stessa partecipazione."
        },
        {
          "title": "Guarda il docente e scegli",
          "body": "Sul telefono leggi e tocca il testo della risposta. Qurioso usa tutto lo spazio disponibile e adatta la dimensione del carattere alla lunghezza dei testi e alle dimensioni dello schermo, anche ruotando il telefono."
        },
        {
          "title": "Aspetta la conferma",
          "body": "Dopo Risposta inviata aspetta l’esito e la prossima domanda. Se ricarichi la stessa pagina, il recupero mantiene l’identità quando il browser consente di conservare la credenziale. Alla fine restano risultato, condivisione e chiusura."
        }
      ]
    },
    "create": {
      "title": "Creare un quiz e nuove categorie",
      "summary": "Titolo, domande, immagini e salvataggio nella biblioteca.",
      "audience": "both",
      "needs": "La biblioteca aperta nel browser o nell’app desktop.",
      "steps": [
        {
          "title": "Crea oppure modifica",
          "body": "Premi Crea quiz per partire da un nuovo quiz, oppure Modifica nella scheda di un quiz esistente. Per mantenere una copia dell’originale, duplicalo prima.",
          "action": "library"
        },
        {
          "title": "Scrivi titolo e categoria",
          "body": "Inserisci il titolo che vuoi mostrare e una descrizione. Nel campo Categoria puoi scegliere un suggerimento oppure scrivere un nome nuovo: non serve creare prima una categoria separata."
        },
        {
          "title": "Prepara le domande",
          "body": "Aggiungi domande a scelta multipla o vero/falso. Scrivi risposte chiare, indica quella corretta e aggiungi una spiegazione quando serve. Controlla tempo e punteggio per la modalità in rete."
        },
        {
          "title": "Aggiungi immagini e crediti",
          "body": "Scegli una copertina e, se utili, immagini nelle domande. Con Wikimedia Commons conserva titolo, autore, licenza e link alla fonte: scaricare l’immagine non elimina l’obbligo di attribuzione."
        },
        {
          "title": "Salva e prova",
          "body": "Premi Salva Quiz e controlla titolo e copertina nella biblioteca. Apri un’attività in classe per verificare testi e risposte, poi esporta un backup se vuoi conservarli o trasferirli."
        }
      ]
    },
    "video": {
      "title": "Preparare un quiz video",
      "summary": "Associa le domande ai momenti giusti del filmato.",
      "audience": "both",
      "needs": "Un quiz video e un file supportato oppure un link YouTube o Vimeo.",
      "steps": [
        {
          "title": "Crea un quiz video",
          "body": "Premi Crea quiz video nella biblioteca. Dai al quiz un titolo riconoscibile e scegli il file o il link del filmato. Attendi il caricamento prima di impostare i tempi."
        },
        {
          "title": "Prepara le domande",
          "body": "Scrivi le domande e le risposte nell’editor. Una domanda presente nel quiz non è automaticamente un checkpoint: va associata al momento desiderato."
        },
        {
          "title": "Associa un checkpoint",
          "body": "Porta il video al punto in cui vuoi interromperlo e usa la timeline per aggiungere o associare la domanda. Controlla l’elenco dei checkpoint e applica eventuali modifiche dei tempi."
        },
        {
          "title": "Controlla ordine e sorgente",
          "body": "Verifica che ogni domanda prevista sia associata e che i tempi siano nell’ordine desiderato. Per un file locale assicurati che sia disponibile sul computer del docente. YouTube e Vimeo richiedono l’accesso ai rispettivi servizi."
        },
        {
          "title": "Salva, prova e proietta",
          "body": "Salva il quiz e provalo. Nella gara in rete il video è sullo schermo del docente; il telefono mostra i comandi per rispondere. All’avvio viene richiesto lo schermo intero: Esc permette di uscire e il pulsante del video permette di rientrare."
        }
      ]
    },
    "internet": {
      "title": "Condividere fuori dalla LAN con Cloudflare",
      "summary": "Crea un link Internet temporaneo dalla versione desktop.",
      "audience": "desktop",
      "needs": "L’app desktop, Internet sul computer del docente e una partita in rete.",
      "steps": [
        {
          "title": "Abilita la funzione",
          "body": "Apri la partita in rete. Qurioso chiede se usare solo la LAN o avviare Cloudflare: non serve una preferenza nelle Impostazioni. La scelta, da sola, non avvia download o tunnel."
        },
        {
          "title": "Leggi le informazioni sul servizio",
          "body": "La funzione è facoltativa e sperimentale, senza account e senza garanzia di disponibilità. Il traffico, inclusi nomi e risposte, passa attraverso Cloudflare. Chi possiede il link può raggiungere la pagina di partecipazione.",
          "action": "cloudflareDocs"
        },
        {
          "title": "Attiva dalla partita",
          "body": "Premi Attiva condivisione dopo aver letto le informazioni sul servizio. La finestra si chiude e lo stato del docente mostra download e connessione. Fuori dallo schermo intero, lo switch Cloudflare permette di spegnere il tunnel e riattivarlo con un clic dopo la prima autorizzazione della partita."
        },
        {
          "title": "Prova da un’altra rete",
          "body": "Quando lo stato diventa verde e appare il link trycloudflare.com, indirizzo e QR passano automaticamente al link pubblico. Se il tunnel si interrompe o lo chiudi, tornano alla LAN. Condividi il link attuale o il QR aggiornato. Per una prova, spegni il Wi-Fi del telefono e usa la rete mobile. Non usare sul telefono l’indirizzo localhost del docente."
        },
        {
          "title": "Interrompi o risolvi un errore",
          "body": "Tieni il computer acceso e l’app aperta. Interrompi condivisione chiude il tunnel; uscita dalla partita, ricarica o chiusura dell’app lo fermano. Se download o connessione falliscono leggi l’errore, consulta la guida o lo stato Cloudflare e riprova. Il nuovo link può cambiare.",
          "action": "status"
        }
      ]
    },
    "backup": {
      "title": "Salvare e trasferire la biblioteca",
      "summary": "Crea un backup ZIP e ripristinalo nell’altra versione.",
      "audience": "both",
      "needs": "La biblioteca da conservare e spazio sufficiente per il file di backup.",
      "steps": [
        {
          "title": "Apri la gestione dei dati",
          "body": "Dalla biblioteca apri Impostazioni. Nella sezione Dati trovi Esporta backup e Importa backup. Il backup riguarda i contenuti salvati, non le modifiche ancora aperte nell’editor."
        },
        {
          "title": "Esporta il backup",
          "body": "Premi Esporta backup, controlla la dimensione stimata e scegli se includere i video locali. Crea il backup ZIP e verifica che il file sia stato effettivamente salvato sul dispositivo."
        },
        {
          "title": "Aprilo sulla destinazione",
          "body": "Per passare dal sito all’app desktop o a un altro browser, apri lì Qurioso, vai in Impostazioni e premi Importa backup. Seleziona lo ZIP e controlla l’anteprima prima di confermare."
        },
        {
          "title": "Scegli come ripristinare",
          "body": "Aggiungi alla biblioteca mantiene i quiz presenti. La sostituzione aggiorna quelli selezionati; il ripristino dell’intera biblioteca sostituisce tutti i quiz salvati e richiede una conferma esplicita. Conserva prima una copia della biblioteca attuale."
        },
        {
          "title": "Controlla i video e i link esterni",
          "body": "Dopo il ripristino verifica quiz e immagini. Se un video locale non era incluso, ricollegalo al file corretto. I link esterni restano link e possono richiedere Internet. Il backup non abilita Cloudflare sul nuovo dispositivo."
        }
      ]
    },
    "import": {
      "title": "Importare domande o un quiz",
      "summary": "Usa CSV, JSON e anteprima senza sovrascrivere per errore.",
      "audience": "both",
      "needs": "Un file CSV/TSV o JSON; per le sole domande, fino a 5 MiB e 1000 elementi.",
      "steps": [
        {
          "title": "Scegli il tipo di importazione",
          "body": "Per aggiungere solo domande apri Importa domande nelle Impostazioni o nell’editor. Per ripristinare un quiz completo usa il comando di importazione del quiz nell’editor. Per un’intera biblioteca usa il backup ZIP."
        },
        {
          "title": "Carica il file e configura",
          "body": "Seleziona CSV/TSV o JSON. Per CSV controlla separatore, intestazioni e associazione delle colonne. Puoi scaricare il modello CSV come punto di partenza. Usa UTF-8 per conservare correttamente gli accenti."
        },
        {
          "title": "Controlla l’anteprima",
          "body": "Leggi gli errori e i possibili duplicati. Seleziona le domande valide e scegli se creare un nuovo quiz o aggiungerle a uno esistente. L’anteprima non salva ancora nella biblioteca."
        },
        {
          "title": "Conferma e salva nell’editor",
          "body": "Apri il risultato nell’editor, controlla domande e risposte e premi Salva Quiz. Nei quiz video le domande importate non ricevono automaticamente un checkpoint: associale nella timeline."
        }
      ]
    },
    "results": {
      "title": "Condividere il risultato e chiudere",
      "summary": "Cosa succede sul telefono quando termina la gara.",
      "audience": "web",
      "needs": "Una gara in rete conclusa come partecipante.",
      "steps": [
        {
          "title": "Leggi il risultato finale",
          "body": "Alla fine vedi punteggio, posizione e classifica finale. Non ci sono comandi per riavviare o proseguire la gara. Il riepilogo può restare disponibile dopo un refresh della stessa scheda."
        },
        {
          "title": "Condividi l’immagine",
          "body": "Premi Condividi risultato. Se il browser supporta la condivisione di file, scegli un’app nel menu del dispositivo; altrimenti scarica il PNG e condividilo manualmente. L’immagine contiene il tuo risultato, non PIN, credenziali o nomi degli altri partecipanti."
        },
        {
          "title": "Chiudi la finestra",
          "body": "Premi Condividi risultato. Scegli un’app dal menu del dispositivo oppure scarica il PNG. L’immagine include titolo del quiz, nome e avatar del giocatore, podio e classifica completa con i nomi dei partecipanti. PIN e credenziali sono esclusi."
        }
      ]
    },
    "problems": {
      "title": "Risolvere i problemi più comuni",
      "summary": "Controlli pratici per rete, video e contenuti mancanti.",
      "audience": "both",
      "needs": "Il messaggio di errore e l’accesso al dispositivo del docente.",
      "steps": [
        {
          "title": "Il telefono non entra",
          "body": "Verifica che il docente abbia avviato l’app e che la partita sia ancora aperta. Scansiona il QR attuale. Sulla LAN usa la stessa rete Wi-Fi; fuori dalla LAN serve il link pubblico della condivisione Internet."
        },
        {
          "title": "Cloudflare non si collega",
          "body": "Apri il pannello della condivisione e leggi l’errore. Controlla Internet e le restrizioni di firewall o proxy con il referente della rete. Se il download richiesto non è più disponibile, aggiorna Qurioso. Consulta i riferimenti ufficiali senza disabilitare le protezioni del computer.",
          "action": "cloudflareDocs"
        },
        {
          "title": "Video fermo o non disponibile",
          "body": "Verifica il file o il link, attendi il caricamento e controlla la connessione ai servizi esterni. Dopo un recupero della gara il video resta in pausa: riprendilo quando sei pronto. Se necessario scegli una nuova sorgente; Esc esce dallo schermo intero."
        },
        {
          "title": "Non trovo più i miei quiz",
          "body": "Apri lo stesso browser o la stessa app usati per salvarli. La biblioteca non si sincronizza tra dispositivi e può andare persa cancellando i dati del browser. Per recuperarla da una copia usa Importa backup nelle Impostazioni."
        }
      ]
    }
  },
  "en": {
    "start": {
      "title": "Choose how to use Qurioso",
      "summary": "Find out when the browser is enough and when you need the desktop app.",
      "audience": "both",
      "needs": "A browser on the teacher’s computer.",
      "steps": [
        {
          "title": "One answer for the whole class",
          "body": "Choose Classroom activities to project questions, listen to the discussion and select the shared answer yourself. It works on qurioso.it without installing executables; students do not need to connect a phone.",
          "action": "classroom"
        },
        {
          "title": "One answer from each device",
          "body": "Choose Network quizzes when each student should answer individually. The teacher downloads and runs the desktop app; participants use a browser on their phone or computer.",
          "action": "downloads"
        },
        {
          "title": "Same network or the Internet",
          "body": "On the same LAN or Wi-Fi you do not need Cloudflare. For people joining from other networks, enable Internet sharing in the desktop app. The qurioso.it website does not host games, and installing it as a web app does not add a server."
        },
        {
          "title": "Keep your content",
          "body": "The website and desktop app have separate libraries. Create or edit quizzes in either version and use a backup from Settings to transfer them. Changing browser or device does not automatically synchronize the library."
        }
      ]
    },
    "classroom": {
      "title": "Run a classroom activity",
      "summary": "One screen, a discussion and a shared answer.",
      "audience": "both",
      "needs": "The teacher’s computer; a projector or large display if you want to show the questions.",
      "steps": [
        {
          "title": "Open the library",
          "body": "On the website choose Classroom activities from the home page; in the desktop app select Classroom lesson. Use an included quiz or create your own. No server or registration is required.",
          "action": "classroom"
        },
        {
          "title": "Choose a quiz",
          "body": "Press Classroom activities on a quiz card. If it contains a video, the activity opens with video and checkpoint questions."
        },
        {
          "title": "Discuss and answer",
          "body": "Show the question, allow time for discussion and select the agreed answer on your device. There is no time limit for the shared answer in this mode."
        },
        {
          "title": "Read the explanation and continue",
          "body": "Review the outcome and any explanation, then move to the next question. In video quizzes, resume playback when the class is ready. At the end, view the summary or leave."
        }
      ]
    },
    "network": {
      "title": "Host a network quiz",
      "summary": "Prepare the teacher’s computer and let participants join.",
      "audience": "desktop",
      "needs": "The desktop app on the teacher’s computer, with participants’ devices on the same LAN or Wi-Fi.",
      "steps": [
        {
          "title": "Download and run the app",
          "body": "Open downloads from the home page and choose the Windows, macOS or Linux version. Run Qurioso on the teacher’s computer: the website alone cannot host a network game.",
          "action": "downloads"
        },
        {
          "title": "Open a network quiz",
          "body": "In the desktop app select Quiz on participants’ devices, then Network video quiz on the Tipi di vulcani con geopop card. This included quiz remains available in previously saved libraries too. Start your own quizzes with valid checkpoints in the same way."
        },
        {
          "title": "Show the address, PIN and QR code",
          "body": "In the lobby show participants the game QR code. Alternatively, give them the server address and PIN. For LAN access choose an address other devices can reach, not localhost or 127.0.0.1."
        },
        {
          "title": "Wait for participants and start",
          "body": "Check the names in the lobby. When everyone is ready, press the start button. Participants see answer controls; complete questions and answers appear on the teacher’s screen."
        },
        {
          "title": "Run the game",
          "body": "Show results and rankings between questions, then continue to the next question or resume the video. Show the final ranking at the end. Keep the app open throughout the game."
        }
      ]
    },
    "participant": {
      "title": "Join from a phone",
      "summary": "Enter a game and answer without scrolling through long text.",
      "audience": "web",
      "needs": "The teacher’s link or QR code; for LAN play, the phone must be on the same network.",
      "steps": [
        {
          "title": "Open the teacher’s link",
          "body": "Scan the QR code or open the link you received. No app installation is required. A PIN alone entered on qurioso.it cannot locate the game on the teacher’s computer."
        },
        {
          "title": "Choose a name and avatar",
          "body": "Enter your name or nickname, choose an avatar and join. Wait in the lobby for the game to start. Avoid opening several tabs for the same participation."
        },
        {
          "title": "Look at the teacher’s screen and choose",
          "body": "On your phone, read and tap the full answer text. Qurioso uses the available space and adapts the font to the text length and screen size, including after rotating your phone."
        },
        {
          "title": "Wait for confirmation",
          "body": "After Answer sent, wait for the outcome and next question. Reloading the same page recovers your identity when the browser can retain the credential. At the end, you can view your result, share it or close the window."
        }
      ]
    },
    "create": {
      "title": "Create a quiz and new categories",
      "summary": "Set a title, add questions and images, and save to the library.",
      "audience": "both",
      "needs": "The library open in a browser or the desktop app.",
      "steps": [
        {
          "title": "Create or edit",
          "body": "Press Create quiz for a new quiz, or Edit on an existing quiz card. Duplicate an existing quiz first if you want to keep the original.",
          "action": "library"
        },
        {
          "title": "Enter a title and category",
          "body": "Enter the title you want to display and a description. In Category, select a suggestion or type a new name: you do not need to create a separate category first."
        },
        {
          "title": "Prepare the questions",
          "body": "Add multiple-choice or true/false questions. Write clear options, select the correct answer and add an explanation when useful. Check the time limit and points for network play."
        },
        {
          "title": "Add images and credits",
          "body": "Choose a cover and, where useful, question images. For Wikimedia Commons images, retain the title, creator, license and source link: downloading an image does not remove attribution requirements."
        },
        {
          "title": "Save and try it",
          "body": "Press Save Quiz and check the title and cover in the library. Open a classroom activity to review questions and answers, then export a backup to keep or transfer them."
        }
      ]
    },
    "video": {
      "title": "Prepare a video quiz",
      "summary": "Attach questions to the right moments in the video.",
      "audience": "both",
      "needs": "A video quiz and a supported file or a YouTube or Vimeo link.",
      "steps": [
        {
          "title": "Create a video quiz",
          "body": "Press Create video quiz in the library. Give it a recognizable title and choose the video file or link. Wait for loading before setting times."
        },
        {
          "title": "Prepare the questions",
          "body": "Write questions and answers in the editor. A question in the quiz is not automatically a checkpoint: attach it to the moment you want."
        },
        {
          "title": "Attach a checkpoint",
          "body": "Move the video to the point where it should pause and use the timeline to add or attach a question. Check the checkpoint list and apply any time changes."
        },
        {
          "title": "Check order and source",
          "body": "Check that every intended question is attached and the times are in the right order. For a local file, make sure it is available on the teacher’s computer. YouTube and Vimeo require access to their respective services."
        },
        {
          "title": "Save, test and present",
          "body": "Save and test the quiz. In network games the video appears on the teacher’s screen; phones show answer controls. Starting requests fullscreen: Esc exits and the video button lets you enter again."
        }
      ]
    },
    "internet": {
      "title": "Share outside the LAN with Cloudflare",
      "summary": "Create a temporary Internet link from the desktop app.",
      "audience": "desktop",
      "needs": "The desktop app, Internet on the teacher’s computer and a network game.",
      "steps": [
        {
          "title": "Enable the feature",
          "body": "Open a network game. Qurioso asks whether to use the LAN only or start Cloudflare; there is no global preference in Settings. Opening the choice does not start a download or tunnel."
        },
        {
          "title": "Read the service information",
          "body": "The feature is optional and experimental, requires no account and has no uptime guarantee. Traffic, including names and answers, passes through Cloudflare. Anyone with the link can reach the participant page.",
          "action": "cloudflareDocs"
        },
        {
          "title": "Start sharing from the game",
          "body": "Press Start sharing after reading the service information. The modal closes and the teacher status shows download and connection progress. Outside fullscreen, the Cloudflare switch stops and restarts the tunnel with one click after the first authorization for that game."
        },
        {
          "title": "Test from another network",
          "body": "When the status turns green and the trycloudflare.com link appears, the displayed address and QR code automatically switch to the public link. If the tunnel is interrupted or stopped, they return to the LAN address. Share the current link or updated QR code. To test, turn off Wi-Fi on a phone and use mobile data. Do not use the teacher’s localhost address on the phone."
        },
        {
          "title": "Stop sharing or resolve an error",
          "body": "Keep the computer on and the app open. Stop sharing closes the tunnel; leaving the game, reloading or closing the app also stops it. If downloading or connecting fails, read the error, consult Cloudflare documentation or status, and retry. The new link may change.",
          "action": "status"
        }
      ]
    },
    "backup": {
      "title": "Save and transfer the library",
      "summary": "Create a ZIP backup and restore it in another version.",
      "audience": "both",
      "needs": "The library you want to keep and enough space for the backup file.",
      "steps": [
        {
          "title": "Open data management",
          "body": "Open Settings from the library. Under Data, use Export backup or Import backup. Backups include saved content, not edits still open in the editor."
        },
        {
          "title": "Export the backup",
          "body": "Press Export backup, check the estimated size and choose whether to include local videos. Create the ZIP backup and verify that the file was actually saved on the device."
        },
        {
          "title": "Open it on the destination",
          "body": "To move from the website to the desktop app or another browser, open Qurioso there, go to Settings and press Import backup. Select the ZIP and check the preview before confirming."
        },
        {
          "title": "Choose how to restore",
          "body": "Add to library keeps existing quizzes. Replacement updates the selected ones; restoring the whole library replaces all saved quizzes and requires explicit confirmation. Keep a copy of the current library first."
        },
        {
          "title": "Check videos and external links",
          "body": "After restoring, check quizzes and images. Relink any local video not included in the backup. External links remain links and may require Internet. The backup does not enable Cloudflare on the new device."
        }
      ]
    },
    "import": {
      "title": "Import questions or a quiz",
      "summary": "Use CSV, JSON and preview without accidentally overwriting content.",
      "audience": "both",
      "needs": "A CSV/TSV or JSON file; question imports support up to 5 MiB and 1000 records.",
      "steps": [
        {
          "title": "Choose what to import",
          "body": "To add questions only, open Import questions in Settings or the editor. To restore a complete quiz, use the editor’s complete quiz import. Use a ZIP backup for a whole library."
        },
        {
          "title": "Load and configure the file",
          "body": "Select CSV/TSV or JSON. For CSV, check the separator, headings and column mapping. Download the CSV template as a starting point if useful. Use UTF-8 to preserve accented characters."
        },
        {
          "title": "Review the preview",
          "body": "Read errors and possible duplicates. Select valid questions and choose a new or existing destination quiz. The preview does not save anything to the library yet."
        },
        {
          "title": "Confirm and save in the editor",
          "body": "Open the result in the editor, check questions and answers, then press Save Quiz. In video quizzes, imported questions do not automatically receive a checkpoint: attach them in the timeline."
        }
      ]
    },
    "results": {
      "title": "Share your result and close",
      "summary": "What happens on the phone when a game ends.",
      "audience": "web",
      "needs": "A network game completed as a participant.",
      "steps": [
        {
          "title": "Read the final result",
          "body": "At the end you see your score, position and the final ranking. There are no restart or continue controls. The summary can remain available after reloading the same tab."
        },
        {
          "title": "Share the image",
          "body": "Press Share result. If the browser supports file sharing, choose an app in the device menu; otherwise download the PNG and share it manually. The image contains your result, not the PIN, credentials or other participants’ names."
        },
        {
          "title": "Close the window",
          "body": "Press Share result. Choose an app in the device menu or download the PNG. The image includes the quiz title, player name and avatar, podium and complete ranking with participant names. PIN and credentials are excluded."
        }
      ]
    },
    "problems": {
      "title": "Solve common problems",
      "summary": "Practical checks for networks, videos and missing content.",
      "audience": "both",
      "needs": "The error message and access to the teacher’s device.",
      "steps": [
        {
          "title": "A phone cannot join",
          "body": "Check that the teacher has started the app and the game is still open. Scan the current QR code. On the LAN, use the same Wi-Fi network; outside it, use the public Internet sharing link."
        },
        {
          "title": "Cloudflare cannot connect",
          "body": "Open the sharing panel and read the error. Check Internet access and firewall or proxy restrictions with your network administrator. If the required download is no longer available, update Qurioso. Consult official references without disabling device protections.",
          "action": "cloudflareDocs"
        },
        {
          "title": "Video paused or unavailable",
          "body": "Check the file or link, wait for loading and check access to external services. After game recovery the video stays paused: resume it when ready. Choose a new source if needed; Esc exits fullscreen."
        },
        {
          "title": "My quizzes are missing",
          "body": "Open the same browser or app you used to save them. The library is not synchronized between devices and can be lost when browser data is cleared. Use Import backup in Settings to restore a saved copy."
        }
      ]
    }
  },
  "de": {
    "start": {
      "title": "Die passende Nutzung wählen",
      "summary": "Erfahre, wann der Browser ausreicht und wann du die Desktop-App brauchst.",
      "audience": "both",
      "needs": "Ein Browser auf dem Computer der Lehrkraft.",
      "steps": [
        {
          "title": "Eine Antwort für die ganze Klasse",
          "body": "Wähle Klassenaktivitäten, um Fragen zu projizieren, die Diskussion zu begleiten und die gemeinsame Antwort selbst auszuwählen. Das funktioniert auf qurioso.it ohne ausführbare Programme; die Lernenden müssen kein Telefon verbinden.",
          "action": "classroom"
        },
        {
          "title": "Eine Antwort pro Gerät",
          "body": "Wähle Netzwerkquiz, wenn alle einzeln antworten sollen. Die Lehrkraft lädt die Desktop-App herunter und startet sie; die Teilnehmenden nutzen den Browser auf ihrem Telefon oder Computer.",
          "action": "downloads"
        },
        {
          "title": "Gleiches Netzwerk oder Internet",
          "body": "Im selben LAN oder WLAN brauchst du kein Cloudflare. Für Teilnehmende aus anderen Netzwerken kannst du die Internetfreigabe in der Desktop-App aktivieren. Die Website qurioso.it betreibt keine Spiele; die Installation als Web-App fügt keinen Server hinzu."
        },
        {
          "title": "Eigene Inhalte behalten",
          "body": "Website und Desktop-App haben getrennte Bibliotheken. Erstelle oder bearbeite Quiz in einer der Versionen und übertrage sie mit einem Backup aus den Einstellungen. Ein Browser- oder Gerätewechsel synchronisiert die Bibliothek nicht automatisch."
        }
      ]
    },
    "classroom": {
      "title": "Eine Klassenaktivität durchführen",
      "summary": "Ein Bildschirm, gemeinsame Diskussion und Antwort.",
      "audience": "both",
      "needs": "Den Computer der Lehrkraft; bei Bedarf einen Projektor oder großen Bildschirm.",
      "steps": [
        {
          "title": "Bibliothek öffnen",
          "body": "Wähle auf der Website Klassenaktivitäten; in der Desktop-App wählst du Unterricht im Klassenraum. Nutze ein enthaltenes Quiz oder erstelle ein eigenes. Dafür sind weder ein Server noch eine Registrierung erforderlich.",
          "action": "classroom"
        },
        {
          "title": "Quiz auswählen",
          "body": "Klicke auf der Quizkarte auf Klassenaktivitäten. Enthält das Quiz ein Video, öffnet sich die Aktivität mit Video und Checkpoint-Fragen."
        },
        {
          "title": "Diskutieren und antworten",
          "body": "Zeige die Frage, lass Zeit zur Diskussion und wähle die vereinbarte Antwort auf deinem Gerät. Für die gemeinsame Antwort gibt es in diesem Modus kein Zeitlimit."
        },
        {
          "title": "Erklärung lesen und fortfahren",
          "body": "Besprecht das Ergebnis und eine vorhandene Erklärung, dann geht zur nächsten Frage. Setze bei Videoquiz die Wiedergabe fort, wenn die Klasse bereit ist. Am Ende kannst du die Zusammenfassung ansehen oder die Aktivität verlassen."
        }
      ]
    },
    "network": {
      "title": "Ein Netzwerkquiz leiten",
      "summary": "Bereite den Computer der Lehrkraft vor und lasse die Teilnehmenden beitreten.",
      "audience": "desktop",
      "needs": "Die Desktop-App auf dem Computer der Lehrkraft und alle Geräte im selben LAN oder WLAN.",
      "steps": [
        {
          "title": "App herunterladen und starten",
          "body": "Öffne die Downloads auf der Startseite und wähle Windows, macOS oder Linux. Starte Qurioso auf dem Computer der Lehrkraft: Die Website allein kann kein Netzwerkspiel leiten.",
          "action": "downloads"
        },
        {
          "title": "Netzwerkquiz öffnen",
          "body": "Wähle in der Desktop-App Quiz auf den Geräten und dann Video-Netzwerkquiz auf der Karte Tipi di vulcani con geopop. Dieses enthaltene Quiz bleibt auch in gespeicherten Bibliotheken verfügbar. Eigene Quiz mit gültigen Checkpoints startest du genauso."
        },
        {
          "title": "Adresse, PIN und QR-Code zeigen",
          "body": "Zeige den Teilnehmenden in der Lobby den QR-Code des Spiels. Alternativ gibst du Serveradresse und PIN weiter. Wähle im LAN eine für andere Geräte erreichbare Adresse, nicht localhost oder 127.0.0.1."
        },
        {
          "title": "Auf Beitritte warten und starten",
          "body": "Prüfe die Namen in der Lobby. Starte das Spiel, wenn alle bereit sind. Die Teilnehmenden sehen die Antwortschaltflächen; vollständige Fragen und Antworten stehen auf dem Bildschirm der Lehrkraft."
        },
        {
          "title": "Das Spiel leiten",
          "body": "Zeige zwischen den Fragen Ergebnisse und Ranglisten und gehe dann zur nächsten Frage oder setze das Video fort. Zeige am Ende die Endrangliste. Lass die App während des gesamten Spiels geöffnet."
        }
      ]
    },
    "participant": {
      "title": "Mit dem Telefon teilnehmen",
      "summary": "Tritt einem Spiel bei und antworte ohne durch lange Texte zu scrollen.",
      "audience": "web",
      "needs": "Den Link oder QR-Code der Lehrkraft; bei LAN-Spielen muss das Telefon im selben Netzwerk sein.",
      "steps": [
        {
          "title": "Link der Lehrkraft öffnen",
          "body": "Scanne den QR-Code oder öffne den erhaltenen Link. Du musst keine App installieren. Eine PIN allein auf qurioso.it findet das Spiel auf dem Computer der Lehrkraft nicht."
        },
        {
          "title": "Name und Avatar wählen",
          "body": "Gib deinen Namen oder Spitznamen ein, wähle einen Avatar und tritt bei. Warte in der Lobby auf den Spielstart. Öffne möglichst nicht mehrere Tabs für dieselbe Teilnahme."
        },
        {
          "title": "Auf den Bildschirm schauen und wählen",
          "body": "Lies und tippe auf deinem Telefon auf den vollständigen Antworttext. Qurioso nutzt den verfügbaren Platz und passt die Schrift an Textlänge und Bildschirmgröße an, auch nach dem Drehen des Telefons."
        },
        {
          "title": "Bestätigung abwarten",
          "body": "Warte nach der gesendeten Antwort auf das Ergebnis und die nächste Frage. Beim Neuladen derselben Seite wird deine Identität wiederhergestellt, wenn der Browser die Zugangsdaten speichern kann. Am Ende bleiben Ergebnis, Teilen und Schließen."
        }
      ]
    },
    "create": {
      "title": "Ein Quiz und neue Kategorien erstellen",
      "summary": "Titel, Fragen und Bilder hinzufügen und in der Bibliothek speichern.",
      "audience": "both",
      "needs": "Die geöffnete Bibliothek im Browser oder in der Desktop-App.",
      "steps": [
        {
          "title": "Erstellen oder bearbeiten",
          "body": "Wähle Quiz erstellen für ein neues Quiz oder Bearbeiten auf einer vorhandenen Quizkarte. Dupliziere ein vorhandenes Quiz zuerst, wenn du das Original behalten möchtest.",
          "action": "library"
        },
        {
          "title": "Titel und Kategorie eingeben",
          "body": "Trage den gewünschten Titel und eine Beschreibung ein. Wähle im Feld Kategorie einen Vorschlag oder schreibe einen neuen Namen: Du musst keine separate Kategorie vorher anlegen."
        },
        {
          "title": "Fragen vorbereiten",
          "body": "Füge Multiple-Choice- oder Wahr/Falsch-Fragen hinzu. Schreibe klare Antworten, markiere die richtige und ergänze bei Bedarf eine Erklärung. Prüfe Zeitlimit und Punkte für das Netzwerkspiel."
        },
        {
          "title": "Bilder und Nachweise hinzufügen",
          "body": "Wähle ein Titelbild und bei Bedarf Bilder für Fragen. Bewahre bei Wikimedia Commons Titel, Urheber, Lizenz und Quelllink auf: Das Herunterladen hebt die Pflicht zur Namensnennung nicht auf."
        },
        {
          "title": "Speichern und ausprobieren",
          "body": "Speichere das Quiz und prüfe Titel und Titelbild in der Bibliothek. Öffne eine Klassenaktivität, um Fragen und Antworten zu kontrollieren, und exportiere anschließend ein Backup zum Aufbewahren oder Übertragen."
        }
      ]
    },
    "video": {
      "title": "Ein Videoquiz vorbereiten",
      "summary": "Verknüpfe Fragen mit den passenden Stellen im Video.",
      "audience": "both",
      "needs": "Ein Videoquiz und eine unterstützte Datei oder einen YouTube- oder Vimeo-Link.",
      "steps": [
        {
          "title": "Videoquiz erstellen",
          "body": "Wähle Videoquiz erstellen in der Bibliothek. Vergib einen erkennbaren Titel und wähle die Videodatei oder den Link. Warte auf das Laden, bevor du Zeiten festlegst."
        },
        {
          "title": "Fragen vorbereiten",
          "body": "Schreibe Fragen und Antworten im Editor. Eine Frage im Quiz ist nicht automatisch ein Checkpoint: Verknüpfe sie mit der gewünschten Stelle."
        },
        {
          "title": "Checkpoint verknüpfen",
          "body": "Gehe zur Videostelle, an der es pausieren soll, und füge über die Zeitleiste eine Frage hinzu oder ordne sie zu. Prüfe die Checkpoint-Liste und übernimm geänderte Zeiten."
        },
        {
          "title": "Reihenfolge und Quelle prüfen",
          "body": "Prüfe, ob jede vorgesehene Frage verknüpft ist und die Zeiten richtig geordnet sind. Eine lokale Datei muss auf dem Computer der Lehrkraft verfügbar sein. YouTube und Vimeo benötigen Zugriff auf ihre jeweiligen Dienste."
        },
        {
          "title": "Speichern, testen und zeigen",
          "body": "Speichere und teste das Quiz. Im Netzwerkspiel erscheint das Video auf dem Bildschirm der Lehrkraft; Telefone zeigen Antwortschaltflächen. Beim Start wird Vollbild angefordert: Esc beendet es, die Videoschaltfläche aktiviert es erneut."
        }
      ]
    },
    "internet": {
      "title": "Über Cloudflare außerhalb des LANs teilen",
      "summary": "Erstelle mit der Desktop-App einen vorübergehenden Internetlink.",
      "audience": "desktop",
      "needs": "Die Desktop-App, Internet auf dem Computer der Lehrkraft und ein Netzwerkspiel.",
      "steps": [
        {
          "title": "Funktion aktivieren",
          "body": "Öffne ein Netzwerkspiel. Qurioso fragt, ob nur das LAN oder Cloudflare genutzt werden soll; eine globale Voreinstellung entfällt. Das Öffnen dieser Auswahl startet weder Download noch Tunnel."
        },
        {
          "title": "Serviceinformationen lesen",
          "body": "Die Funktion ist optional und experimentell, erfordert kein Konto und garantiert keine Verfügbarkeit. Datenverkehr einschließlich Namen und Antworten läuft über Cloudflare. Alle mit dem Link können die Teilnahmeseite erreichen.",
          "action": "cloudflareDocs"
        },
        {
          "title": "Freigabe im Spiel starten",
          "body": "Lies die Informationen und wähle Freigabe starten. Das Fenster schließt sich; der Status der Lehrkraft zeigt Download und Verbindungsaufbau. Außerhalb des Vollbilds beendet und startet der Cloudflare-Schalter den Tunnel nach der ersten Bestätigung für dieses Spiel mit einem Klick."
        },
        {
          "title": "Aus einem anderen Netzwerk testen",
          "body": "Wenn der Status grün wird und der trycloudflare.com-Link erscheint, wechseln Adresse und QR-Code automatisch zum öffentlichen Link. Bei einer Unterbrechung oder nach dem Beenden zeigen sie wieder die LAN-Adresse. Teile den aktuellen Link oder QR-Code. Schalte für einen Test das WLAN am Telefon aus und nutze mobile Daten. Verwende auf dem Telefon nicht die localhost-Adresse der Lehrkraft."
        },
        {
          "title": "Freigabe beenden oder Fehler beheben",
          "body": "Lass Computer und App eingeschaltet. Freigabe beenden schließt den Tunnel; auch das Verlassen des Spiels, Neuladen oder Schließen der App beendet ihn. Lies bei Download- oder Verbindungsfehlern die Meldung, prüfe Cloudflare-Dokumentation oder Status und versuche es erneut. Der neue Link kann anders sein.",
          "action": "status"
        }
      ]
    },
    "backup": {
      "title": "Bibliothek sichern und übertragen",
      "summary": "Erstelle ein ZIP-Backup und stelle es in einer anderen Version wieder her.",
      "audience": "both",
      "needs": "Die zu sichernde Bibliothek und ausreichend Speicherplatz für das Backup.",
      "steps": [
        {
          "title": "Datenverwaltung öffnen",
          "body": "Öffne die Einstellungen aus der Bibliothek. Unter Daten findest du Backup exportieren und Backup importieren. Backups enthalten gespeicherte Inhalte, keine noch offenen Änderungen im Editor."
        },
        {
          "title": "Backup exportieren",
          "body": "Wähle Backup exportieren, prüfe die geschätzte Größe und entscheide, ob lokale Videos enthalten sein sollen. Erstelle das ZIP-Backup und prüfe, ob die Datei tatsächlich auf dem Gerät gespeichert wurde."
        },
        {
          "title": "Am Ziel öffnen",
          "body": "Um von der Website zur Desktop-App oder zu einem anderen Browser zu wechseln, öffne Qurioso dort, gehe zu Einstellungen und wähle Backup importieren. Wähle das ZIP aus und prüfe vor der Bestätigung die Vorschau."
        },
        {
          "title": "Art der Wiederherstellung wählen",
          "body": "Zur Bibliothek hinzufügen behält vorhandene Quiz. Beim Ersetzen werden ausgewählte Quiz aktualisiert; die vollständige Wiederherstellung ersetzt alle gespeicherten Quiz und erfordert eine ausdrückliche Bestätigung. Sichere zuerst die aktuelle Bibliothek."
        },
        {
          "title": "Videos und externe Links prüfen",
          "body": "Prüfe nach der Wiederherstellung Quiz und Bilder. Verknüpfe lokale Videos neu, die im Backup fehlten. Externe Links bleiben Links und können Internet benötigen. Das Backup aktiviert Cloudflare nicht auf dem neuen Gerät."
        }
      ]
    },
    "import": {
      "title": "Fragen oder ein Quiz importieren",
      "summary": "Nutze CSV, JSON und Vorschau ohne versehentliches Überschreiben.",
      "audience": "both",
      "needs": "Eine CSV/TSV- oder JSON-Datei; für Fragen bis zu 5 MiB und 1000 Datensätze.",
      "steps": [
        {
          "title": "Importart wählen",
          "body": "Für einzelne Fragen öffnest du Fragen importieren in den Einstellungen oder im Editor. Für ein vollständiges Quiz verwendest du den entsprechenden Import im Editor. Für eine ganze Bibliothek nutzt du ein ZIP-Backup."
        },
        {
          "title": "Datei laden und konfigurieren",
          "body": "Wähle CSV/TSV oder JSON. Prüfe bei CSV Trennzeichen, Überschriften und Spaltenzuordnung. Lade bei Bedarf die CSV-Vorlage als Ausgangspunkt herunter. Verwende UTF-8, um Umlaute und Akzente zu erhalten."
        },
        {
          "title": "Vorschau prüfen",
          "body": "Lies Fehlermeldungen und Hinweise auf mögliche Duplikate. Wähle gültige Fragen und ein neues oder vorhandenes Zielquiz aus. Die Vorschau speichert noch nichts in der Bibliothek."
        },
        {
          "title": "Bestätigen und im Editor speichern",
          "body": "Öffne das Ergebnis im Editor, prüfe Fragen und Antworten und speichere das Quiz. Importierte Fragen erhalten in Videoquiz nicht automatisch einen Checkpoint: Ordne sie in der Zeitleiste zu."
        }
      ]
    },
    "results": {
      "title": "Ergebnis teilen und schließen",
      "summary": "Was nach dem Spiel auf dem Telefon passiert.",
      "audience": "web",
      "needs": "Ein als Teilnehmer abgeschlossenes Netzwerkspiel.",
      "steps": [
        {
          "title": "Endergebnis lesen",
          "body": "Am Ende siehst du Punktzahl, Platzierung und Endrangliste. Es gibt keine Schaltflächen zum Neustarten oder Fortsetzen. Die Zusammenfassung kann nach dem Neuladen desselben Tabs verfügbar bleiben."
        },
        {
          "title": "Bild teilen",
          "body": "Wähle Ergebnis teilen. Unterstützt der Browser Dateifreigaben, wählst du eine App im Gerätemenü. Sonst lädst du das PNG herunter und teilst es manuell. Das Bild enthält dein Ergebnis, nicht PIN, Zugangsdaten oder Namen anderer Teilnehmender."
        },
        {
          "title": "Fenster schließen",
          "body": "Wähle Ergebnis teilen. Wähle eine App im Gerätemenü oder lade das PNG herunter. Es enthält Quiztitel, Spielername und Avatar, Podium und vollständige Rangliste mit den Namen der Teilnehmenden. PIN und Zugangsdaten sind ausgeschlossen."
        }
      ]
    },
    "problems": {
      "title": "Häufige Probleme lösen",
      "summary": "Praktische Prüfungen bei Netzwerk-, Video- und Inhaltsproblemen.",
      "audience": "both",
      "needs": "Die Fehlermeldung und Zugang zum Gerät der Lehrkraft.",
      "steps": [
        {
          "title": "Ein Telefon kann nicht beitreten",
          "body": "Prüfe, ob die Lehrkraft die App gestartet hat und das Spiel noch offen ist. Scanne den aktuellen QR-Code. Nutze im LAN dasselbe WLAN; außerhalb davon den öffentlichen Link der Internetfreigabe."
        },
        {
          "title": "Cloudflare verbindet sich nicht",
          "body": "Öffne das Freigabefenster und lies den Fehler. Prüfe Internetzugang und Firewall- oder Proxy-Beschränkungen mit der Netzwerkbetreuung. Ist der erforderliche Download nicht mehr verfügbar, aktualisiere Qurioso. Nutze offizielle Hinweise, ohne Schutzmaßnahmen am Gerät abzuschalten.",
          "action": "cloudflareDocs"
        },
        {
          "title": "Video pausiert oder nicht verfügbar",
          "body": "Prüfe Datei oder Link, warte auf das Laden und kontrolliere den Zugang zu externen Diensten. Nach einer Spielwiederherstellung bleibt das Video pausiert: Setze es fort, wenn du bereit bist. Wähle bei Bedarf eine neue Quelle; Esc beendet das Vollbild."
        },
        {
          "title": "Meine Quiz fehlen",
          "body": "Öffne denselben Browser oder dieselbe App wie beim Speichern. Die Bibliothek wird nicht zwischen Geräten synchronisiert und kann beim Löschen der Browserdaten verloren gehen. Stelle eine gespeicherte Kopie über Backup importieren in den Einstellungen wieder her."
        }
      ]
    }
  }
};
