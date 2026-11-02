import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { CloudServiceIcon } from './CloudServiceIcon';
import { cloudSyncText, type CloudSyncMessage } from '../../i18n/cloudSync';
import { cloudSync } from '../../services/cloudSync/controller';
import { availableProviders, type CloudProvider } from '../../services/cloudSync/providers';

/** Hidden until at least one service is configured for this copy of the app. */
export function CloudSyncCard() {
  const { language } = useLanguage(), t = (key: CloudSyncMessage, values?: Record<string, string | number>) => cloudSyncText(language, key, values);
  const [providers, setProviders] = useState<CloudProvider[]>([]);
  const [status, setStatus] = useState(cloudSync.status), [busy, setBusy] = useState(false), [removeFile, setRemoveFile] = useState(false);
  useEffect(() => {
    let mounted = true;
    availableProviders().then(found => { if (mounted) setProviders(found); }).catch(() => {});
    const stop = cloudSync.subscribe(setStatus);
    setStatus(cloudSync.status);
    return () => { mounted = false; stop(); };
  }, []);
  if (!providers.length && !status.provider) return null;
  const connected = providers.find(item => item.id === status.provider);
  const act = async (action: () => Promise<unknown>) => { setBusy(true); try { await action(); } finally { setBusy(false); } };
  const needsSignIn = status.state === 'paused';
  return <section data-cloud-sync className="rounded-2xl border border-line bg-white p-5 space-y-3" aria-label={t('title')}>
    <h2 className="text-xl font-black text-petrolio">{t('title')}</h2>
    {!status.provider && <>
      <p>{t('intro')}</p><p className="text-sm text-muted">{t('what')}</p>
      <div className="flex flex-wrap gap-2">{providers.map(provider => <button key={provider.id} type="button" disabled={busy} onPointerEnter={provider.prepare} onFocus={provider.prepare} onClick={() => act(() => cloudSync.connect(provider))} className="btn-secondary rounded-xl px-3 py-2 inline-flex items-center gap-2"><CloudServiceIcon id={provider.id} />{t('connect', { service: provider.label })}</button>)}</div>
      {busy && <p role="status">{t('connecting')}</p>}
    </>}
    {status.provider && <>
      <p className="font-bold flex items-center gap-2"><CloudServiceIcon id={status.provider} />{t('connected', { service: connected?.label ?? status.provider })}</p>
      <p role="status" className="text-sm text-muted">{status.state === 'syncing' ? t('syncing') : status.lastSyncedAt ? t('last', { time: new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }).format(status.lastSyncedAt) }) : t('never')}</p>
      {status.conflicts > 0 && <p className="text-sm">{t('conflicts', { count: status.conflicts })}</p>}
      {status.skipped > 0 && <p className="text-sm">{t('skipped', { count: status.skipped })}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy || status.state === 'syncing'} onPointerEnter={connected?.prepare} onFocus={connected?.prepare} onClick={() => act(() => cloudSync.syncNow(true))} className="btn-secondary rounded-xl px-3 py-2">{needsSignIn ? t('signInAgain') : t('syncNow')}</button>
        <button type="button" disabled={busy} onClick={() => act(() => cloudSync.disconnect(removeFile))} className="btn-danger rounded-xl px-3 py-2">{t('disconnect')}</button>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={removeFile} onChange={event => setRemoveFile(event.target.checked)} />{t('removeFile')}</label>
      <p className="text-sm text-muted">{t('disconnectHint')}</p>
    </>}
    {status.problem && <p role="alert" className="text-sm font-bold text-red-700">{t(status.problem)}</p>}
  </section>;
}
