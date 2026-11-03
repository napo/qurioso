import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { lobbyTranslations } from '../../i18n/lobby';
import { fill } from '../../i18n/format';
import type { Player } from '../../types/quiz';

/** A warning next to a participant who joined from the same browser as others. */
export function SharedDevice({ others: ids = [], players }: { others?: string[]; players: Record<string, Player> }) {
  const { language } = useLanguage(), lobby = lobbyTranslations[language];
  const others = ids.map(id => players[id]?.name || players[id]?.nickname).filter((name): name is string => Boolean(name));
  if (!others.length) return null;
  const text = fill(lobby.sameDevice, { names: others.join(', ') });
  return <span className="shared-device shrink-0 inline-flex items-center gap-1 text-xs text-accent-ink" title={`${text}. ${lobby.sameDeviceHint}`}>
    <AlertTriangle className="w-4 h-4" aria-hidden="true" /><span className="sr-only">{text}. {lobby.sameDeviceHint}</span>
  </span>;
}
