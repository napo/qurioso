import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, ExternalLink, Wifi, Globe, Smartphone } from 'lucide-react';
import { getJoinBaseUrl, isLoopbackOrigin } from '../../utils/connectionUrl';
import { gameSync, ServerInfo } from '../../services/gameSync';

interface QRCodeDisplayProps {
  pin: string;
  className?: string;
  size?: number;
  showDetails?: boolean;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  pin,
  className = '',
  size = 210,
  showDetails = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [selectedHostType, setSelectedHostType] = useState<'origin' | 'lan'>(() => isLoopbackOrigin(window.location.origin) ? 'lan' : 'origin');

  useEffect(() => {
    gameSync.getServerInfo().then((info) => {
      if (info) {
        setServerInfo(info);
      }
    });
  }, []);

  // A phone cannot reach the presenter's localhost; prefer the LAN URL locally.
  const desktop = Boolean(window.quriosoDesktop);
  const baseUrl = getJoinBaseUrl(window.location.origin, serverInfo, desktop ? 'lan' : selectedHostType);

  const joinUrl = `${baseUrl}/?pin=${pin}&role=player`;

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        joinUrl,
        {
          width: size,
          margin: 1.5,
          color: {
            dark: '#075E63',
            light: '#ffffff',
          },
          errorCorrectionLevel: 'M',
        },
        (error) => {
          if (error) console.error('QR Code error:', error);
        }
      );
    }
  }, [joinUrl, size]);

  const copyToClipboard = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(joinUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const openPlayerTab = () => {
    if (typeof window !== 'undefined') {
      window.open(joinUrl, '_blank', 'width=420,height=780');
    }
  };

  return (
    <div className={`flex flex-col items-center bg-white p-4 rounded-2xl shadow-lg border-2 border-line text-muted ${className}`}>
      {/* Network target selector if LAN IP is detected */}
      {serverInfo?.localIps && serverInfo.localIps.length > 0 && (
        <div className="flex items-center gap-1.5 p-1 bg-surface-soft rounded-xl mb-3 text-xs w-full max-w-[240px]">
          {!desktop && <button
            onClick={() => setSelectedHostType('origin')}
            className={`flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-lg font-bold transition cursor-pointer ${
              selectedHostType === 'origin'
                ? 'bg-petrolio text-white shadow-sm'
                : 'text-muted hover:text-muted'
            }`}
            title="Usa URL del browser / Cloud"
          >
            <Globe className="w-3 h-3" />
            <span>Web / Cloud</span>
          </button>}
          <button
            onClick={() => setSelectedHostType('lan')}
            className={`flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-lg font-bold transition cursor-pointer ${
              selectedHostType === 'lan'
                ? 'bg-mandarino text-ink shadow-sm'
                : 'text-muted hover:text-muted'
            }`}
            title="Usa indirizzo IP locale per Wi-Fi (stessa rete dei telefoni)"
          >
            <Wifi className="w-3 h-3" />
            <span>Wi-Fi Locale</span>
          </button>
        </div>
      )}

      {desktop && serverInfo && !serverInfo.localIps.length && <p role="status" className="text-sm text-petrolio">Collega il computer a una rete LAN o Wi-Fi per far partecipare gli studenti.</p>}
      {/* QR Canvas */}
      <div className="relative p-1 bg-white rounded-xl shadow-inner border border-line">
        <canvas ref={canvasRef} hidden={(desktop && !serverInfo?.localIps.length) || selectedHostType === 'lan' && !serverInfo} className="rounded-lg max-w-full h-auto block" />
      </div>

      {showDetails && (!desktop || Boolean(serverInfo?.localIps.length)) && (
        <div className="mt-3 w-full flex flex-col items-center text-center">
          <div className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-petrolio font-black">
            <Smartphone className="w-3.5 h-3.5 text-accent-ink" />
            <span>Inquadra con lo smartphone</span>
          </div>

          <div className="text-[12px] text-muted font-semibold mt-1 truncate max-w-[240px] px-2 py-0.5 bg-surface-soft rounded-md">
            {baseUrl.replace(/^https?:\/\//, '')}
          </div>

          <div className="flex items-center gap-1.5 mt-2.5 w-full">
            <button
              onClick={copyToClipboard}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-surface-soft hover:bg-surface-hover text-muted text-xs font-bold rounded-lg transition active:scale-95 cursor-pointer border border-line"
              title="Copia link diretto con PIN"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-muted" />}
              <span>{copied ? 'Copiato!' : 'Copia Link'}</span>
            </button>
            <button
              onClick={openPlayerTab}
              className="flex items-center justify-center p-1.5 bg-mandarino/10 hover:bg-mandarino/20 text-accent-ink border border-mandarino/30 rounded-lg transition active:scale-95 cursor-pointer"
              title="Apri vista giocatore in scheda di test"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
