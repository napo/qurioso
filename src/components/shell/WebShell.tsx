import React from 'react';
import { Header } from '../common/Header';
import { QuriosoIcon } from '../common/QuriosoLogo';
import { OfflineIndicator } from '../common/OfflineIndicator';
import { AuthorLink } from '../common/AuthorLink';
import { useLanguage } from '../../context/LanguageContext';
import { settingsTranslations } from '../../i18n/settings';
import type { ServerInfo } from '../../services/gameSync';

/** Website frame: page header, link back to the landing page and project footer. */
export function WebShell({ classroomOnly, serverInfo, onOpenSettings, onJoinClick, onShowGuide, children }: {
  classroomOnly: boolean; serverInfo: ServerInfo | null;
  onOpenSettings: () => void; onJoinClick: () => void; onShowGuide: () => void; children: React.ReactNode;
}) {
  const { t, language } = useLanguage();
  const labels = settingsTranslations[language];
  return (
    <div data-qurioso-dashboard data-shell="web" className="min-h-screen bg-qurioso-canvas text-ink flex flex-col select-none">
      <Header classroomOnly={classroomOnly} serverInfo={serverInfo} onOpenSettings={onOpenSettings} onJoinClick={onJoinClick} />

      <OfflineIndicator />

      {/* Main Content */}
      <main className="flex-1 w-full p-4 md:p-8 space-y-8">
        <a href="./" className="inline-block text-sm font-bold text-petrolio underline">{labels.backHome}</a>
        {children}
      </main>

      {/* Footer with Qurioso Q Icon, Author, and Affero GPL License */}
      <footer className="w-full border-t border-line bg-surface-soft py-6 px-4 md:px-8 text-center text-xs text-muted">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2.5">
            <span className="flex items-center gap-2.5">
              <QuriosoIcon size={26} variant="contained" />
              <span className="font-extrabold text-ink">Qurioso</span>
            </span>
            <span aria-hidden="true" className="hidden sm:inline">•</span>
            <span>{t.authorLabel}: <AuthorLink className="underline hover:text-ink" /></span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 text-[11px] text-muted">
            <span className="max-w-xs sm:max-w-none">{t.licenseLabel}</span>
            <span aria-hidden="true" className="hidden sm:inline">•</span>
            <button
              onClick={onShowGuide}
              className="text-accent-ink hover:underline cursor-pointer font-semibold"
            >
              {t.buildAndGitHub}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
