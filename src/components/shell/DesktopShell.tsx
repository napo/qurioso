import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus, Settings, Video, ListChecks } from 'lucide-react';
import { QuriosoLogo } from '../common/QuriosoLogo';
import { useLanguage } from '../../context/LanguageContext';
import { settingsTranslations } from '../../i18n/settings';
import { workspaceTranslations } from '../../i18n/workspace';
import type { ServerInfo } from '../../services/gameSync';
import type { InternetSharingState } from '../../types/desktop';

type Workspace = typeof workspaceTranslations['it'];

function useSharingPhase() {
  const [phase, setPhase] = useState<InternetSharingState['phase']>('idle');
  useEffect(() => {
    const api = window.quriosoDesktop?.internetSharing;
    if (typeof api?.status !== 'function' || typeof api.onChange !== 'function') return;
    let alive = true;
    api.status().then(state => { if (alive) setPhase(state.phase); }).catch(() => {});
    const unsubscribe = api.onChange(state => setPhase(state.phase));
    return () => { alive = false; unsubscribe(); };
  }, []);
  return phase;
}

function ServerBadge({ serverInfo, w }: { serverInfo: ServerInfo | null; w: Workspace }) {
  const phase = useSharingPhase();
  const [label, tone] = !serverInfo ? [w.serverStarting, 'bg-surface-soft text-muted']
    : phase === 'active' ? [w.internetActive, 'bg-emerald-50 text-emerald-800 border-emerald-200']
    : phase === 'reconnecting' || phase === 'error' ? [w.internetInterrupted, 'bg-rose-50 text-rose-700 border-rose-200']
    : [w.serverLan, 'bg-surface-soft text-petrolio'];
  const dot = !serverInfo ? 'bg-muted' : phase === 'reconnecting' || phase === 'error' ? 'bg-rose-600' : 'bg-emerald-500';
  return <span role="status" data-server-badge={!serverInfo ? 'starting' : phase === 'active' ? 'internet' : phase === 'reconnecting' || phase === 'error' ? 'interrupted' : 'lan'}
    aria-label={`${w.serverStatus}: ${label}`} title={serverInfo ? w.serverPort.replace('{port}', String(serverInfo.port)) : undefined}
    className={`inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-[11px] font-bold ${tone}`}>
    <span aria-hidden="true" className={`w-2 h-2 rounded-full ${dot}`} />{label}
  </span>;
}

export function NewQuizMenu({ w, onCreateQuiz }: { w: Workspace; onCreateQuiz: (withVideo: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), items = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    if (!open) return;
    items.current[0]?.focus();
    const outside = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [open]);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  const onMenuKey = (event: React.KeyboardEvent) => {
    const position = items.current.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      items.current[(position + (event.key === 'ArrowDown' ? 1 : -1) + items.current.length) % items.current.length]?.focus();
    } else if (event.key === 'Tab') setOpen(false);
  };
  const choose = (withVideo: boolean) => { setOpen(false); onCreateQuiz(withVideo); };
  return <div ref={root} className="relative">
    <button ref={trigger} type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}
      onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); } }}
      className="btn-mandarino inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold">
      <Plus className="w-4 h-4" />{w.newQuiz}<ChevronDown className="w-4 h-4" />
    </button>
    {open && <div role="menu" aria-label={w.newQuiz} onKeyDown={onMenuKey} className="absolute right-0 z-40 mt-1.5 min-w-48 rounded-xl border border-line bg-white p-1 shadow-lg">
      {([[false, w.classicQuiz, ListChecks], [true, w.videoQuiz, Video]] as const).map(([withVideo, label, Icon], i) =>
        <button key={label} ref={element => { items.current[i] = element; }} type="button" role="menuitem" tabIndex={-1} onClick={() => choose(withVideo)}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-surface-soft focus:bg-surface-soft focus:outline-none">
          <Icon className="w-4 h-4 text-petrolio" />{label}
        </button>)}
    </div>}
  </div>;
}

/** Two-option switch above the library; the extended explanation lives in the guide. */
export function ActivityModeSwitch({ mode, onChange }: { mode: 'classroom' | 'network'; onChange: (mode: 'classroom' | 'network') => void }) {
  const { language } = useLanguage(), w = workspaceTranslations[language];
  return <div role="group" aria-label={w.mode} className="inline-flex rounded-xl border border-line bg-white p-1">
    {(['classroom', 'network'] as const).map(option => <button key={option} type="button" data-activity-mode={option} aria-pressed={mode === option} onClick={() => onChange(option)}
      className={`rounded-lg px-4 py-1.5 text-sm font-bold ${mode === option ? 'bg-petrolio text-white shadow-sm' : 'text-petrolio hover:bg-surface-soft'}`}>
      {option === 'classroom' ? w.classroom : w.network}
    </button>)}
  </div>;
}

/** Desktop frame: a compact toolbar instead of the website header and footer. */
export function DesktopShell({ serverInfo, onCreateQuiz, onOpenSettings, children }: {
  serverInfo: ServerInfo | null; onCreateQuiz: (withVideo: boolean) => void; onOpenSettings: () => void; children: React.ReactNode;
}) {
  const { language } = useLanguage();
  const w = workspaceTranslations[language], labels = settingsTranslations[language];
  return (
    <div data-qurioso-dashboard data-shell="desktop" className="min-h-screen bg-qurioso-canvas text-ink flex flex-col select-none">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-white px-4 md:px-6 py-2">
        <div className="flex items-center gap-3"><QuriosoLogo size="sm" /><ServerBadge serverInfo={serverInfo} w={w} /></div>
        <div className="flex items-center gap-2">
          <NewQuizMenu w={w} onCreateQuiz={onCreateQuiz} />
          <button type="button" onClick={onOpenSettings} title={labels.settings} aria-label={labels.settings}
            className="rounded-xl border border-line bg-surface-soft p-2 text-muted hover:bg-surface-hover hover:text-ink"><Settings className="w-4 h-4" /></button>
        </div>
      </header>
      <main className="flex-1 w-full p-4 md:p-6 space-y-5">{children}</main>
    </div>
  );
}
