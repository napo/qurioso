import React, { useState, useEffect } from 'react';
import {
  Github,
  Volume2,
  VolumeX,
  Smartphone,
  Plus,
  Radio,
  Server
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { LanguageSelector } from './LanguageSelector';
import { QuriosoLogo } from './QuriosoLogo';
import { sounds } from '../../services/soundEffects';
import { useLanguage } from '../../context/LanguageContext';
import { gameSync, ServerInfo } from '../../services/gameSync';

interface HeaderProps {
  classroomOnly?: boolean;
  onOpenGuide: () => void;
  onJoinClick: () => void;
  onCreateQuiz: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  classroomOnly = false,
  onOpenGuide,
  onJoinClick,
  onCreateQuiz,
}) => {
  const { t } = useLanguage();
  const [isMuted, setIsMuted] = useState(sounds.getMuted());
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);

  useEffect(() => {
    if (classroomOnly) return;
    gameSync.getServerInfo().then((info) => {
      if (info) setServerInfo(info);
    });
  }, [classroomOnly]);

  const handleToggleSound = () => {
    const muted = sounds.toggleMute();
    setIsMuted(muted);
  };

  return (
    <header className="w-full bg-white backdrop-blur-md border-b border-line sticky top-0 z-30 px-4 md:px-8 py-3.5 flex items-center justify-between">
      {/* Brand with iconic Q in petrolio & mandarino */}
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1><QuriosoLogo size="md" /></h1>
            {!classroomOnly && <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-soft border border-line text-[10px] font-bold text-petrolio" title="Indirizzo HTTP e WebSocket della sessione corrente">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="hidden sm:inline">Porta {serverInfo?.port || '…'} Live</span>
              <span className="sm:hidden">:{serverInfo?.port || '…'}</span>
            </div>}
          </div>
          <p className="text-[11px] text-muted hidden sm:block">
            {t.appTagline}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Language Selector */}
        <LanguageSelector />

        {/* PWA Install Button */}
        {!classroomOnly && <PWAInstallButton />}

        {/* Join as Player Quick Button */}
        {!classroomOnly && <button
          onClick={onJoinClick}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-soft hover:bg-surface-hover text-xs font-semibold text-muted border border-line transition active:scale-95 cursor-pointer"
          title={t.joinWithPin}
        >
          <Smartphone className="w-3.5 h-3.5 text-accent-ink" />
          <span className="hidden sm:inline">{t.joinWithPin}</span>
          <span className="sm:hidden">PIN</span>
        </button>}

        {/* Create Quiz Button (Mandarino primary brand action) */}
        <button
          onClick={onCreateQuiz}
          className="hidden md:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl btn-mandarino text-xs font-bold transition active:scale-95 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t.createQuiz}</span>
        </button>

        {/* Sound Toggle */}
        <button
          onClick={handleToggleSound}
          className="p-2 rounded-xl bg-surface-soft hover:bg-surface-hover text-muted hover:text-ink border border-line transition cursor-pointer"
          title={isMuted ? t.unmuteAudio : t.muteAudio}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-rose-700" /> : <Volume2 className="w-4 h-4 text-emerald-700" />}
        </button>

        {/* Build and Multiplatform Guide */}
        <button
          onClick={onOpenGuide}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-soft hover:bg-surface-hover text-xs font-semibold text-muted border border-line transition cursor-pointer"
          title={t.buildAndGitHub}
        >
          <Github className="w-4 h-4" />
          <span className="hidden lg:inline">{t.buildAndGitHub}</span>
        </button>
      </div>
    </header>
  );
};
