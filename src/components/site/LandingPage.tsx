import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Monitor, Network, Download, Check, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { landingTranslations } from '../../i18n/landing';
import { LanguageSelector } from '../common/LanguageSelector';
import { QuriosoLogo } from '../common/QuriosoLogo';
import { formatDownloadSize, loadDesktopDownloads, type DesktopDownload } from '../../services/downloads';

export function LandingPage() {
  const { language, t: appText } = useLanguage();
  const t = landingTranslations[language];
  const classroomUrl = `?app=classroom&lang=${language}`;
  useEffect(() => {
    document.title = t.pageTitle;
    const metadata = { description: t.pageDescription, 'og:title': t.pageTitle, 'og:description': t.pageDescription,
      'twitter:title': t.pageTitle, 'twitter:description': t.pageDescription,
      'og:locale': { it: 'it_IT', en: 'en_GB', de: 'de_DE' }[language] };
    for (const [name, content] of Object.entries(metadata)) {
      document.querySelector(`meta[name="${name}"], meta[property="${name}"]`)?.setAttribute('content', content);
    }
  }, [language, t]);
  const [downloads, setDownloads] = useState<DesktopDownload[]>([]);
  const [downloadState, setDownloadState] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    const controller = new AbortController();
    loadDesktopDownloads(controller.signal).then(items => { setDownloads(items); setDownloadState('ready'); })
      .catch(() => { if (!controller.signal.aborted) setDownloadState('error'); });
    return () => controller.abort();
  }, []);
  return <div className="min-h-screen bg-white text-ink">
    <a href="#contenuto" className="sr-only focus:not-sr-only focus:block focus:p-3">{t.skip}</a>
    <header className="max-w-6xl mx-auto px-5 md:px-8 py-6 flex flex-wrap items-center justify-between gap-5">
      <a href="./" aria-label={t.home}><QuriosoLogo size="md" /></a>
      <nav aria-label={t.nav} className="flex flex-wrap items-center gap-5 text-sm font-bold text-petrolio"><a href={`?role=player&lang=${language}`} className="btn-mandarino rounded-xl px-4 py-3">{appText.joinWithPin}</a><a href={classroomUrl} className="hover:underline">{t.classroom}</a><a href="#quiz-in-rete" className="hover:underline">{t.network}</a><LanguageSelector /></nav>
    </header>
    <main id="contenuto">
      <section className="max-w-6xl mx-auto px-5 md:px-8 pt-12 md:pt-20 pb-16 md:pb-24 grid lg:grid-cols-[1.15fr_1fr] gap-12 items-center">
        <div>
          <p className="text-xs uppercase tracking-[.2em] font-bold text-petrolio mb-5">{t.badge}</p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.08] text-petrolio">{t.title}</h1>
          <p className="mt-6 text-lg text-muted max-w-xl leading-relaxed">{t.intro}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={classroomUrl} className="btn-petrolio rounded-xl px-5 py-4 font-bold inline-flex items-center gap-3">{t.openClassroom} <ArrowUpRight size={19} /></a>
            <a href="#quiz-in-rete" className="rounded-xl border border-line px-5 py-4 font-bold text-petrolio inline-flex items-center gap-3">{t.discoverNetwork} <ChevronRight size={18} /></a>
          </div>
          <p className="mt-4 text-sm text-muted">{t.noInstall}</p>
        </div>
        <div className="rounded-3xl border border-line bg-surface-soft p-5 md:p-8" aria-label={t.exampleLabel}>
          <div className="flex justify-between text-xs font-bold text-petrolio"><span>{t.exampleBadge}</span><Monitor size={18} /></div>
          <p className="mt-9 text-2xl md:text-3xl font-bold text-petrolio leading-snug">{t.exampleQuestion}</p>
          <div className="grid grid-cols-2 gap-3 mt-8 text-sm font-bold">
            {[t.venus, t.mars, t.jupiter, t.saturn].map((name, index) => <div key={name} className={`rounded-xl p-4 border flex items-center justify-between ${index === 1 ? 'bg-mandarino/20 border-mandarino text-accent-ink' : 'bg-white border-line text-petrolio'}`}>{name}{index === 1 && <Check size={18} />}</div>)}
          </div>
          <p className="text-sm text-muted mt-6">{t.exampleCaption}</p>
        </div>
      </section>
      <section className="border-y border-line bg-surface-soft">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-12 grid md:grid-cols-2 gap-10 md:gap-16">
          <div><Monitor className="text-petrolio mb-4" size={28} /><h2 className="text-2xl font-bold text-petrolio">{t.classroom}</h2><p className="text-muted mt-3 leading-relaxed">{t.classroomDescription}</p><p className="text-muted mt-3 leading-relaxed">{t.classroomDetails}</p><a href={classroomUrl} className="inline-flex items-center gap-2 text-petrolio font-bold mt-5 underline underline-offset-4">{t.startActivity} <ArrowUpRight size={17} /></a></div>
          <div><Network className="text-petrolio mb-4" size={28} /><h2 className="text-2xl font-bold text-petrolio">{t.network}</h2><p className="text-muted mt-3 leading-relaxed">{t.networkDescription}</p><p className="text-muted mt-3 leading-relaxed">{t.networkDetails}</p><a href="#quiz-in-rete" className="inline-flex items-center gap-2 text-petrolio font-bold mt-5 underline underline-offset-4">{t.downloadsInstructions} <Download size={17} /></a></div>
        </div>
      </section>
      <section className="max-w-6xl mx-auto px-5 md:px-8 py-16">
        <h2 className="text-3xl font-bold text-petrolio">{t.contentTitle}</h2>
        <div className="grid sm:grid-cols-3 gap-8 mt-8">
          <div><h3 className="font-bold text-lg text-petrolio">{t.createTitle}</h3><p className="mt-2 text-muted leading-relaxed">{t.createDescription}</p></div>
          <div><h3 className="font-bold text-lg text-petrolio">{t.videoTitle}</h3><p className="mt-2 text-muted leading-relaxed">{t.videoDescription}</p></div>
          <div><h3 className="font-bold text-lg text-petrolio">{t.exportTitle}</h3><p className="mt-2 text-muted leading-relaxed">{t.exportDescription}</p></div>
        </div>
      </section>
      <section id="quiz-in-rete" className="scroll-mt-6 max-w-6xl mx-auto px-5 md:px-8 pb-16">
        <div className="rounded-3xl border-2 border-petrolio p-6 md:p-10">
          <p className="text-xs uppercase tracking-[.16em] font-bold text-petrolio">{t.downloadBadge}</p>
          <h2 className="mt-3 text-3xl md:text-4xl font-black text-petrolio">{t.downloadTitle}</h2>
          <p className="mt-4 text-muted max-w-3xl leading-relaxed">{t.downloadIntro}</p>
          <div className="mt-6 bg-mandarino/15 rounded-xl p-5 text-accent-ink"><strong>{t.lanTitle}</strong>{' '}{t.lanDescription}</div>
          <div className="grid sm:grid-cols-3 gap-4 mt-7">
            {(['Windows', 'macOS', 'Linux'] as const).map(platform => {
              const items = downloads.filter(item => item.platform === platform);
              return <div key={platform} className="rounded-xl border border-line p-5">
                <h3 className="text-xl font-bold text-petrolio">{platform}</h3>
                {items.some(item => item.prerelease) && <p className="mt-2 text-xs font-bold text-accent-ink">{t.previewBuild}</p>}
                {items.length ? items.map(item => <a key={item.url} href={item.url} className="mt-4 flex items-start gap-2 text-sm text-petrolio">
                  <Download size={16} className="mt-0.5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block underline break-all">{item.name}</span>
                    <span className="mt-1 block text-xs text-muted">{item.size === undefined ? t.sizeUnavailable : formatDownloadSize(item.size, language)}</span>
                  </span>
                </a>) : <p className="mt-3 text-sm text-muted">{downloadState === 'loading' ? t.checkingDownloads : downloadState === 'error' ? t.downloadError : t.buildUnavailable}</p>}
              </div>;
            })}
          </div>
          <a href="https://github.com/napo/qurioso/releases" target="_blank" rel="noopener noreferrer" className="inline-flex gap-2 items-center mt-5 text-sm font-bold text-petrolio underline">{t.allReleases} <ArrowUpRight size={16} /></a>
          <ol className="mt-8 grid sm:grid-cols-3 gap-6 list-none">
            {[t.step1, t.step2, t.step3].map((step, i) => <li key={step} className="flex gap-3 text-sm leading-relaxed"><span className="text-mandarino text-2xl font-black">0{i + 1}</span><span>{step}</span></li>)}
          </ol>
        </div>
      </section>
      <section className="max-w-6xl mx-auto px-5 md:px-8 pb-16">
        <h2 className="text-2xl font-bold text-petrolio mb-6">{t.faqTitle}</h2>
        {[[t.internetQuestion, t.internetAnswer], [t.accountQuestion, t.accountAnswer], [t.storageQuestion, t.storageAnswer]].map(([question, answer]) => <details key={question} className="border-b border-line py-4"><summary className="cursor-pointer font-bold text-petrolio">{question}</summary><p className="mt-3 text-muted max-w-3xl leading-relaxed">{answer}</p></details>)}
      </section>
    </main>
    <footer className="border-t border-line max-w-6xl mx-auto px-5 md:px-8 py-7 flex flex-wrap justify-between gap-4 text-sm text-muted"><span>Qurioso · Maurizio Napolitano</span><a href="https://github.com/napo/qurioso" className="text-petrolio underline">{t.openSource}</a></footer>
  </div>;
}
