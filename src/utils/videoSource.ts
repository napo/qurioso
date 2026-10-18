export const DEMO_VIDEO_URL = 'https://media.w3.org/2010/05/bunny/trailer.mp4';

const legacyDemoUrls = new Set([
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
]);

// Saved starter quizzes may still reference the inaccessible demo URLs.
export function resolveVideoSource(url?: string): string {
  return !url || legacyDemoUrls.has(url) ? DEMO_VIDEO_URL : url;
}

export type VideoProvider = 'youtube' | 'vimeo' | 'html5';

export function parseVideoUrl(value: string): { provider: VideoProvider; url: string; id?: string } {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Usa un link HTTP/HTTPS oppure scegli un file dal computer.');
  const host = url.hostname.toLowerCase();
  if (['youtube.com', 'youtu.be', 'youtube-nocookie.com'].some(domain => host === domain || host.endsWith('.' + domain))) {
    const segments = url.pathname.split('/').filter(Boolean);
    const id = host === 'youtu.be' ? segments[0] : url.searchParams.get('v') ||
      (['embed', 'shorts', 'live'].includes(segments[0]) ? segments[1] : '');
    if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) throw new Error('Incolla il link di un singolo video YouTube.');
    return { provider: 'youtube', id, url: `https://www.youtube.com/watch?v=${id}` };
  }
  if (host === 'vimeo.com' || host.endsWith('.vimeo.com')) {
    const segments = url.pathname.split('/').filter(Boolean);
    const idIndex = segments.findIndex(part => /^\d+$/.test(part));
    const id = segments[idIndex];
    if (!id) throw new Error('Incolla il link di un singolo video Vimeo.');
    const hash = url.searchParams.get('h') || segments[idIndex + 1];
    if (hash && !/^[a-zA-Z0-9]+$/.test(hash)) throw new Error('Il link Vimeo non è valido.');
    return { provider: 'vimeo', id, url: `https://vimeo.com/${id}${hash ? `?h=${hash}` : ''}` };
  }
  return { provider: 'html5', url: url.href };
}

export function videoProvider(value: string): VideoProvider {
  try { return parseVideoUrl(value).provider; } catch { return 'html5'; }
}

export function videoUrlError(value: string): string | null {
  try { parseVideoUrl(value); return null; }
  catch (error) { return error instanceof Error ? error.message : 'Inserisci un link YouTube, Vimeo o diretto MP4/WebM.'; }
}

export function videoFileError(file: Pick<File, 'name' | 'type' | 'size'>): string | null {
  if (file.size === 0) return 'Il file è vuoto.';
  if (!['video/mp4', 'video/webm'].includes(file.type) && !/\.(mp4|webm)$/i.test(file.name)) return 'Scegli un file video MP4 o WebM.';
  return null;
}
