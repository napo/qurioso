import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/usePWAInstall';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-mandarino/90 backdrop-blur-md px-3.5 py-2 text-xs font-medium text-ink shadow-md border border-mandarino/30">
      <WifiOff className="w-4 h-4 animate-pulse text-accent-ink" />
      <span>Modalità Offline attiva — I dati locali salvati restano disponibili.</span>
    </div>
  );
};
