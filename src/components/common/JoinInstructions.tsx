import React, { useState } from 'react';
import { copyText } from '../../utils/clipboard';
import { useLanguage } from '../../context/LanguageContext';
import { lobbyTranslations } from '../../i18n/lobby';

export function JoinInstructions({ pin, addresses, address, onAddressChange }: {
  pin: string; addresses: string[]; address: string; onAddressChange: (address: string) => void;
}) {
  const { t, language } = useLanguage(), lobby = lobbyTranslations[language];
  const [copyStatus, setCopyStatus] = useState('');
  return <section aria-label={lobby.joinAccess} className="join-instructions space-y-3">
    <h2 className="text-2xl font-black text-ink">{lobby.joinTitle}</h2>
    {addresses.length > 1 && <label className="block text-sm font-bold text-petrolio">
      {lobby.addressSelect}
      <select aria-label={lobby.addressSelect} value={address} onChange={event => { onAddressChange(event.target.value); setCopyStatus(''); }} className="mt-1 block max-w-full rounded-lg border border-line bg-white p-2 text-base">
        {addresses.map(url => <option key={url} value={url}>{url}</option>)}
      </select>
    </label>}
    {address ? <>
      <div className="rounded-xl border border-line bg-surface-soft p-3">
        <p className="text-sm font-bold text-muted">{lobby.addressOpen}</p>
        <p data-testid="join-address" className="join-address select-text font-mono text-xl md:text-2xl font-bold text-petrolio break-all">{address}</p>
        <button type="button" className="mt-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-bold text-petrolio" onClick={async () => {
          setCopyStatus(await copyText(address) ? lobby.addressCopied : lobby.copyUnavailable);
        }}>{lobby.copyAddress}</button>
        {copyStatus && <p role="status" className="mt-1 text-sm">{copyStatus}</p>}
      </div>
      <p className="text-base text-muted">{lobby.joinStepBefore}<strong className="text-ink">{t.joinWithPin}</strong>{lobby.joinStepAfter}</p>
    </> : <p role="status" className="text-base text-petrolio">{lobby.connectLan}</p>}
    <div className="rounded-xl border-2 border-mandarino bg-surface-soft px-4 py-2">
      <p className="text-sm font-bold text-muted">{lobby.gamePin}</p>
      <p data-testid="join-pin" className="font-mono text-5xl md:text-6xl font-black tracking-widest text-ink">{pin}</p>
    </div>
  </section>;
}
