import React from 'react';
import type { Player, Team } from '../../types/quiz';
import { teamStandings } from '../../services/teams';
import { OPTION_COLORS } from '../../utils/quizStyles';
import { lobbyTranslations } from '../../i18n/lobby';
import { fill } from '../../i18n/format';
import { useLanguage } from '../../context/LanguageContext';

/** Teams by average score of their members, shown above the individual ranking. */
export function TeamRanking({ teams, players }: { teams: Team[]; players: Player[] }) {
  const { language } = useLanguage(), lobby = lobbyTranslations[language];
  return <section aria-labelledby="team-ranking-title" className="team-ranking space-y-2">
    <h3 id="team-ranking-title" className="text-lg font-black text-ink">{lobby.teamRanking}</h3>
    <ol className="space-y-2">{teamStandings(teams, players).map((standing, index) => <li key={standing.team.id}
      className={`flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 ${OPTION_COLORS[standing.team.color].border} ${OPTION_COLORS[standing.team.color].bg}`}>
      <span className="font-black text-ink">{index + 1}. {standing.team.name} <span className="text-xs font-semibold text-muted">· {fill(lobby.teamMembers, { n: standing.members.length })}</span></span>
      <span className="font-mono font-black text-ink">{fill(lobby.teamAverage, { score: standing.score.toLocaleString() })}</span>
    </li>)}</ol>
  </section>;
}
