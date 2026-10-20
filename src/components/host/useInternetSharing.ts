import { useCallback, useEffect, useState } from 'react';
import type { InternetSharingState } from '../../types/desktop';

export function useInternetSharing(pin: string) {
  const api = window.quriosoDesktop?.internetSharing;
  const [state, setState] = useState<InternetSharingState>({ phase: 'idle' });
  useEffect(() => {
    if (!api) return;
    let alive = true, changes = 0;
    const unsubscribe = api.onChange(next => { changes++; if (alive) setState(next); });
    void api.status().then(next => { if (alive && !changes) setState(next); }).catch(() => { if (alive) setState({ phase: 'error', error: 'local' }); });
    return () => { alive = false; unsubscribe(); void api.stop().catch(() => {}); };
  }, [api, pin]);
  const start = useCallback(async () => {
    if (!api) return;
    setState({ phase: 'connecting', pin });
    try { setState(await api.start(pin)); }
    catch { setState({ phase: 'error', error: 'local' }); }
  }, [api, pin]);
  const stop = useCallback(async () => {
    try { if (api) setState(await api.stop()); }
    catch { setState({ phase: 'error', error: 'local' }); }
  }, [api]);
  return { available: Boolean(api), state, start, stop };
}
