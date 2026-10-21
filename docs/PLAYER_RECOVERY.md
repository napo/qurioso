# Recupero del partecipante

Il recupero usa il `playerToken` casuale a 256 bit già assegnato dal server al
primo ingresso. PIN, ID e nickname pubblici non sono prove di identità.
Non cambia il formato dei quiz né la formula dei punteggi. Il calcolo classico
continua a riconciliare le ricevute accettate tramite il presentatore; il video
mantiene il calcolo sul server. Il recupero non ricalcola nessun punto.

## Persistenza e durata

In `localStorage`, per origine completa (schema, host e porta), si conserva un
record per PIN: `{ pin, playerId, token, expiresAt }`, più il riferimento all'ultima
partita. Non si salvano nickname, risposte, punteggi o snapshot della sessione.
La rimozione dei record obsoleti avviene quando si tenta il recupero o si esce;
record non più visitati possono restare nel profilo, senza autorizzare il recupero
dopo la scadenza server.
`sessionStorage` non soddisfa il requisito di riaprire una scheda completamente
chiusa; `localStorage` sopravvive alla chiusura e alla riapertura del browser,
se il profilo conserva i dati del sito. La durata è di **24 ore dal primo ingresso**,
verificata sul server anche se il record locale viene alterato. Un recupero o
una riconnessione non rinnova la scadenza. Decide il clock del server: un orologio
locale errato non invalida anticipatamente una credenziale ancora valida. Fine partita, eliminazione della
stanza e riavvio del server possono invalidare prima il recupero.

Il server conserva token e scadenze fuori dallo stato pubblico. La scadenza vale
anche per richieste ordinarie e messaggi WebSocket. Il record del presentatore
rimane separato in `sessionStorage`; il recupero del docente non cambia.

## Percorso

Aprendo il link della partita, oppure scegliendo **Partecipa con PIN** nella pagina
iniziale servita dal computer del docente, il client tenta automaticamente il
recupero del PIN richiesto o dell'ultima partita. Il comando non compare su
qurioso.it, dove un PIN non raggiunge il server della partita, né nella barra
dell'app desktop, che è lo strumento del docente. Dopo un ingresso manuale, l'URL della scheda conserva
soltanto PIN e ruolo pubblici per rendere affidabile il refresh.

`GET /api/session/:pin/player/:playerId` richiede il bearer del partecipante
esatto. Non accetta quello di un altro studente, quello del presentatore o il
solo nickname. Non crea partecipanti, non cambia fase, revisione, nonce, deadline,
risposte o punteggi. Restituisce la normale vista filtrata e la ricevuta privata
`ownAnswer`: una risposta già accettata torna subito allo stato di attesa, senza
mostrare correttezza o punti del turno prima dei risultati. Se manca una risposta,
resta valido soltanto il tempo residuo del server.

Il client poi riattiva WebSocket e polling con lo stesso token. Una breve perdita
di rete continua a usare la riconnessione automatica esistente. Non viene mai
usato uno snapshot locale come alternativa al server.

- Rete assente/errore temporaneo: messaggio con **Riprova recupero**, credenziale
  conservata; nessun nuovo ingresso automatico.
- Credenziale invalida o scaduta, stanza chiusa, partita terminata o server
  riavviato: messaggio esplicito, cancellazione del record pertinente e possibilità
  di tornare all'ingresso. Non si ricrea la vecchia identità usando dati pubblici.
- **Abbandona partita** / **Torna alla Home**: rimozione locale della credenziale
  pertinente e `POST /api/session/:pin/player/:playerId/leave` autenticato per
  revocarla sul server. Le altre partite e la credenziale del docente restano
  intatte. Si conservano i vecchi risultati/partecipanti per non alterare conteggi
  e statistiche. Una semplice disconnessione, un refresh o la chiusura della
  scheda non revocano il token.

## Limiti operativi

- Su un PC condiviso, chi usa lo stesso profilo può riprendere il partecipante
  finché il token è valido: usare **Abbandona partita** prima di cambiare studente.
  Due schede dello stesso profilo sullo stesso PIN condividono la stessa identità;
  il server continua ad accettare una sola scelta per domanda.
- Browser/PC/origine/porta diversi non condividono i record. Navigazione privata,
  cancellazione dei dati, profili temporanei o policy scolastiche possono impedire
  la persistenza. Se il salvataggio è bloccato, la partita ordinaria continua con
  un avviso, ma il recupero dopo chiusura non è garantito.
- JavaScript della stessa origine, un XSS o l'accesso al profilo possono leggere
  `localStorage`. Non è una protezione dall'accesso al computer condiviso.
- Rimangono i limiti della LAN HTTP/WS non cifrata: usare una LAN fidata. Nessun
  token entra in URL, QR, esportazioni, log applicativi o stato pubblico.
- Se si abbandona offline, la credenziale locale viene rimossa; la revoca remota
  non è garantita fino alla normale scadenza o chiusura della stanza.
- Le partite sono in memoria sul server e non sopravvivono al suo riavvio.

## Collaudo

`playerRecovery.test.ts` prova client nuovi e componenti reali per classico/video,
recupero nelle fasi, ricevute immutabili, assenza di duplicati, scadenza originale,
scadenza credenziali sul server con clock di test, identità scambiate, riavvio,
rete assente e abbandono. I test esistenti mantengono le verifiche di reconnect,
autorizzazioni e recupero del presentatore.

`desktop:smoke` include veri renderer Chromium: refresh, chiusura completa e
riapertura della finestra con lo stesso profilo, stato di attesa, risultati,
classifica, punteggio unico e pulizia dopo fine partita per classico e video.
Resta necessario provare due PC fisici sulla LAN scolastica e le policy dei
browser effettivamente usati.
