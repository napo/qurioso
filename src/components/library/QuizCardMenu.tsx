import React, { useEffect, useId, useRef, useState } from 'react';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { ImageCredit } from '../common/ImageCredit';
import type { ImageAttribution } from '../../types/quiz';

export interface QuizCardAction { label: string; icon: LucideIcon; onSelect: () => void; danger?: boolean }

/** "⋯" disclosure for the compact (mobile) card: secondary actions and image credits. */
export function QuizCardMenu({ label, actions, attribution, creditsLabel }: {
  label: string; actions: QuizCardAction[]; attribution?: ImageAttribution; creditsLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), panel = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return <div ref={root} className="relative" onKeyDown={event => { if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); trigger.current?.focus(); } }}>
    <button ref={trigger} type="button" aria-label={label} title={label} aria-expanded={open} aria-controls={panel} onClick={() => setOpen(!open)}
      className="grid place-items-center w-11 h-11 rounded-full text-muted hover:bg-surface-hover hover:text-ink"><MoreHorizontal className="w-5 h-5" /></button>
    {open && <div id={panel} className="absolute right-0 top-full z-20 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-white p-1 shadow-lg">
      {actions.map(({ label: text, icon: Icon, onSelect, danger }) => <button key={text} type="button" onClick={() => { setOpen(false); onSelect(); }}
        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold hover:bg-surface-soft ${danger ? 'text-rose-700' : 'text-ink'}`}>
        <Icon className="w-4 h-4" />{text}
      </button>)}
      {attribution && <div className="mt-1 border-t border-line px-3 pt-2 pb-1"><p className="text-[11px] font-bold text-muted">{creditsLabel}</p><ImageCredit attribution={attribution} /></div>}
    </div>}
  </div>;
}
