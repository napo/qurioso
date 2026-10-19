# Quiz video in rete

La scheda di un quiz distingue **Quiz classico in rete** e **Quiz video in rete**.
Il quiz video apre la normale lobby LAN con PIN, QR code e partecipanti, insieme
alla configurazione del video del docente. Il pulsante di avvio attende il
caricamento dei metadati e almeno un partecipante. È possibile sostituire la
sorgente senza modificare il quiz salvato.

Dopo il conto alla rovescia, il video viene riprodotto sul solo dispositivo del
docente. Gli studenti vedono un messaggio di attesa e, ai checkpoint, le normali
domande multiplayer. Restano valide chiusura manuale, scadenza del tempo e
chiusura quando tutti hanno risposto. Risultati e classifica precedono il
pulsante **Riprendi video**. La spiegazione rispetta `showExplanation`.

## Timeline e fine video

- I checkpoint salvati sono ordinati per tempo, conservando l'ordine originale
  in caso di parità. La precedenza di `videoTimestamp` sui checkpoint della
  configurazione è la stessa del lettore classroom.
- L'ordine viene preparato soltanto per la partita: il quiz salvato non cambia.
- Un salto avanti ferma il video alla posizione raggiunta e apre il primo
  checkpoint non svolto attraversato. Dopo i risultati, eventuali altri
  checkpoint attraversati sono aperti uno alla volta, prima della riproduzione.
- Tornare indietro non ripropone le domande già aperte. I risultati non vengono
  cancellati da seek, sostituzione della sorgente o retry.
- La fine del video apre tutte le domande residue, incluse quelle con timestamp
  oltre la durata. Dopo l'ultima classifica, Riprendi video conduce al podio.
- Il multiplayer usa tutti i checkpoint salvati, anche per quiz marcati
  `pauseMode: random`: non rigenera una nuova timeline casuale durante la partita.

## Autorizzazione, dati e punteggi

L'apertura di una domanda passa attraverso la coda autorizzata del presentatore,
con revisione e ID di operazione invariati nei retry. Il server conserva una
definizione privata e immutabile delle domande, senza URL o contenuti video,
asset locali e immagini. Impone ordine delle domande, durata e opzioni canoniche,
rifiuta avanzamenti fuori ordine e impedisce il riepilogo con checkpoint residui.
Il progresso restituito dal server permette di recuperare un'apertura anche
quando si perde la conferma di ricezione.

Per le nuove sessioni **video**, il server calcola i punteggi tramite la stessa
`applyPlayerAnswer` già usata dal multiplayer classico. La formula non cambia.
I tempi restano quelli di ricezione del server, con l'allowance fissa di 100 ms e
l'arrotondamento a 100 ms già esistenti: non si promette precisione al millisecondo.
Il docente non può sovrascrivere punteggi o risposte accettate pubblicando uno
snapshot vecchio. Anche i bot di prova usano la ricezione e il calcolo server.
Il percorso di calcolo del multiplayer classico resta invariato in questa modifica.

Agli studenti non vengono trasmessi video né definizioni private: durante la
domanda ricevono solo opzioni pubbliche e punteggi congelati all'inizio del turno.
Soluzioni e spiegazioni vengono aggiunte dopo la chiusura. Restano validi token
separati, autorizzazione REST/WS, deduplicazione, nonce del turno e limiti dei
messaggi già introdotti.

## Riconnessioni e limiti

Una disconnessione temporanea recupera identità, risposta e punteggio con il token
esistente; la coda del presentatore ritenta la stessa operazione. Il video resta
nel componente montato durante domande e risultati. Gli errori di riproduzione
consentono un nuovo tentativo o la scelta di un'altra sorgente senza ricreare la
partita. Il presentatore può ora recuperare la stessa partita dopo un refresh, con video
in pausa: vedi [PRESENTER_RECOVERY.md](PRESENTER_RECOVERY.md). I token degli studenti sono ora conservati per origine e partita per il
[recupero dopo refresh e chiusura della scheda](PLAYER_RECOVERY.md). Riavviare il server elimina le stanze; il ripristino dopo
chiusura del browser dipende dalla conservazione della scheda da parte del browser.

I file locali rimangono nell'IndexedDB del docente. HTML5, YouTube e Vimeo usano
lo stesso adattatore già impiegato dal lettore classroom; YouTube/Vimeo richiedono
la connessione al provider e il permesso di incorporamento. I test automatici
usano media controllati, non verificano disponibilità o codec dei video reali.
