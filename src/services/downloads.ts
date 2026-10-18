export interface DesktopDownload {
  platform: 'Windows' | 'macOS' | 'Linux';
  name: string;
  url: string;
}

// Only link to published installable assets, never source archives or CI artifacts.
export function releaseDownloads(release: unknown): DesktopDownload[] {
  if (!release || typeof release !== 'object') return [];
  const data = release as { draft?: boolean; prerelease?: boolean; assets?: unknown };
  if (data.draft || data.prerelease || !Array.isArray(data.assets)) return [];
  return data.assets.flatMap(asset => {
    if (!asset || typeof asset.name !== 'string' || typeof asset.browser_download_url !== 'string') return [];
    let url: URL;
    try { url = new URL(asset.browser_download_url); } catch { return []; }
    if (url.origin !== 'https://github.com' || !url.pathname.startsWith('/napo/qurioso/releases/download/')) return [];
    const platform = /\.(exe|msi)$/i.test(asset.name) ? 'Windows' : /\.(dmg|pkg)$/i.test(asset.name) ? 'macOS' : /\.(appimage|deb|rpm)$/i.test(asset.name) ? 'Linux' : null;
    return platform ? [{ platform, name: asset.name, url: url.href } as DesktopDownload] : [];
  });
}

export async function loadDesktopDownloads(signal?: AbortSignal): Promise<DesktopDownload[]> {
  const response = await fetch('https://api.github.com/repos/napo/qurioso/releases/latest', {
    signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(10000)]),
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error('Download non disponibili.');
  return releaseDownloads(await response.json());
}
