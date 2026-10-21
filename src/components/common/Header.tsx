import React, { useState } from 'react';
import {
  Settings,
  BookOpen,
  Volume2,
  VolumeX,
  Smartphone,
} from 'lucide-react';
import { AppVersion } from './AppVersion';
import { PWAInstallButton } from './PWAInstallButton';
import { LanguageSelector } from './LanguageSelector';
import { QuriosoLogo } from './QuriosoLogo';
import { sounds } from '../../services/soundEffects';
import { useLanguage } from '../../context/LanguageContext';
import { settingsTranslations } from '../../i18n/settings';
import { workspaceTranslations } from '../../i18n/workspace';
import { guideNavigation } from '../../i18n/guideNavigation';
import type { ServerInfo } from '../../services/gameSync';

interface HeaderProps {
  classroomOnly?: boolean;
  serverInfo?: ServerInfo | null;
  onOpenSettings: () => void;
  onJoinClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  classroomOnly = false,
  serverInfo,
  onOpenSettings,
  onJoinClick,
}) => {
  const { t, language } = useLanguage();
  const labels = settingsTranslations[language];
  const workspace = workspaceTranslations[language];
  const [isMuted, setIsMuted] = useState(sounds.getMuted());
  const handleToggleSound = () => {
    const muted = sounds.toggleMute();
    setIsMuted(muted);
  };

  return (
    <header className="w-full bg-white backdrop-blur-md border-b border-line sticky top-0 z-30 px-4 md:px-8 py-3.5 flex flex-wrap gap-3 items-center justify-between">
      {/* Brand with iconic Q in petrolio & mandarino */}
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1><QuriosoLogo size="md" /></h1>
            {!classroomOnly && serverInfo && <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-soft border border-line text-[10px] font-bold text-petrolio" title={labels.serverAddressTitle}>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="hidden sm:inline">{labels.serverPort} {serverInfo?.port || '…'} Live</span>
              <span className="sm:hidden">:{serverInfo?.port || '…'}</span>
            </div>}
          </div>
          <div className="flex flex-wrap items-center gap-x-2">
            <AppVersion />
            <p className="text-[11px] text-muted hidden sm:block">{window.quriosoDesktop ? workspace.desktop : serverInfo ? workspace.local : workspace.web}</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Language Selector */}
        <LanguageSelector />

        <a href={`?app=guide&lang=${language}`} aria-label={guideNavigation[language].nav} title={guideNavigation[language].title} className="flex items-center gap-1.5 rounded-xl border border-line p-2 text-petrolio font-bold text-xs"><BookOpen size={18} /><span className="hidden lg:inline">{guideNavigation[language].nav}</span></a>

        {!classroomOnly && !window.quriosoDesktop && <PWAInstallButton />}

        {/* Join as Player Quick Button */}
        {!classroomOnly && serverInfo && <button
          onClick={onJoinClick}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-soft hover:bg-surface-hover text-xs font-semibold text-muted border border-line transition active:scale-95 cursor-pointer"
          title={t.joinWithPin}
        >
          <Smartphone className="w-3.5 h-3.5 text-accent-ink" />
          <span className="hidden sm:inline">{t.joinWithPin}</span>
          <span className="sm:hidden">PIN</span>
        </button>}

        {/* Sound Toggle */}
        <button
          onClick={handleToggleSound}
          className="p-2 rounded-xl bg-surface-soft hover:bg-surface-hover text-muted hover:text-ink border border-line transition cursor-pointer"
          title={isMuted ? t.unmuteAudio : t.muteAudio}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-rose-700" /> : <Volume2 className="w-4 h-4 text-emerald-700" />}
        </button>

        {/* Application settings */}
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-soft hover:bg-surface-hover text-xs font-semibold text-muted border border-line transition cursor-pointer"
          title={labels.settings} aria-label={labels.settings}
        >
          <Settings className="w-4 h-4" />
          <span className="hidden lg:inline">{labels.settings}</span>
        </button>
      </div>
    </header>
  );
};
