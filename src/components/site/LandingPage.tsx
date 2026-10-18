import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Monitor, Network, Play, Download, Check, ChevronRight } from 'lucide-react';
import { QuriosoLogo } from '../common/QuriosoLogo';
import { loadDesktopDownloads, type DesktopDownload } from '../../services/downloads';

export function LandingPage() {
  const [downloads, setDownloads] = useState<DesktopDownload[]>([]);
  const [downloadState, setDownloadState] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    const controller = new AbortController();
    loadDesktopDownloads(controller.signal).then(items => { setDownloads(items); setDownloadState('ready'); })
      .catch(() => { if (!controller.signal.aborted) setDownloadState('error'); });
    return () => controller.abort();
  }, []);
  return <div className="min-h-screen bg-white text-ink">
    <a href="#contenuto" className="sr-only focus:not-sr-only focus:block focus:p-3">Vai al contenuto</a>
    <header className="max-w-6xl mx-auto px-5 md:px-8 py-6 flex items-center justify-between gap-5">
      <a href="./" aria-label="Qurioso, pagina iniziale"><QuriosoLogo size="md" /></a>
      <nav aria-label="Navigazione principale" className="flex gap-5 text-sm font-bold text-petrolio"><a href="?app=classroom" className="hover:underline">Attività in classe</a><a href="#quiz-in-rete" className="hover:underline">Quiz in Rete</a></nav>
    </header>
    <main id="contenuto">
      <section className="max-w-6xl mx-auto px-5 md:px-8 pt-12 md:pt-20 pb-16 md:pb-24 grid lg:grid-cols-[1.15fr_1fr] gap-12 items-center">
        <div>
          <p className="text-xs uppercase tracking-[.2em] font-bold text-petrolio mb-5">Una domanda accende la curiosità</p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.08] text-petrolio">La lezione diventa<br />una conversazione.</h1>
          <p className="mt-6 text-lg text-muted max-w-xl leading-relaxed">Con Qurioso crei quiz con immagini e video, mostri le domande e dai spazio alle risposte. Insieme sullo schermo, oppure ciascuno dal proprio dispositivo.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="?app=classroom" className="btn-petrolio rounded-xl px-5 py-4 font-bold inline-flex items-center gap-3">Apri Attività in classe <ArrowUpRight size={19} /></a>
            <a href="#quiz-in-rete" className="rounded-xl border border-line px-5 py-4 font-bold text-petrolio inline-flex items-center gap-3">Scopri Quiz in Rete <ChevronRight size={18} /></a>
          </div>
          <p className="mt-4 text-sm text-muted">L’attività in classe si apre subito nel browser. Nessuna installazione.</p>
        </div>
        <div className="rounded-3xl border border-line bg-surface-soft p-5 md:p-8" aria-label="Esempio illustrativo di una domanda Qurioso">
          <div className="flex justify-between text-xs font-bold text-petrolio"><span>UNO SPUNTO PER COMINCIARE</span><Monitor size={18} /></div>
          <p className="mt-9 text-2xl md:text-3xl font-bold text-petrolio leading-snug">Quale pianeta è chiamato<br />il Pianeta Rosso?</p>
          <div className="grid grid-cols-2 gap-3 mt-8 text-sm font-bold">
            {['Venere', 'Marte', 'Giove', 'Saturno'].map(name => <div key={name} className={`rounded-xl p-4 border flex items-center justify-between ${name === 'Marte' ? 'bg-mandarino/20 border-mandarino text-accent-ink' : 'bg-white border-line text-petrolio'}`}>{name}{name === 'Marte' && <Check size={18} />}</div>)}
          </div>
          <p className="text-sm text-muted mt-6">Una domanda. Il tempo per pensarci. Una risposta da discutere.</p>
        </div>
      </section>
      <section className="border-y border-line bg-surface-soft">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-12 grid md:grid-cols-2 gap-10 md:gap-16">
          <div><Monitor className="text-petrolio mb-4" size={28} /><h2 className="text-2xl font-bold text-petrolio">Attività in classe</h2><p className="text-muted mt-3 leading-relaxed">Il docente apre Qurioso e proietta le domande. Gli studenti discutono insieme e il docente seleziona la risposta collettiva sul proprio dispositivo.</p><p className="text-muted mt-3 leading-relaxed">Con o senza video, senza limite di tempo per rispondere. Basta il browser: gli studenti non devono collegare un telefono.</p><a href="?app=classroom" className="inline-flex items-center gap-2 text-petrolio font-bold mt-5 underline underline-offset-4">Inizia un’attività <ArrowUpRight size={17} /></a></div>
          <div><Network className="text-petrolio mb-4" size={28} /><h2 className="text-2xl font-bold text-petrolio">Quiz in Rete</h2><p className="text-muted mt-3 leading-relaxed">Il docente avvia l’applicazione sul proprio computer. Ogni studente entra con QR code e PIN dal browser del proprio dispositivo e risponde individualmente.</p><p className="text-muted mt-3 leading-relaxed">Il computer del docente e tutti i dispositivi devono essere collegati alla stessa rete locale (LAN o Wi-Fi).</p><a href="#quiz-in-rete" className="inline-flex items-center gap-2 text-petrolio font-bold mt-5 underline underline-offset-4">Download e istruzioni <Download size={17} /></a></div>
        </div>
      </section>
      <section className="max-w-6xl mx-auto px-5 md:px-8 py-16">
        <h2 className="text-3xl font-bold text-petrolio">I tuoi contenuti, le tue domande.</h2>
        <div className="grid sm:grid-cols-3 gap-8 mt-8">
          <div><h3 className="font-bold text-lg text-petrolio">Crea o parti da un esempio</h3><p className="mt-2 text-muted leading-relaxed">Prepara domande a scelta multipla o vero/falso. Aggiungi immagini dal computer o da Wikimedia Commons.</p></div>
          <div><h3 className="font-bold text-lg text-petrolio">Fai una pausa nel video</h3><p className="mt-2 text-muted leading-relaxed">Scegli un file, un link YouTube o Vimeo. Imposta quando fermare il filmato e aprire una domanda.</p></div>
          <div><h3 className="font-bold text-lg text-petrolio">Porta con te i quiz</h3><p className="mt-2 text-muted leading-relaxed">I quiz restano nel browser che usi. Esportali in JSON per conservarne una copia o trasferirli su un altro computer.</p></div>
        </div>
      </section>
      <section id="quiz-in-rete" className="scroll-mt-6 max-w-6xl mx-auto px-5 md:px-8 pb-16">
        <div className="rounded-3xl border-2 border-petrolio p-6 md:p-10">
          <p className="text-xs uppercase tracking-[.16em] font-bold text-petrolio">Un dispositivo per ogni partecipante</p>
          <h2 className="mt-3 text-3xl md:text-4xl font-black text-petrolio">Prepara il tuo Quiz in Rete</h2>
          <p className="mt-4 text-muted max-w-3xl leading-relaxed">Scarica la versione di Qurioso per il computer del docente. Agli studenti basta il browser: non devono installare l’applicazione.</p>
          <div className="mt-6 bg-mandarino/15 rounded-xl p-5 text-accent-ink"><strong>Tutti sulla stessa LAN.</strong> Collega il computer del docente e i dispositivi degli studenti alla stessa rete locale, tramite Wi-Fi o cavo. Le reti ospiti e alcune reti scolastiche possono impedire la comunicazione tra dispositivi: in quel caso chiedi al referente della rete.</div>
          <div className="grid sm:grid-cols-3 gap-4 mt-7">
            {(['Windows', 'macOS', 'Linux'] as const).map(platform => {
              const items = downloads.filter(item => item.platform === platform);
              return <div key={platform} className="rounded-xl border border-line p-5"><h3 className="text-xl font-bold text-petrolio">{platform}</h3>{items.length ? items.map(item => <a key={item.url} href={item.url} className="mt-4 flex items-center gap-2 text-sm text-petrolio underline break-all"><Download size={16} className="shrink-0" />{item.name}</a>) : <p className="mt-3 text-sm text-muted">{downloadState === 'loading' ? 'Verifica download…' : downloadState === 'error' ? 'Download non verificabili al momento.' : 'Build non ancora disponibile.'}</p>}</div>;
            })}
          </div>
          <a href="https://github.com/napo/qurioso/releases" target="_blank" rel="noopener noreferrer" className="inline-flex gap-2 items-center mt-5 text-sm font-bold text-petrolio underline">Tutte le versioni su GitHub <ArrowUpRight size={16} /></a>
          <ol className="mt-8 grid sm:grid-cols-3 gap-6 list-none">
            {['Scarica e avvia Qurioso sul computer del docente.', 'Collega tutti i dispositivi alla stessa rete e avvia un Quiz in Rete.', 'Mostra QR code e PIN: gli studenti entrano dal loro browser.'].map((step, i) => <li key={step} className="flex gap-3 text-sm leading-relaxed"><span className="text-mandarino text-2xl font-black">0{i + 1}</span><span>{step}</span></li>)}
          </ol>
        </div>
      </section>
      <section className="max-w-6xl mx-auto px-5 md:px-8 pb-16">
        <h2 className="text-2xl font-bold text-petrolio mb-6">Prima di iniziare</h2>
        {[['Serve Internet?', 'Per aprire il sito, cercare immagini e riprodurre video YouTube o Vimeo serve Internet. Un Quiz in Rete con contenuti locali usa la rete locale; i dispositivi devono potersi raggiungere tra loro.'], ['Devo creare un account?', 'Qurioso non richiede account né chiavi API. Per un video online puoi incollare il link; puoi anche caricare un file dal computer.'], ['Dove vengono salvati i quiz?', 'Nel browser del dispositivo che usi. Prima di cambiare browser o computer, esporta i quiz in JSON. Cancellare i dati del sito può cancellare anche il tuo archivio.']].map(([question, answer]) => <details key={question} className="border-b border-line py-4"><summary className="cursor-pointer font-bold text-petrolio">{question}</summary><p className="mt-3 text-muted max-w-3xl leading-relaxed">{answer}</p></details>)}
      </section>
    </main>
    <footer className="border-t border-line max-w-6xl mx-auto px-5 md:px-8 py-7 flex flex-wrap justify-between gap-4 text-sm text-muted"><span>Qurioso · Maurizio Napolitano</span><a href="https://github.com/napo/qurioso" className="text-petrolio underline">Codice aperto · AGPL-3.0</a></footer>
  </div>;
}
