import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Medal, Download, ArrowLeft, RotateCcw, Check, Sparkles, Clock, Flame } from 'lucide-react';
import { Player, Question } from '../../types/quiz';
import { sounds } from '../../services/soundEffects';
import { useLanguage } from '../../context/LanguageContext';
import { QuriosoIcon } from '../common/QuriosoLogo';

interface FinalPodiumProps {
  players: Player[] | Record<string, Player>;
  quizTitle?: string;
  totalQuestions?: number;
  onPlayAgain?: () => void;
  onRestart?: () => void;
  onExit: () => void;
}

export const FinalPodium: React.FC<FinalPodiumProps> = ({
  players,
  quizTitle = 'Qurioso Quiz',
  totalQuestions = 10,
  onPlayAgain,
  onRestart,
  onExit,
}) => {
  const { t } = useLanguage();
  const playerList: Player[] = Array.isArray(players) ? players : Object.values(players);

  // Sort players descending by score
  const sortedPlayers = [...playerList].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.totalTimeTakenMs || 0) - (b.totalTimeTakenMs || 0);
  });

  const first = sortedPlayers[0];
  const second = sortedPlayers[1];
  const third = sortedPlayers[2];
  const others = sortedPlayers.slice(3);

  useEffect(() => {
    sounds.playPodiumFanfare();

    // Multi-stage confetti celebration
    const duration = 3.5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

    const interval: NodeJS.Timeout = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        return clearInterval(interval);
      }
      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: 0.2, y: 0.5 } });
      confetti({ ...defaults, particleCount, origin: { x: 0.8, y: 0.5 } });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  const exportToCSV = () => {
    const headers = ['Posizione', 'Nome Giocatore', 'Punteggio Totale', 'Risposte Corrette', 'Precisione %', 'Tempo Totale (s)'];
    const rows = sortedPlayers.map((p, idx) => {
      const correct = p.correctAnswersCount || 0;
      const totalTime = p.totalTimeTakenMs || 0;
      return [
        idx + 1,
        `"${(p.name || p.nickname || '').replace(/"/g, '""')}"`,
        p.score,
        `${correct}/${totalQuestions}`,
        `${Math.round((correct / Math.max(1, totalQuestions)) * 100)}%`,
        (totalTime / 1000).toFixed(2),
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `classifica_${quizTitle.toLowerCase().replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToJSON = () => {
    const exportData = {
      quizTitle,
      timestamp: new Date().toISOString(),
      totalQuestions,
      rankings: sortedPlayers.map((p, idx) => {
        const correct = p.correctAnswersCount || 0;
        const totalTime = p.totalTimeTakenMs || 0;
        return {
          rank: idx + 1,
          nickname: p.name || p.nickname,
          score: p.score,
          correctAnswers: correct,
          accuracyPercent: Math.round((correct / Math.max(1, totalQuestions)) * 100),
          totalTimeSeconds: Number((totalTime / 1000).toFixed(2)),
        };
      }),
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `classifica_${quizTitle.toLowerCase().replace(/\s+/g, '_')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="min-h-full w-full bg-white text-ink flex flex-col p-4 md:p-8 overflow-y-auto">
      {/* Top Header */}
      <div className="max-w-4xl mx-auto w-full flex items-center justify-between mb-8 pb-4 border-b border-line">
        <div className="flex items-center gap-3">
          <QuriosoIcon size={44} variant="rounded" />
          <div>
            <span className="text-xs uppercase font-extrabold tracking-widest text-petrolio">
              {t.finalLeaderboardTitle}
            </span>
            <h1 className="text-2xl md:text-3xl font-black text-ink mt-0.5">
              {quizTitle}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface-soft hover:bg-surface-hover text-muted text-xs font-bold rounded-xl border border-line transition active:scale-95 cursor-pointer"
            title="CSV Export"
          >
            <Download className="w-4 h-4 text-emerald-700" />
            <span>{t.exportCsv}</span>
          </button>
          <button
            onClick={exportToJSON}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface-soft hover:bg-surface-hover text-muted text-xs font-bold rounded-xl border border-line transition active:scale-95 cursor-pointer"
            title="JSON Export"
          >
            <Download className="w-4 h-4 text-petrolio" />
            <span>{t.exportJson}</span>
          </button>
        </div>
      </div>

      {/* 3-Tier Podium */}
      <div className="max-w-3xl mx-auto w-full flex items-end justify-center gap-3 md:gap-6 my-6 min-h-[320px]">
        {/* 2nd Place (Silver) */}
        <div className="flex-1 flex flex-col items-center max-w-[180px]">
          {second ? (
            <div className="flex flex-col items-center w-full animate-in slide-in-from-bottom duration-700">
              <div className="w-16 h-16 rounded-full bg-surface-soft border-3 border-line flex items-center justify-center text-3xl shadow-md relative -mb-3 z-10">
                {second.avatar}
                <span className="absolute -top-2 -right-2 bg-surface-soft text-muted w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shadow-md">
                  2
                </span>
              </div>
              <div className="w-full bg-gradient-to-t from-surface-soft to-surface-soft rounded-t-2xl pt-6 pb-4 px-2 text-center border-t-4 border-line shadow-md flex flex-col items-center h-48 justify-between">
                <div>
                  <div className="font-extrabold text-sm md:text-base text-ink truncate max-w-full">
                    {second.nickname}
                  </div>
                  <div className="text-xs font-bold text-muted mt-1">
                    {second.score} pts
                  </div>
                </div>
                <div className="text-[11px] text-muted bg-white px-2 py-0.5 rounded-full">
                  {second.correctAnswersCount}/{totalQuestions} {t.correctBadge}
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full h-36 bg-white rounded-t-2xl border-dashed border border-line" />
          )}
        </div>

        {/* 1st Place (Gold Winner) */}
        <div className="flex-1 flex flex-col items-center max-w-[210px] z-20">
          {first ? (
            <div className="flex flex-col items-center w-full animate-in slide-in-from-bottom duration-500">
              {/* Crown Icon */}
              <div className="text-accent-ink -mb-1 animate-bounce">
                <Trophy className="w-8 h-8 fill-amber-400" />
              </div>
              <div className="w-20 h-20 rounded-full bg-mandarino/20 border-4 border-mandarino flex items-center justify-center text-4xl shadow-lg relative -mb-3 z-10">
                {first.avatar}
                <span className="absolute -top-2 -right-2 bg-mandarino text-ink w-7 h-7 rounded-full flex items-center justify-center font-black text-sm shadow-md">
                  1
                </span>
              </div>
              <div className="w-full bg-gradient-to-t from-mandarino/10 to-mandarino/25 rounded-t-2xl pt-6 pb-5 px-3 text-center border-t-4 border-mandarino shadow-lg flex flex-col items-center h-60 justify-between">
                <div>
                  <div className="font-black text-base md:text-lg text-accent-ink truncate max-w-full">
                    {first.nickname}
                  </div>
                  <div className="text-sm font-black text-ink mt-1">
                    {first.score} pts
                  </div>
                </div>
                <div className="text-xs font-semibold text-accent-ink bg-mandarino px-3 py-1 rounded-full border border-mandarino/30">
                  {t.championBadge}
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full h-48 bg-white rounded-t-2xl border-dashed border border-line" />
          )}
        </div>

        {/* 3rd Place (Bronze) */}
        <div className="flex-1 flex flex-col items-center max-w-[180px]">
          {third ? (
            <div className="flex flex-col items-center w-full animate-in slide-in-from-bottom duration-1000">
              <div className="w-16 h-16 rounded-full bg-surface-soft border-3 border-mandarino flex items-center justify-center text-3xl shadow-md relative -mb-3 z-10">
                {third.avatar}
                <span className="absolute -top-2 -right-2 bg-mandarino text-ink w-6 h-6 rounded-full flex items-center justify-center font-black text-xs shadow-md">
                  3
                </span>
              </div>
              <div className="w-full bg-gradient-to-t from-surface-soft to-mandarino/10 rounded-t-2xl pt-6 pb-4 px-2 text-center border-t-4 border-mandarino shadow-md flex flex-col items-center h-40 justify-between">
                <div>
                  <div className="font-extrabold text-sm md:text-base text-ink truncate max-w-full">
                    {third.nickname}
                  </div>
                  <div className="text-xs font-bold text-accent-ink mt-1">
                    {third.score} pts
                  </div>
                </div>
                <div className="text-[11px] text-muted bg-white px-2 py-0.5 rounded-full">
                  {third.correctAnswersCount}/{totalQuestions} {t.correctBadge}
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full h-28 bg-white rounded-t-2xl border-dashed border border-line" />
          )}
        </div>
      </div>

      {/* Full Leaderboard Table */}
      <div className="max-w-4xl mx-auto w-full mt-6 bg-white rounded-3xl border border-line overflow-hidden shadow-md">
        <div className="px-6 py-4 border-b border-line flex items-center justify-between">
          <h3 className="font-bold text-ink text-base flex items-center gap-2">
            <Medal className="w-5 h-5 text-petrolio" />
            {t.completeAnswersTable}
          </h3>
          <span className="text-xs text-muted">
            {sortedPlayers.length} {t.participantsCount}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm">
            <thead className="bg-white text-muted uppercase text-[11px] font-semibold border-b border-line">
              <tr>
                <th className="px-4 py-3 text-center">{t.posCol}</th>
                <th className="px-4 py-3">{t.playerCol}</th>
                <th className="px-4 py-3 text-right">{t.pointsCol}</th>
                <th className="px-4 py-3 text-center">{t.correctCol}</th>
                <th className="px-4 py-3 text-center">{t.accuracyCol}</th>
                <th className="px-4 py-3 text-right">{t.avgTimeCol}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sortedPlayers.map((player, idx) => {
                const correctCount = player.correctAnswersCount || 0;
                const totalTime = player.totalTimeTakenMs || 0;
                const accuracy = Math.round(
                  (correctCount / Math.max(1, totalQuestions)) * 100
                );
                const avgTime = correctCount > 0
                  ? (totalTime / Math.max(1, correctCount) / 1000).toFixed(1)
                  : '-';

                return (
                  <tr
                    key={player.id}
                    className={`hover:bg-surface-hover transition ${
                      idx < 3 ? 'bg-surface-soft/20' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-center font-bold">
                      {idx === 0 && <span className="text-accent-ink">🥇 1</span>}
                      {idx === 1 && <span className="text-muted">🥈 2</span>}
                      {idx === 2 && <span className="text-accent-ink">🥉 3</span>}
                      {idx > 2 && <span className="text-muted">#{idx + 1}</span>}
                    </td>
                    <td className="px-4 py-3 font-semibold text-ink flex items-center gap-2.5">
                      <span className="text-xl">{player.avatar}</span>
                      <span>{player.nickname}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-black text-petrolio">
                      {player.score.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center text-muted font-medium">
                      {player.correctAnswersCount} / {totalQuestions}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          accuracy >= 80
                            ? 'bg-emerald-500/20 text-emerald-700 border border-emerald-500/30'
                            : accuracy >= 50
                            ? 'bg-surface-soft/20 text-petrolio border border-petrolio/30'
                            : 'bg-rose-500/20 text-rose-700 border border-rose-500/30'
                        }`}
                      >
                        {accuracy}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-muted font-mono text-xs">
                      {avgTime !== '-' ? `${avgTime}s` : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="max-w-4xl mx-auto w-full flex items-center justify-center gap-4 mt-8 pb-8">
        <button
          onClick={onRestart || onPlayAgain}
          className="btn-mandarino flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm shadow-md transition active:scale-95 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>{t.playAgain}</span>
        </button>

        <button
          onClick={onExit}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-surface-soft hover:bg-surface-hover text-muted hover:text-ink font-semibold text-sm border border-line transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.backToDashboard}</span>
        </button>
      </div>
    </div>
  );
};
