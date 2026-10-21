# Editor video, associazioni e futuro backup multimediale

## Uso del docente

Aprire **Modifica** su un quiz video, oppure **Nuovo quiz → Quiz video** nella biblioteca
(o **Crea quiz video** in Impostazioni). Il layout desktop
è organizzato in video/timeline a sinistra, domanda selezionata al centro ed
elenco delle domande a destra; la schermata di riferimento è 1366×768 al 100%.
Su finestre più strette i pannelli si dispongono verticalmente e scorrono.

1. Espandere **Sorgente video** e caricare MP4/WebM o applicare un link
   YouTube/Vimeo con **Usa link**. Il cambio di sorgente conserva tutte le domande
   e i checkpoint; la nuova durata può renderne alcuni non validi.
2. Guardare il filmato e premere **Aggiungi domanda qui**. Il lettore viene
   fermato e viene acquisito il `currentTime` effettivamente riportato dal media.
3. **Crea nuova domanda qui** apre il normale editor della domanda; in alternativa
   scegliere una domanda esistente e **Associa qui**. Se era già associata, si
   sposta il suo checkpoint senza duplicare la domanda.
4. Selezionare un marcatore o una voce dell'elenco cronologico. Le domande allo
   stesso istante sono raggruppate nel marcatore con un conteggio; ciascuna rimane
   selezionabile separatamente nell'elenco.
5. Modificare il tempo con `mm:ss`, `hh:mm:ss` (anche decimali), quindi **Applica
   tempo** o Invio. Il salvataggio resta disabilitato finché questa modifica non
   è confermata. Lo slider del checkpoint supporta mouse/touch e tastiera
   (frecce: 0,1 s); **Vai al checkpoint** effettua il seek.
6. **Rimuovi checkpoint** lascia la domanda nell'elenco **Non associate**.
   **Domanda associata** permette di sostituirla con una domanda non associata.
   Una domanda ha al massimo un checkpoint; più domande possono condividere un
   timestamp. A parità di tempo l'ordine è quello delle domande nel quiz,
   modificabile con i comandi di ordinamento già presenti.
7. **Prova attività** usa il lettore classroom su una copia preparata del quiz.
   Non crea stanze o connessioni multiplayer e non salva punteggi o risultati.
   Le domande simultanee vengono esaurite prima di riavviare il video. La fine
   mostra **Attività conclusa** e permette di tornare all'editor, conservando il
   lavoro in memoria.

Le domande preparate prima del video possono rimanere non associate fino alla
scelta dei punti. Salvare un quiz incompleto è consentito, ma l'avvio multiplayer
richiede almeno una domanda associata. L'anteprima richiede anch'essa almeno un
checkpoint. Nessuna nuova tipologia di domanda è stata aggiunta.

## Compatibilità del modello

I checkpoint continuano a usare `{ questionId, timestamp }` in
`videoConfig.checkpoints`. È stato aggiunto il solo discriminante facoltativo
`videoConfig.checkpointMode: "explicit"`, necessario per distinguere una domanda
volutamente non associata da un vecchio quiz con checkpoint impliciti.

- Senza discriminante, rimane la precedenza storica: `question.videoTimestamp`,
  checkpoint salvato, infine default `(indice + 1) * 10`.
- Aprendo il quiz nell'editor, i tempi effettivi legacy vengono materializzati in
  una lista esplicita, senza modificare il quiz originale fino al salvataggio.
- Con discriminante, soltanto la lista esplicita definisce le associazioni.
  `videoTimestamp` viene aggiornato per le domande associate/rimosso per quelle
  scollegate, ma non genera più checkpoint aggiuntivi.
- Il lettore classroom e il multiplayer usano la stessa funzione di risoluzione.
  Il presentatore passa al protocollo multiplayer esistente solo le domande
  associate nell'ordine cronologico: formato dei messaggi, sicurezza e punteggi
  restano invariati. Il quiz salvato mantiene anche quelle non associate.
- Vecchie versioni dell'app che ignorano il discriminante non possono rappresentare
  fedelmente le nuove domande non associate. La compatibilità garantita è la
  lettura dei quiz precedenti nell'app aggiornata.

Validazione: tempi finiti e non negativi, riferimenti esistenti e una sola
associazione per domanda. Con durata nota, i checkpoint oltre la fine bloccano
salvataggio e anteprima; un comando esplicito può portarli alla fine del filmato.
Non sono mai eliminati automaticamente. Con durata ignota, un avviso informa che
il limite superiore non è verificato. Riferimenti incoerenti importati rimangono
visibili come errori e possono essere rimossi esplicitamente.

YouTube/Vimeo richiedono Internet e permesso di incorporamento. I loro adattatori
espongono tempo e seek, ma eventi, buffering, pause e seek dipendono dal provider:
non si promette precisione al fotogramma. Anche i file locali dipendono dal codec
e dalla cadenza degli eventi del browser. Verificare i punti nell'anteprima reale.
I test dei provider usano media controllati: non certificano i servizi esterni.

## Modifiche non salvate

La bozza usa la chiave separata `editor:draft` nell'object store `library` della
stessa IndexedDB. Non sostituisce la biblioteca salvata. Autosalvataggio con
ritardo di 500 ms; le operazioni sono serializzate per evitare che una scrittura
in ritardo ricrei una bozza appena cancellata. Alla successiva apertura
l'editor propone **Riprendi bozza** o **Scarta bozza**. Il salvataggio del quiz e
l'uscita con scarto esplicito cancellano la bozza.

L'uscita dall'editor chiede conferma per modifiche non salvate; `beforeunload`
protegge refresh/chiusura, nei limiti del browser. Errori di archiviazione sono
segnalati e il lavoro resta aperto/esportabile. La bozza è unica per origine:
più editor contemporanei nello stesso profilo possono sovrascrivere l'ultima
bozza. Un crash nei 500 ms prima della scrittura o durante I/O può perdere gli
ultimi caratteri. La durata deve essere ricaricata dal video dopo il ripristino.

## Video locali e inventario

Il formato IndexedDB esistente non cambia: `videos[id] = Blob/File`.
`videoAssetId` è persistente, `videoFileName` conserva il nome mostrato e `videoUrl`
rimane vuoto per il file caricato. Gli URL `blob:` sono creati soltanto per la
riproduzione e revocati allo smontaggio/cambio sorgente; non vengono salvati come
identificativi. Il salvataggio rifiuta un URL `blob:` come sorgente persistente.

Le normali modifiche a domande, checkpoint, biblioteca e bozza scrivono solo il
riferimento al file: non creano altri Blob in `videos`. Duplicare un quiz può
condividere lo stesso asset. Se un file manca, l'editor ne segnala l'assenza e la
scelta di un nuovo file aggiorna il riferimento senza perdere domande o tempi.

`videoAssetInfo(id)` restituisce ID, byte (`Blob.size`), MIME (`Blob.type`) e,
quando conservato dal browser, nome del File. L'interfaccia mostra nome,
dimensione leggibile e MIME. `inspectVideoAssets()` legge l'inventario e marca i
riferimenti trovati nella biblioteca, nella bozza e nelle copie runtime del
docente. È una verifica in sola lettura, non un'interfaccia di backup o pulizia.

Limiti attuali:

- Ricaricare esplicitamente lo stesso file crea un nuovo ID: non viene ancora
  eseguita deduplicazione per contenuto.
- Cambiare sorgente, scartare un caricamento o cancellare un quiz può lasciare
  asset orfani. Non vengono eliminati automaticamente, perché altre schede o
  attività aperte potrebbero usarli. L'inventario permette di individuarli.
- I quiz JSON già importati con video `data:` continuano a funzionare; quei byte
  restano incorporati nella stringa del quiz, fuori dall'inventario `videos`.
- L'esportazione JSON singola esistente include ancora i file locali in Base64:
  può richiedere molta memoria. Non è il futuro formato di backup della biblioteca.

## Proposta originaria per il backup futuro

Il backup della biblioteca è ora implementato: vedere [LIBRARY_BACKUP.md](LIBRARY_BACKUP.md)
per formato effettivo, transazioni, percorso Dati e limiti. La proposta seguente
resta come analisi storica del Prompt 9.

Preferire ZIP con manifesto JSON versionato e file binari separati, ad esempio:

- `manifest.json`: quiz, impostazioni, domande, checkpoint, metadati delle immagini,
  descriptor degli asset `{ id, name, size, mime, path?, included }` e link esterni.
- `media/<id>.<estensione>`: un solo file per asset locale selezionato.
- YouTube/Vimeo restano URL/riferimenti: nessun download dei loro contenuti.

Il nuovo comando dovrà offrire esplicitamente l'opzione di includere i video.
La stima dovrà distinguere quiz JSON (testi/impostazioni/checkpoint), immagini e
video locali. Usare `Blob.size` per gli asset e la lunghezza UTF-8 del JSON per i
metadati; decodificare la sola dimensione dei vecchi `data:` senza caricarli tutti
in memoria. Evitare doppio conteggio per asset condivisi o immagini incorporate.
Mostrare B/KB/MB/GB, aggiornare subito il totale quando cambia l'opzione e chiarire
che la dimensione finale compressa può differire dalla stima non compressa.

Escludendo i video, conservare sempre descriptor e riferimenti e mostrare prima
dell'esportazione quali file non saranno inclusi. All'importazione tali asset
rimangono mancanti/ricollegabili, non sostituiti da URL temporanei. Il comando di
ricollegamento attuale consente già di ripristinare un file per un singolo quiz;
il backup dovrà aggiungere una mappa degli ID mancanti e aggiornare coerentemente
tutti i riferimenti scelti dall'utente.

Importare prima in staging: validare manifesto e associazioni, confrontare ID e
contenuti con la biblioteca esistente, mostrare conflitti/duplicati e chiedere
scelte esplicite (copia con nuovi ID, riuso dell'asset, sostituzione autorizzata).
Non sovrascrivere automaticamente la biblioteca. Un hash calcolato in streaming
potrà supportare deduplicazione affidabile; nome/size/MIME da soli non provano che
due file abbiano lo stesso contenuto. Commit finale delle modifiche IndexedDB
soltanto dopo la validazione e il riepilogo delle scelte.

Per archivi grandi occorrono lettura/scrittura incrementali, supporto ai limiti
ZIP64 e gestione di spazio insufficiente/interruzioni. Evitare di costruire
contemporaneamente tutte le stringhe Base64, Blob e archivio ZIP in RAM. Valutare
una libreria ZIP con streaming e, dove disponibile, scrittura su file scelta
dall'utente; prevedere limiti espliciti nel fallback basato su download Blob.
Nessuna libreria ZIP, interfaccia di backup o importatore completo è introdotto
in questa fase.

## Collaudo

`videoEditor.test.ts` copre modello legacy/esplicito, tempi e validazione,
cattura/creazione/associazione/rimozione, simultaneità in anteprima, persistenza,
bozze, metadati, assenza di copie dei Blob, media mancanti e adattatori simulati.
`desktop:smoke` aggiunge un renderer reale a 1366×768 e zoom 100%, caricamento
WebM, acquisizione/associazione, salvataggio/riapertura, due domande simultanee,
conclusione classroom senza stanze, refresh della bozza e conteggio degli asset.
Restano le prove reali MP4/WebM con i codec dell'aula, YouTube/Vimeo disponibili,
uso da tastiera/touch e leggibilità sul display/proiettore del docente.
