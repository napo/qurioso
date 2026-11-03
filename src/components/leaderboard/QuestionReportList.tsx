import React from 'react';
import { correctShare, hardestFirst, mostChosen, mostChosenWrong, type QuestionReport } from '../../services/gameReport';
import { lobbyTranslations } from '../../i18n/lobby';
import { fill } from '../../i18n/format';
import { useLanguage } from '../../context/LanguageContext';

/** Every question, hardest first, with the class's share of correct answers. Counts only, never names. */
export function QuestionReportList({ reports }: { reports: QuestionReport[] }) {
  const { language } = useLanguage(), lobby = lobbyTranslations[language];
  return (
    <ol className="space-y-2">
      {hardestFirst(reports).map(report => {
        const percent = Math.round(correctShare(report) * 100), wrong = report.scored ? mostChosenWrong(report) : undefined, top = report.scored ? undefined : mostChosen(report);
        return <li key={report.questionId} className="rounded-xl border border-line bg-surface-soft p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-bold text-ink min-w-0 break-words"><span className="text-muted mr-1">{report.index + 1}.</span>{report.text}</p>
            <p className={`font-black ${!report.scored || !report.answered ? 'text-muted' : percent >= 70 ? 'text-emerald-700' : percent >= 40 ? 'text-accent-ink' : 'text-rose-700'}`}>
              {!report.scored ? lobby.pollReport : report.answered ? fill(lobby.reportCorrect, { percent }) : lobby.reportNoAnswers}
            </p>
          </div>
          {report.scored && <div aria-hidden="true" className="mt-2 h-2 rounded-full bg-white border border-line overflow-hidden"><div className="h-full bg-petrolio" style={{ width: `${report.answered ? percent : 0}%` }} /></div>}
          <p className="mt-1 text-xs text-muted">{fill(lobby.reportAnswers, { answered: report.answered, players: report.players })}{wrong ? ` · ${fill(lobby.reportWrong, { text: wrong.text })}` : ''}{top ? ` · ${fill(lobby.pollTop, { text: top.text })}` : ''}</p>
        </li>;
      })}
    </ol>
  );
}
