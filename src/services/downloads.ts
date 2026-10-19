export interface DesktopDownload {
  platform: 'Windows' | 'macOS' | 'Linux';
  name: string;
  url: string;
  size?: number;
  prerelease?: boolean;
}

export function formatDownloadSize(bytes: number, locale: string): string {
  const units = ['B', 'kB', 'MB', 'GB', 'TB'];
  const unit = bytes === 0 ? 0 : Math.min(Math.floor(Math.log10(bytes) / 3), units.length - 1);
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / 1000 ** unit)} ${units[unit]}`;
}

// Only link to published installable assets, never source archives or CI artifacts.
export function releaseDownloads(release: unknown, allowPrerelease = false): DesktopDownload[] {
  if (!release || typeof release !== 'object') return [];
  const data = release as { draft?: boolean; prerelease?: boolean; assets?: unknown };
  if (data.draft || (data.prerelease && !allowPrerelease) || !Array.isArray(data.assets)) return [];
  return data.assets.flatMap(asset => {
    if (!asset || typeof asset.name !== 'string' || typeof asset.browser_download_url !== 'string') return [];
    let url: URL;
    try { url = new URL(asset.browser_download_url); } catch { return []; }
    if (url.origin !== 'https://github.com' || !url.pathname.startsWith('/napo/qurioso/releases/download/')) return [];
    const platform = /\.(exe|msi)$/i.test(asset.name) ? 'Windows' : /\.(dmg|pkg)$/i.test(asset.name) ? 'macOS' : /\.(appimage|deb|rpm)$/i.test(asset.name) ? 'Linux' : null;
    const size = Number.isSafeInteger(asset.size) && asset.size >= 0 ? { size: asset.size } : {};
    return platform ? [{ platform, name: asset.name, url: url.href, ...size, ...(data.prerelease ? { prerelease: true } : {}) } as DesktopDownload] : [];
  });
}

export async function loadDesktopDownloads(signal?: AbortSignal): Promise<DesktopDownload[]> {
  const options = {
    signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(10000)]),
    headers: { Accept: 'application/vnd.github+json' },
  };
  const response = await fetch('https://api.github.com/repos/napo/qurioso/releases/latest', options);
  if (response.ok) {
    const stable = releaseDownloads(await response.json());
    if (stable.length) return stable;
  } else if (response.status !== 404) throw new Error('Download non disponibili.');
  const listing = await fetch('https://api.github.com/repos/napo/qurioso/releases?per_page=10', options);
  if (listing.status === 404) return [];
  if (!listing.ok) throw new Error('Download non disponibili.');
  const releases: unknown = await listing.json();
  if (!Array.isArray(releases)) return [];
  const stable = releases.map(release => releaseDownloads(release)).find(items => items.length);
  return stable || releases.map(release => releaseDownloads(release, true)).find(items => items.length) || [];
}
