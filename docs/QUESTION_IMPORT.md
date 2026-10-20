# Importare domande CSV e JSON

## Percorsi e salvataggio

**Biblioteca → Importa domande** permette di scegliere un quiz esistente oppure
crearne uno classico/video, assegnando titolo, moltiplicatore punti, spiegazioni e
bonus serie. La conferma apre il risultato nell'editor: **Salva Quiz** lo scrive
nella biblioteca. Un nuovo quiz non contiene la domanda dimostrativa del normale
comando Crea quiz.

**Editor → Importa domande** usa come destinazione il quiz aperto, comprese le
modifiche non salvate. Il flusso è: scegli file, configura colonne se necessario,
anteprima, scegli domande, conferma. Annulla/Esc non cambia il quiz. Indietro
conserva la mappatura e la selezione finché non cambia la configurazione.
La conferma aggiunge le domande in un unico aggiornamento in memoria; un blocco
sincrono evita importazioni ripetute con doppio clic. Le bozze dell'editor
continuano a funzionare dopo la conferma. Non viene modificata la biblioteca
durante lettura, configurazione o anteprima.

**Importa quiz completo** è il precedente importatore JSON del quiz, ora
etichettato esplicitamente. Sostituisce il quiz nell'editor e mantiene le
impostazioni/video/checkpoint del file. Non va confuso con l'aggiunta di domande.

Interfaccia, messaggi e modello scaricabile sono disponibili in italiano e
inglese tramite il selettore lingua già esistente. Con lingua tedesca,
l'importatore usa l'inglese. Il dialogo ha scorrimento interno, comandi di
conferma/annullamento nel bordo inferiore, navigazione da tastiera, focus
contenuto nel dialogo e ripristino del focus alla chiusura.

## CSV di riferimento

**Scarica modello CSV** produce UTF-8 con BOM, separatore punto e virgola,
intestazioni ed esempi di scelta multipla, vero/falso e più risposte corrette.
Il modello inglese usa intestazioni inglesi equivalenti. Esempio italiano:

```csv
domanda;tipo;risposta_A;risposta_B;risposta_C;risposta_D;corretta;spiegazione;punti;tempo
Qual è la capitale d’Italia?;multiple_choice;Roma;Milano;Torino;Napoli;A;Roma è la capitale d’Italia.;1000;20
La Terra ruota intorno al Sole.;true_false;Vero;Falso;;;A;;1000;30
Seleziona un numero pari.;multiple_choice;2;3;4;5;A|C;Sono corretti 2 e 4.;2000;20
```

Da Excel/LibreOffice scegliere **CSV UTF-8**, non XLSX o CSV in codifica locale.
Sono supportati virgola, punto e virgola e tabulazione (`.tsv`), BOM facoltativo,
terminatori LF/CRLF/CR, campi tra doppi apici, separatori dentro i testi e campi
multilinea. Un apice doppio nel campo si rappresenta con `""`. Le righe vuote
vengono ignorate; gli errori riportano la riga fisica iniziale del record.

Il separatore viene proposto automaticamente ma è modificabile. La casella
intestazioni consente anche file senza intestazioni. I primi cinque record sono
visibili prima della conferma. La mappatura collega ogni campo alla colonna
scelta, senza imporre un ordine; intestazioni italiane/inglesi note ricevono una
proposta modificabile. Intestazioni duplicate restano colonne distinte, indicate
con il numero. La stessa colonna non può alimentare più campi.

Risposta corretta: nel modello **A–L**, con `|` per più risposte, ad esempio
`A|C`. Non usare `vero`, `true`, `0` o il testo dell'opzione pensando che il
sistema li interpreti automaticamente. Si può scegliere esplicitamente un
formato diverso: numeri **da 1**, separati da `|`, oppure testo esatto di una
singola opzione. Il testo deve corrispondere a un'unica opzione. Le risposte
intermedie non possono essere vuote; le colonne finali inutilizzate possono
rimanere vuote.

## JSON supportato

1. Un quiz completo esportato da Qurioso: **Importa domande** avvisa ed estrae
   soltanto le domande, ignorando titolo, impostazioni, video e checkpoint.
2. Un array di domande Qurioso, anche nella forma `{ "questions": [...] }`:

```json
[
  {
    "text": "Qual è la capitale d’Italia?",
    "type": "multiple_choice",
    "options": [
      { "id": "a", "text": "Roma", "isCorrect": true },
      { "id": "b", "text": "Milano", "isCorrect": false }
    ],
    "timeLimit": 20,
    "points": 1000,
    "explanation": "Roma è la capitale d’Italia."
  }
]
```

ID, colori e forme assenti ricevono valori nuovi/predefiniti. Il tipo canonico
deve essere presente. `isCorrect` deve essere un booleano, non `"true"`.
Colori/forme presenti devono appartenere ai valori già supportati da Qurioso.

3. Un array di oggetti semplici con proprietà scalari e/o array di stringhe:

```json
[
  { "prompt": "Quanto fa 2+2?", "answers": ["3", "4"], "right": 2 }
]
```

Mappare `prompt` a Domanda, `answers` ad Array di risposte, `right` a Risposta
corretta, quindi scegliere il formato numerico da 1. Sono mappabili anche
proprietà separate per le opzioni. Non si attraversano strutture annidate né si
interpretano formati esterni arbitrari. I nomi delle proprietà mappabili hanno
un limite di 200 caratteri. Per strutture non supportate viene spiegato come
preparare un elenco compatibile.

## Validazione, ID e duplicati

- Tipi: `multiple_choice` e `true_false`; per i dati mappati sono accettate anche
  le etichette italiane/inglesi documentate nell'interfaccia. Un tipo assente nei
  dati mappati usa il tipo predefinito scelto; un tipo sconosciuto dà errore.
- Scelta multipla: 2–12 opzioni non vuote, almeno una corretta. Vero/falso:
  esattamente due opzioni e una corretta. Le etichette delle opzioni restano
  modificabili e non vengono convertite silenziosamente.
- Testo domanda/spiegazione: massimo 20.000 caratteri; opzioni: 10.000 ciascuna.
  Spiegazioni e altri campi facoltativi devono avere il tipo previsto.
- Punti finiti 0–1.000.000, tempo finito 0,001–86.400 secondi. Se assenti:
  1000 punti e 20 secondi, come indicato nell'interfaccia. Sono accettate anche
  rappresentazioni testuali decimali con punto o virgola, senza separatori delle migliaia.
- Gli ID delle opzioni nel file devono essere distinti nella domanda. ID di
  domanda ripetuti sono segnalati; alla conferma **tutti** gli ID delle nuove
  domande e opzioni vengono rigenerati con casualità crittografica, senza
  cambiare quelli già presenti.
- Media: i riferimenti locali relativi, `file:`, `blob:`, `javascript:` o asset
  locali non rappresentabili nel modello della domanda vengono rifiutati.
  Sono accettati URL HTTP(S) senza credenziali e data URL Base64 raster
  PNG/JPEG/WebP/GIF o video MP4/WebM. I media incorporati devono essere entro
  2 MiB di URL e il limite complessivo del file. Non vengono scaricati durante
  l'anteprima; gli URL esterni hanno un avviso di disponibilità non verificata.
  I crediti importati devono contenere titolo, autore, licenza e URL validi.
  Nei dati mappati si può associare anche `mediaType`: valori `image` o `video`.
  Un URL esterno senza tipo esplicito è trattato come immagine; per un video
  indicare quindi `video`. Il tipo non viene indovinato dal nome del link.

L'anteprima mostra totali, validi, errori e possibili duplicati, e presenta 25
domande per pagina con opzioni/corrette, spiegazione, punti, tempo e problemi.
Le righe errate non sono selezionabili. Sono inizialmente selezionate soltanto
le domande valide nuove; i duplicati rimangono importabili per scelta esplicita.

Il confronto ignora ID, colori e forme, normalizza Unicode, maiuscole/minuscole
e spazi e considera le opzioni indipendentemente dall'ordine. Il contenuto
identico comprende risposte/corrette, punti, tempo, spiegazione e media. Stesso
tipo/testo con dettagli diversi viene indicato come simile. Si confrontano
destinazione e record precedenti del file; non si applicano AI o similarità
semantica. Nessuna domanda esistente viene sovrascritta. Modificando mappatura
o destinazione la selezione iniziale viene ricalcolata per la nuova anteprima.

## Quiz video e compatibilità

Le domande importate sono **non associate**. Non si copiano `videoTimestamp` o
checkpoint del file sorgente. Quelli del quiz di destinazione esplicito restano
identici, insieme al riferimento al Blob del video. Si possono poi associare le
nuove domande dall'editor timeline. Non viene generato alcun checkpoint casuale.
Per quiz legacy senza `checkpointMode`, si riusa `editableVideoQuiz`: i tempi
effettivi preesistenti vengono materializzati prima dell'aggiunta, così le nuove
domande non ricevono i vecchi checkpoint impliciti.

Formato dei quiz salvati, protocollo multiplayer, autorizzazioni e formula dei
punteggi non cambiano. Non vengono aggiunti tipi di domanda, XLSX, dipendenze,
servizi esterni o backup completi.

## Limiti e collaudo

Limiti: 5 MiB per file, 1000 record importati, 64 colonne, massimo 1000 domande
nella destinazione dopo l'aggiunta. L'elaborazione è locale nel thread browser:
file entro il limite ma molto complessi possono richiedere una breve attesa.
Non vengono corretti automaticamente caratteri di codifiche diverse da UTF-8.
I file con errori di sintassi CSV/JSON richiedono correzione nel file; gli errori
di dati vengono esclusi singolarmente. I media incorporati non vengono decodificati
per verificarne i codec durante l'importazione: controllarli nell'editor.

Test automatici: parser, formati, mapping, validazione, duplicati, aggiunta
immutabile/parziale, compatibilità legacy, UI italiano/inglese, doppia conferma,
annullamento, destinazione e scrittura della biblioteca solo tramite Salva Quiz.
Lo smoke Electron verifica il flusso reale CSV/JSON a 1366×768 e zoom 100%,
compreso un quiz video e la conservazione di asset/checkpoint/modifiche locali.
Restano consigliati test con esportazioni reali Excel/LibreOffice, lettore di
schermo, tastiera/touch e dispositivi usati in aula.
