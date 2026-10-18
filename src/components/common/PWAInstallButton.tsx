import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-2 rounded-xl bg-petrolio px-3 py-1.5 text-xs font-semibold text-white shadow-md hover:bg-petrolio/90 transition active:scale-95 cursor-pointer"
        title="Installa come App su Desktop o Android"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Installa App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-2 rounded-xl border border-petrolio/40 bg-petrolio/10 px-3 py-1.5 text-xs font-semibold text-petrolio hover:bg-petrolio/20 transition active:scale-95 cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Installa su iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white border border-line p-6 shadow-lg">
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <h3 className="text-base font-bold text-ink flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-petrolio" />
                  Installa su iPhone / iPad
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg hover:bg-surface-hover text-muted hover:text-ink"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="mt-3 text-sm text-muted leading-relaxed">
                Per installare <strong>Qurioso</strong> a schermo intero come una vera app nativa:
              </p>
              <div className="mt-4 space-y-2.5 text-xs text-muted bg-surface-soft p-3.5 rounded-xl border border-line">
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-petrolio text-white flex items-center justify-center font-bold text-[10px]">1</span>
                  <span>Tocca l'icona <strong>Condividi</strong> (il quadrato con la freccia verso l'alto) nella barra di Safari in basso.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-petrolio text-white flex items-center justify-center font-bold text-[10px]">2</span>
                  <span>Scorri verso il basso e seleziona <strong>"Aggiungi alla schermata Home"</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-petrolio text-white flex items-center justify-center font-bold text-[10px]">3</span>
                  <span>Tocca <strong>Aggiungi</strong> in alto a destra!</span>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-petrolio py-2.5 text-xs font-semibold text-white hover:bg-petrolio transition"
              >
                Ho capito
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
