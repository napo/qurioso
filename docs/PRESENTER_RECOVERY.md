# Recupero del presentatore

## Dati e autorità

Il server conserva l'unico stato autorevole della partita: PIN, fase, domanda,
nonce del turno, deadline monotona, risposte accettate, punteggi, revisioni,
sequenza e numero di checkpoint aperti. Nessuna copia di questi dati nel browser
viene usata come fallback per ripristinare una partita.

Il browser del docente conserva:

- In `sessionStorage`, una sola credenziale di recupero `{ pin, token }`, nello
  spazio dell'origine e della scheda corrente. Il token è il segreto casuale
  del presentatore già generato dal server, mai il PIN pubblico.
- Nell'IndexedDB già usato dall'app, una copia privata del quiz effettivamente
  avviato, sotto una chiave separata dalla biblioteca dei quiz salvati. Questo
  conserva ordine, impostazioni, immagini e riferimenti al video anche se il
  quiz originale viene modificato. I cambi di sorgente video aggiornano la copia.
  Non si salvano risposte degli studenti, classifica o token nell'IndexedDB.

Il formato dei quiz e la formula dei punteggi non cambiano. Per il multiplayer
classico il docente riprende la stessa elaborazione delle ricevute già accettate;
per il video il calcolo resta sul server.

## Ripristino

All'apertura di Quiz in rete, senza parametri di ingresso studente, l'app tenta
il recupero della scheda. `GET /api/session/:pin/presenter` esige il token del
presentatore: PIN, richiesta anonima e token di uno studente sono rifiutati.
Dalla risposta vengono ricaricati stato, revisioni, progressi e clock correnti.
Non si crea una nuova stanza e non si ripubblica la lobby.

Il video viene messo in pausa anche nella sessione server. Dopo il caricamento
dei metadati, il lettore ripristina la posizione confermata e i checkpoint aperti
sul server. Ripristinare la posizione non apre automaticamente una domanda.
Il docente deve premere Riproduci video o Riprendi video. Un countdown recuperato
richiede Riprendi avvio del quiz. Il timer di una domanda già aperta continua
invece a decorrere sul server, anche durante il refresh.

La posizione video viene pubblicata circa ogni due secondi durante la
riproduzione e su play, pausa, seek, checkpoint e fine video. Un refresh può
quindi tornare indietro di alcuni secondi; con una perdita di rete può recuperare
una posizione più vecchia. Il numero di checkpoint è sempre quello del server,
perciò non si ripropongono domande già svolte. Il flag di fine video permette
anche di completare correttamente le domande residue dopo il recupero.

## Errori e chiusura

- Rete assente, errori server o conflitto durante il recupero: messaggio con
  Riprova recupero; la credenziale viene conservata.
- Credenziale non valida: messaggio esplicito e cancellazione del record locale.
- Stanza inesistente (chiusa, rimossa o server riavviato): messaggio esplicito e
  cancellazione del record. Non si tenta di ricreare il vecchio PIN.
- Copia privata del quiz mancante: possibilità di riprovare o terminare la stanza.
- Archiviazione bloccata/piena: la normale partita resta utilizzabile, con un
  messaggio che avverte dell'indisponibilità del recupero.

Smontare la schermata o aggiornare la pagina scollega soltanto i trasporti.
**Esci**, anche dal podio, termina esplicitamente la stanza e cancella la
credenziale e la copia privata del quiz. I file video e la biblioteca salvata
rimangono disponibili. Le scritture pendenti non possono ripristinare la
credenziale o ricreare la stanza dopo questa uscita. Se il server è irraggiungibile
la pulizia locale avviene comunque; non si può garantire la cancellazione remota.

## Sicurezza e limiti

`sessionStorage` è meno persistente di `localStorage`: sopravvive al refresh,
ma normalmente termina alla chiusura della scheda. Il recupero dopo crash,
riapertura del browser o ripristino di una scheda chiusa dipende dal browser;
non è garantito. Un server riavviato ha perso le stanze in memoria e non è
recuperabile. Cambiare origine/porta del sito cambia l'accesso al record.

Il token non entra in URL, QR, log, esportazioni o stato pubblico. La scheda di
test giocatore viene aperta con `noopener,noreferrer`, evitando la copia iniziale
del sessionStorage dell'opener. Una duplicazione manuale della scheda o il
ripristino del browser può comunque copiare la credenziale.

Chi usa lo stesso browser/scheda su un computer condiviso può riprendere il
controllo finché la credenziale è presente: prima di lasciare il dispositivo usare
Esci. JavaScript della stessa origine e un eventuale XSS possono leggere il
sessionStorage; non è una cassaforte né autenticazione dell'identità del docente.
Persistono i limiti della LAN HTTP/WS senza cifratura già documentati in
[LAN_SECURITY.md](LAN_SECURITY.md). Non vengono introdotti account o servizi cloud.
