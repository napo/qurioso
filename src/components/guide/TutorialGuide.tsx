import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, ExternalLink } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { guideLessons, guideTranslations, tutorialIds, type GuideAction, type TutorialId } from '../../i18n/guide';
import { guideScreenshot, guideScreenshotText } from '../../i18n/guideScreenshots';
import { sharingLinks } from '../../i18n/internetSharing';
import { LanguageSelector } from '../common/LanguageSelector';
import { QuriosoLogo } from '../common/QuriosoLogo';

interface Cursor { topic: TutorialId; step: number }
export function readGuideLocation(): Cursor {
  const params = new URLSearchParams(window.location.search);
  const candidate = params.get('topic') as TutorialId;
  const topic = tutorialIds.includes(candidate) ? candidate : 'start';
  const number = Number(params.get('step') || 1);
  return { topic, step: Math.min(guideLessons.it[topic].steps.length - 1, Math.max(0, Number.isSafeInteger(number) ? number - 1 : 0)) };
}

export function TutorialGuide() {
  const { language, setLanguage } = useLanguage(), t = guideTranslations[language], lessons = guideLessons[language];
  const [preview, setPreview] = useState(false);
  const pictureText = guideScreenshotText[language];
  const [cursor, setCursor] = useState(readGuideLocation);
  const article = useRef<HTMLElement>(null), focusRequested = useRef(false);
  const lesson = lessons[cursor.topic], step = lesson.steps[cursor.step], topicIndex = tutorialIds.indexOf(cursor.topic);
  const home = `./?lang=${language}`, last = cursor.step === lesson.steps.length - 1;
  useEffect(() => {
    const back = () => {
      const code = new URLSearchParams(window.location.search).get('lang');
      if (code === 'it' || code === 'en' || code === 'de') setLanguage(code);
      focusRequested.current = true; setCursor(readGuideLocation());
    };
    window.addEventListener('popstate', back); return () => window.removeEventListener('popstate', back);
  }, []);
  useEffect(() => { document.title = `${lesson.title} · ${t.title} · Qurioso`; }, [lesson.title, t.title]);
  useEffect(() => {
    if (!focusRequested.current) return;
    focusRequested.current = false;
    article.current?.focus({ preventScroll: true });
    article.current?.scrollIntoView?.({ block: 'nearest' });
  }, [cursor]);
  const go = (topic: TutorialId, step = 0) => {
    setPreview(false);
    const url = new URL(window.location.href);
    url.search = new URLSearchParams({ app: 'guide', lang: language, topic, step: String(step + 1) }).toString(); url.hash = '';
    window.history.pushState(null, '', url);
    focusRequested.current = true; setCursor({ topic, step });
  };
  const href = (action: GuideAction) => {
    if (action === 'cloudflareDocs') return sharingLinks.docs;
    if (action === 'status') return sharingLinks.service;
    if (action === 'downloads') return `${home}#quiz-in-rete`;
    const mode = action === 'library' && window.quriosoDesktop ? 'network' : 'classroom';
    return `./?app=${mode}&lang=${language}`;
  };
  return <div data-tutorial-guide className="min-h-screen bg-qurioso-canvas text-ink">
    <header className="max-w-6xl mx-auto p-4 md:px-8 flex flex-wrap items-center justify-between gap-4 border-b border-line">
      <a href={home} aria-label={t.home}><QuriosoLogo size="md" /></a>
      <nav aria-label={t.nav} className="flex items-center gap-4"><a href={home} className="font-bold text-sm text-petrolio underline">{t.home}</a><LanguageSelector /></nav>
    </header>
    <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      <div className="max-w-3xl space-y-3"><p className="flex items-center gap-2 font-bold text-petrolio text-sm"><BookOpen size={18} />Qurioso · {t.nav}</p><h1 className="text-3xl md:text-4xl font-black text-petrolio">{t.title}</h1><p className="text-muted leading-relaxed">{t.intro}</p></div>
      <label className="block lg:hidden font-bold text-sm text-petrolio">{t.topics}<select aria-label={t.topics} value={cursor.topic} onChange={event => go(event.target.value as TutorialId)} className="block w-full mt-2 rounded-xl border border-line p-3 bg-white text-ink">{tutorialIds.map(id => <option value={id} key={id}>{lessons[id].title}</option>)}</select></label>
      <div className="grid lg:grid-cols-[17rem_minmax(0,1fr)] gap-6 items-start">
        <aside className="hidden lg:block lg:sticky lg:top-4"><nav aria-label={t.topics} className="rounded-2xl border border-line bg-white p-3 space-y-1"><h2 className="font-bold text-petrolio px-3 py-2">{t.topics}</h2>{tutorialIds.map((id, index) => <button type="button" key={id} aria-current={id === cursor.topic ? 'page' : undefined} onClick={() => go(id)} className={`w-full min-h-11 px-3 py-2 rounded-xl text-left text-sm flex items-start gap-2 ${id === cursor.topic ? 'bg-petrolio text-white font-bold' : 'text-petrolio hover:bg-surface-soft'}`}><span className="font-mono shrink-0">{String(index + 1).padStart(2, '0')}</span><span>{lessons[id].title}</span></button>)}</nav></aside>
        <article ref={article} tabIndex={-1} aria-labelledby="tutorial-title" className="min-w-0 rounded-2xl border border-line bg-white p-5 md:p-7 space-y-5 focus:outline-petrolio">
          <div className="space-y-2"><p className="text-sm font-bold text-accent-ink">{t.tutorial} {topicIndex + 1} · {t[lesson.audience]}</p><h2 id="tutorial-title" className="text-2xl font-black text-petrolio">{lesson.title}</h2><p className="text-muted">{lesson.summary}</p></div>
          <div className="bg-surface-soft border border-line rounded-xl p-4 text-sm"><h3 className="font-bold text-petrolio mb-1">{t.requirements}</h3><p>{lesson.needs}</p></div>
          <div className="space-y-2"><p role="status" className="font-bold text-sm text-petrolio">{t.step} {cursor.step + 1} {t.of} {lesson.steps.length}</p><progress aria-label={t.steps} value={cursor.step + 1} max={lesson.steps.length} className="w-full accent-petrolio" /><nav aria-label={t.steps} className="flex flex-wrap gap-2">{lesson.steps.map((item, index) => <button type="button" key={index} onClick={() => go(cursor.topic, index)} aria-label={`${t.step} ${index + 1}: ${item.title}`} aria-current={index === cursor.step ? 'step' : undefined} className={`min-w-11 min-h-11 rounded-xl border font-bold ${index === cursor.step ? 'bg-petrolio border-petrolio text-white' : 'border-line bg-surface-soft text-petrolio'}`}>{index < cursor.step ? <Check size={18} className="mx-auto" /> : index + 1}</button>)}</nav></div>
          <section data-guide-step className="space-y-4 py-3 [overflow-wrap:anywhere]"><h3 className="text-xl font-black text-ink">{step.title}</h3><p className="leading-relaxed text-base md:text-lg">{step.body}</p>{step.action && <a href={href(step.action)} {...(step.action === 'cloudflareDocs' || step.action === 'status' ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="inline-flex items-center gap-2 min-h-11 rounded-xl border border-line px-4 py-3 font-bold text-petrolio">{t[step.action]}<ExternalLink size={16} className="shrink-0" /></a>}</section>
          <figure className="space-y-2"><button type="button" className="w-full cursor-zoom-in rounded-xl border border-line overflow-hidden bg-surface-soft" aria-label={pictureText.zoom} onClick={() => setPreview(true)}><img loading="lazy" src={`./guide/${language}/${guideScreenshot[cursor.topic]}.png`} alt={`${lesson.title} · Tipi di vulcani con geopop`} className="w-full max-h-80 object-contain" /></button><figcaption className="text-sm text-muted">{pictureText.caption}</figcaption></figure>
          {last && <p className="text-sm font-bold text-petrolio flex items-center gap-2"><Check size={18} />{t.end}</p>}
          <div className="flex flex-wrap justify-between gap-3 pt-4 border-t border-line"><button type="button" onClick={() => go(cursor.topic, cursor.step - 1)} disabled={cursor.step === 0} className="min-h-11 rounded-xl border border-line px-4 py-3 font-bold text-petrolio disabled:opacity-40 inline-flex items-center gap-2"><ArrowLeft size={18} />{t.previous}</button><button type="button" onClick={() => last ? go(tutorialIds[(topicIndex + 1) % tutorialIds.length]) : go(cursor.topic, cursor.step + 1)} className="min-h-11 rounded-xl btn-mandarino px-4 py-3 font-bold inline-flex items-center gap-2">{last ? topicIndex === tutorialIds.length - 1 ? t.restart : t.nextTopic : t.next}<ArrowRight size={18} /></button></div>
          {(cursor.topic === 'internet' || cursor.topic === 'problems') && <aside className="text-sm space-y-2 pt-3 border-t border-line"><h3 className="font-bold text-petrolio">{t.references}</h3><div className="flex flex-wrap gap-3">{[['cloudflareDocs', sharingLinks.docs], ['status', sharingLinks.service], ['privacy', sharingLinks.privacy]].map(([key, url]) => <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="underline text-petrolio">{t[key as 'cloudflareDocs' | 'status' | 'privacy']}</a>)}</div></aside>}
        </article>
      </div>
    </main>
    {preview && <div role="dialog" aria-modal="true" aria-label={pictureText.zoom} className="fixed inset-0 z-50 bg-black/80 p-3 flex flex-col items-center gap-3 overflow-auto" onKeyDown={event => { if (event.key === 'Escape') setPreview(false); }}><button autoFocus type="button" onClick={() => setPreview(false)} className="sticky top-0 bg-white rounded-xl px-4 py-3 font-bold text-petrolio">{pictureText.close}</button><img src={`./guide/${language}/${guideScreenshot[cursor.topic]}.png`} alt={`${lesson.title} · Tipi di vulcani con geopop`} className="max-w-full h-auto" /></div>}
  </div>;
}
