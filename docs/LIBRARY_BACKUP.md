# Backup e ripristino della biblioteca

Dalla biblioteca aprire **Dati → Esporta backup** oppure **Importa backup**.
I pulsanti **Esporta quiz** e **Importa quiz** aprono l'editor del quiz scelto,
dove rimangono disponibili i comandi JSON del quiz completo. **Importa domande**
è l'importatore CSV/JSON di sole domande, indipendente dal backup.

## Inventario della persistenza

| Archivio | Contenuto | Backup |
| --- | --- | --- |
| IndexedDB `qurioso-library` v2, `library['quizzes']` | Biblioteca salvata, impostazioni dei quiz, attribuzioni, domande, checkpoint, URL | Sì |
| Stesso DB, `videos[id]` | Blob/File originali dei video | Solo referenziati dai quiz salvati, facoltativi |
| Stesso DB, `library['editor:draft']` | Unica bozza editor non salvata | No, salvare prima il quiz |
| Stesso DB, `library['presenter:'+pin]` | Copia privata del quiz dell'attività aperta | No |
| localStorage `qurioso_quizzes` | Biblioteca precedente, migrata in IndexedDB all'apertura | Si usa la biblioteca corrente caricata; non si copia il vecchio archivio |
| localStorage `qurioso_language` | Lingua | Nel manifesto; ripristino facoltativo |
| localStorage recupero studenti | Credenziali private per stanza e puntatore all'ultima partita | Mai |
| sessionStorage recupero docente | Credenziale privata della scheda | Mai |
| Memoria client/server | PIN, sessioni, connessioni, risposte, punteggi | Mai |
| Cache PWA | Applicazione ricostruibile | No |
| Profilo Electron, `update-settings.json`, download installer | Preferenze/installer dell'aggiornamento desktop | No, non contenuti didattici |

Le immagini caricate/Commons sono stringhe `data:` nella copertina o nella
domanda, non record separati in IndexedDB. Il backup le estrae come binari,
conservando le attribuzioni nei quiz. Un'immagine condivisa con lo stesso data URL
compare una sola volta. Immagini esterne e video YouTube/Vimeo rimangono URL:
non viene effettuata alcuna richiesta ai provider durante il backup.
Il numero delle immagini comprende i link esterni unici; il peso delle immagini
riguarda solo i byte incorporati disponibili, non una stima di risorse remote.

I video orfani rispetto alla biblioteca salvata sono contati separatamente con
i byte effettivi. Possono appartenere a bozze o copie runtime; non si esportano
e non si eliminano. Anche dopo un ripristino completo vengono conservati: non
si presume che nessun'altra scheda li usi.

## Formato ZIP v1

```
manifest.json
media/<asset-id>
media/<altro-asset-id>
```

Il manifesto UTF-8 contiene:

- `format: "qurioso-library"`, `version: 1`, `appVersion`, `createdAt` ISO;
- `settings: {language?}`: nessuna copia generica delle preferenze/storage;
- `quizzes`: schema Quiz didattico esplicitamente selezionato campo per campo;
- `assets`: `{id, kind: "image"|"video", name?, size, sizeKnown?, mime, included, path?}`.

`coverImage` e `question.mediaUrl` per le immagini incorporate diventano
`qurioso-asset:<id>`. I video di `videoConfig` fanno riferimento all'ID dell'asset
in `videoAssetId`; `videoUrl` è vuoto. Un asset escluso ha `included:false` e
nessun `path`. Gli altri sono esattamente `media/<id>`. Non servono estensioni:
MIME e nome originale sono nel manifesto. Gli ID ZIP sono opachi e sicuri.
I video non sono mai Base64 nel JSON di backup. I vecchi video Base64 della
sorgente vengono estratti; l'esportazione JSON del singolo quiz rimane invariata.

I metadati descrittivi legacy assenti (autore, categoria, descrizione, titolo video)
vengono normalizzati a stringhe vuote; la data assente a 0. Impostazioni di
punteggio e domande non ricevono valori inventati.

La libreria aggiunta `@zip.js/zip.js` offre lettura/scrittura incrementali,
ZIP64, CRC e decompressione senza dipendere da strumenti Node nel browser.
Le librerie ZIP transitive di Electron/Capacitor non erano dipendenze runtime
browser utilizzabili. ZIP non compresso (level 0): i filmati sono già compressi;
si limita il consumo CPU e si mantengono blocchi di I/O limitati. Nessun cloud.

Il CRC ZIP rileva corruzioni accidentali; **non è una firma crittografica** e non
certifica la provenienza dell'archivio. Usare file da fonti fidate.

## Esportazione e dimensioni

L'inventario parte dalla biblioteca visualizzata, già caricata o migrata,
inclusi gli esempi iniziali se non esiste ancora una biblioteca salvata.
Il backup riguarda i quiz salvati: salvare le bozze prima di avviare l'operazione.

- Dati quiz: byte UTF-8 esatti del manifesto che sarà scritto, comprensivo dei
  descrittori, dopo l'estrazione delle immagini e dei video inline.
- Immagini: somma dei Blob estratti unici, senza contare anche il loro Base64.
- Video: `Blob.size` effettivo, una volta per `videoAssetId` condiviso.
- Totale contenuti: manifesto + binari effettivamente inclusi.
- ZIP finale: contiene anche header, directory e descrittori; differisce dal
  totale dei contenuti. Non si finge una misura del file finale prima di crearlo.

Si riusa `formatAssetSize`, esteso a TB (unità decimali B/KB/MB/GB/TB).
I video sono selezionati per default fino a 512 MiB; oltre tale soglia si deve
scegliere esplicitamente di includerli. Disattivare la casella aggiorna subito
peso e numero esclusi. File già mancanti rimangono esclusi anche con casella attiva.

Se `showSaveFilePicker` è disponibile, si scrive sequenzialmente sul file scelto,
con avanzamento e completamento solo dopo la chiusura riuscita dello ZIP/file.
Il metodo è selezionabile. Se i permessi impediscono la scrittura diretta (possibile
anche con le protezioni Electron), si seleziona il download e si invita a riprovare
entro 512 MiB; non si allargano i permessi del desktop.
Il requisito del browser per la scrittura diretta è normalmente un contesto
sicuro: su HTTP LAN può non esserci. Il fallback crea un Blob ZIP e richiede un
download: l'interfaccia dice di verificare il salvataggio nel browser, senza
certificare la consegna al disco. Gli URL di download vengono revocati dopo 60s.
Annullamenti ed errori non producono un messaggio di riuscita; scartare eventuali
file incompleti. Durante le operazioni è attiva la protezione `beforeunload`.

## Anteprima e conflitti

La selezione ZIP legge e valida il manifesto e l'indice ZIP, senza cambiare la
biblioteca. Mostra quiz/titoli/ID, domande, immagini, video inclusi/esclusi, byte e
conflitti di ID. Il controllo CRC dei binari avviene nello staging, dopo la
conferma, prima di qualunque scrittura in IndexedDB.

- **Aggiungi**: conserva tutti i quiz esistenti. Rigenera ID di quiz, domande e
  opzioni importati, aggiornando i checkpoint. Non confronta i titoli come identità.
- **Sostituisci**: solo corrispondenze per ID scelte esplicitamente; non aggiunge
  automaticamente altri quiz e non modifica quelli non selezionati.
- **Intera biblioteca**: richiede una casella aggiuntiva che dichiara la
  sostituzione di tutti i quiz e ricorda di esportare prima la biblioteca attuale.
  È possibile ripristinare intenzionalmente anche una biblioteca vuota.

Gli ID asset importati sono sempre nuovi (anche per video esclusi): un vecchio
ID locale non può agganciare accidentalmente un file diverso. I riferimenti
condivisi nell'archivio rimangono condivisi. Non c'è deduplicazione per contenuto
fra asset con ID diversi o contro asset già presenti: nomi/size/MIME non sono
prove d'identità e non autorizzano una sovrascrittura.

## Integrità e transazione

Versioni non riconosciute, JSON/schema invalidi, ID duplicati all'interno del
backup, checkpoint che riferiscono domande assenti, path non esatti, percorsi
relativi/assoluti pericolosi, entry duplicate, extra, cifrate o directory vengono
rifiutati. La libreria ZIP verifica ambiguità/sovrapposizioni e CRC. Si controllano
le dimensioni dichiarate prima dell'estrazione e i byte prodotti durante la
lettura, interrompendo anche output oltre il limite dichiarato. ZIP troncati,
asset inclusi assenti o corrotti non raggiungono il commit.

Tutti i binari vengono verificati sequenzialmente in staging (Blob gestiti dal
browser, non grandi array di byte simultanei). Le immagini ritornano nel formato
data URL previsto dal modello attuale; i video rimangono Blob, mai Base64.
Poi un'unica transazione readwrite su `library` e `videos` salva i riferimenti e
i file. Nessun clear preventivo, nessuna cancellazione di dati originali.
Abort/quota/errore ripristinano atomicamente lo stato precedente della transazione.
La verifica della biblioteca corrente avviene nella stessa transazione:
se un'altra scheda ha salvato dopo l'anteprima, si rifiuta l'operazione e si chiede
una nuova analisi. Il modello React viene aggiornato solo dopo `oncomplete`.
La conferma UI ha un lock sincrono e viene disabilitata dopo un ripristino riuscito.

La preferenza di lingua è applicata solo se richiesta e dopo il commit. Essa usa
localStorage e non fa parte della transazione IndexedDB: se lo storage preferenze
è bloccato la lingua può non persistere alla riapertura, ma i contenuti didattici
restano salvati. Credenziali, bozze e sessioni non vengono toccate.

## Video esclusi e ricollegamento

Un video escluso riceve un nuovo ID non presente e `videoConfig.missingVideo`
con `{name?,size,sizeKnown?,mime}`; nome, domande e checkpoint rimangono nel quiz.
La sezione Dati elenca i video mancanti e permette di scegliere MP4/WebM.
Se un file era già assente e la dimensione originale è ignota, `sizeKnown:false`
lo distingue da un file vuoto (`size:0` è solo il segnaposto nel descrittore);
l’interfaccia mostra «—», non un peso inventato.
Nome, dimensione e MIME vengono confrontati; differenze richiedono una conferma
esplicita. Questi metadati non provano che il contenuto sia identico: verificare
filmato/durata e timeline. Lo stesso ID mancante viene ricollegato per tutti i
quiz che lo condividono nella stessa transazione, senza ricostruire i checkpoint.
In alternativa il selettore sorgente dell'editor già esistente ricollega il solo
quiz aperto, cancellandone il descrittore di assenza.

Nessun URL `blob:` è esportato o accettato come riferimento persistente. URL
`file:`, relativi e altri riferimenti non portabili bloccano il backup con un
messaggio per ricollegare/incorporare i media. Il blocco è intenzionale: non
si produce un backup che sembri completo ma abbia perso un contenuto.

## Limiti effettivi

- 8 GiB di contenuti con scrittura diretta e in lettura (il file ZIP in ingresso
  ammette ulteriori 16 MiB per le intestazioni); 512 MiB in esportazione
  con download Blob; massimo 10.000 entry e 10.000 elementi per elenco.
- Manifesto massimo 32 MiB; totale immagini incorporate 64 MiB; singoli vecchi
  data URL limitati a circa 64 MiB per evitare decodifiche smisurate. Ricollegare
  i vecchi video Base64 grandi come file locali prima di esportare.
- Video inline nel campo media di una domanda (il lettore attuale lo tratta come
  immagine, non come sorgente video) vengono rifiutati conservativamente. Esportare
  quel quiz singolarmente in JSON o spostare il video nella sorgente del quiz.
- Limiti applicativi, non promessa di successo: il browser può tenere Blob su
  disco oppure in RAM. Staging e IndexedDB richiedono quota e spazio per più copie;
  dispositivi con poca RAM possono fallire anche sotto soglia. Non è garantito
  il ripristino di 8 GiB in ogni browser. L'errore non pubblica una biblioteca
  parziale. Il fallback ZIP richiede memoria proporzionale al file finale.
- Interruzione/chiusura durante staging perde solo il lavoro temporaneo; se il
  commit è già completato il ripristino è avvenuto, anche se non si è visto il
  rapporto finale. Non esiste un protocollo di durabilità contro guasti fisici
  oltre le garanzie del browser/IndexedDB.

## Verifica

`tests/libraryBackup.test.ts`: 26 scenari, inclusi inclusione/esclusione video,
stime UTF-8, asset condivisi, provider, aggiunta/sostituzione/ripristino vuoto,
conferme, relink condiviso, legacy, credenziali, ZIP alterato/CRC/path, concorrenti,
rollback simulato, annullamento e video binario 64 MiB con streaming e round trip.
`desktop/backupSmoke.cjs`: renderer Electron reale a 1366×768 e zoom 100%, inventario,
checkbox, ZIP scritto su sink, anteprima senza scritture, aggiunta senza collisioni
con doppio clic, conferma completa e conservazione di domande/immagini/checkpoint.

Verificare manualmente trasferimento tra due computer/browser, MP4/WebM reali da
centinaia di MB e oltre, lettura dopo riavvio, quota bassa reale, download/salvataggio
su disco e annullamento del selettore nativo, accessibilità touch e provider con
Internet. I test da soli non certificano codec, spazio disco o servizi esterni.

## File della modifica

- `src/services/libraryBackup.ts`: formato, inventario, ZIP, validazione, staging,
  conflitti e ricollegamento condiviso.
- `src/services/quizStorage.ts`: transazione atomica con confronto della biblioteca,
  apertura DB riusabile, formattazione TB.
- `src/components/data/LibraryData.tsx`, `src/i18n/libraryBackup.ts`, `src/index.css`:
  sezione Dati e dialoghi IT/EN, misure, avanzamento e conferme.
- `src/App.tsx`: integrazione e corretta riapertura di una biblioteca vuota.
- `src/types/quiz.ts`: descrittore facoltativo del video escluso.
- `src/components/builder/VideoTimelineEditor.tsx`: rimuove il descrittore di
  assenza dopo una scelta esplicita di nuova sorgente.
- `tests/libraryBackup.test.ts`, `desktop/backupSmoke.cjs`, `desktop/smoke.cjs`,
  `scripts/test-desktop.mjs`: collaudo automatico e integrazione Electron.
- `package.json`, `package-lock.json`: dipendenza ZIP runtime e lock.
- `docs/LIBRARY_BACKUP.md`, `docs/VIDEO_EDITOR_AND_MEDIA_BACKUP.md`,
  `docs/DEVELOPMENT.md`: documentazione e rimandi.

Le modifiche locali preesistenti dell'importatore CSV/JSON sono state preservate.
Nessuna operazione Git eseguita.

Collaudo della modifica: TypeScript/lint, suite complessiva **103 test**
(di cui **26** del backup), build web/desktop e smoke Electron su due avvii.
Un’esecuzione della suite ha incontrato il timeout preesistente di avvio server
(5 secondi) in un test multiplayer; la ripetizione senza carichi concorrenti
è passata, senza modificare protocollo o test multiplayer.
