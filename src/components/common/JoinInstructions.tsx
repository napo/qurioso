import React, { useState } from 'react';
import { copyText } from '../../utils/clipboard';

export function JoinInstructions({ pin, addresses, address, onAddressChange }: {
  pin: string; addresses: string[]; address: string; onAddressChange: (address: string) => void;
}) {
  const [copyStatus, setCopyStatus] = useState('');
  return <section aria-label="Accesso alla partita" className="join-instructions space-y-3">
    <h2 className="text-2xl font-black text-ink">Partecipa dal tuo computer o dispositivo</h2>
    {addresses.length > 1 && <label className="block text-sm font-bold text-petrolio">
      Indirizzo di rete da mostrare
      <select aria-label="Indirizzo di rete da mostrare" value={address} onChange={event => { onAddressChange(event.target.value); setCopyStatus(''); }} className="mt-1 block max-w-full rounded-lg border border-line bg-white p-2 text-base">
        {addresses.map(url => <option key={url} value={url}>{url}</option>)}
      </select>
    </label>}
    {address ? <>
      <div className="rounded-xl border border-line bg-surface-soft p-3">
        <p className="text-sm font-bold text-muted">Indirizzo da aprire nel browser</p>
        <p data-testid="join-address" className="join-address select-text font-mono text-xl md:text-2xl font-bold text-petrolio break-all">{address}</p>
        <button type="button" className="mt-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-bold text-petrolio" onClick={async () => {
          setCopyStatus(await copyText(address) ? 'Indirizzo copiato.' : 'Copia non disponibile: seleziona e copia l’indirizzo mostrato.');
        }}>Copia indirizzo</button>
        {copyStatus && <p role="status" className="mt-1 text-sm">{copyStatus}</p>}
      </div>
      <p className="text-base text-muted">Apri l’indirizzo, seleziona <strong className="text-ink">Partecipa con PIN</strong>, inserisci il codice.</p>
    </> : <p role="status" className="text-base text-petrolio">Collega il computer del docente alla LAN per mostrare l’indirizzo ai partecipanti.</p>}
    <div className="rounded-xl border-2 border-mandarino bg-surface-soft px-4 py-2">
      <p className="text-sm font-bold text-muted">PIN della partita</p>
      <p data-testid="join-pin" className="font-mono text-5xl md:text-6xl font-black tracking-widest text-ink">{pin}</p>
    </div>
  </section>;
}
