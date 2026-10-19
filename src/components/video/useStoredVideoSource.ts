import { useEffect } from 'react';
import { loadVideo } from '../../services/quizStorage';

/** Object URLs remain on the presenter's device and are released when the source changes. */
export function useStoredVideoSource(assetId: string | undefined, onUrl: (url: string) => void,
  onError: (message: string) => void, onBusy: (busy: boolean) => void) {
  useEffect(() => {
    if (!assetId) return;
    let cancelled = false;
    let objectUrl: string | undefined;
    onBusy(true);
    loadVideo(assetId).then(file => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(file);
      onUrl(objectUrl);
    }).catch(error => { if (!cancelled) onError(error.message); })
      .finally(() => { if (!cancelled) onBusy(false); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [assetId, onUrl, onError, onBusy]);
}
