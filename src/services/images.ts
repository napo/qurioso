import type { ImageAttribution } from '../types/quiz';
import { serviceText } from '../i18n/serviceMessages';

export interface CommonsImage {
  id: number;
  url: string;
  attribution: ImageAttribution;
}

export function imageFileError(file: Pick<File, 'type' | 'size'>): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return serviceText('imageKind');
  if (file.size > 15 * 1024 * 1024) return serviceText('imageTooLarge');
  return null;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(serviceText('imageRead')));
    reader.readAsDataURL(blob);
  });
}

/** Embed a bounded image so JSON export and browser storage keep it available offline. */
export async function importImage(file: File): Promise<string> {
  const error = imageFileError(file);
  if (error) throw new Error(error);
  const original = await blobToDataUrl(file);
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(serviceText('imageUnreadable')));
    image.src = original;
  });
  const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
  if (scale === 1 && file.size <= 400 * 1024) return original;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error(serviceText('imagePrepare'));
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const data = canvas.toDataURL('image/webp', 0.85);
  if (data.length > 3 * 1024 * 1024) throw new Error(serviceText('imageStillLarge'));
  return data;
}

function plainText(html: string): string {
  return new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim() || '';
}

export function safeHttpUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}

export function parseCommonsImages(data: any): CommonsImage[] {
  return Object.values(data.query?.pages || {}).sort((a: any, b: any) => a.index - b.index).flatMap((page: any) => {
    const image = page.imageinfo?.[0];
    if (!image || !['image/jpeg', 'image/png', 'image/webp'].includes(image.mime)) return [];
    const url = safeHttpUrl(image.thumburl || image.url);
    const sourceUrl = safeHttpUrl(image.descriptionurl);
    const metadata = image.extmetadata || {};
    const creator = plainText(metadata.Artist?.value || metadata.Credit?.value || '');
    const license = plainText(metadata.LicenseShortName?.value || metadata.UsageTerms?.value || '');
    if (!url || !sourceUrl || !creator || !license) return [];
    return [{ id: page.pageid, url, attribution: {
      title: String(page.title).replace(/^File:/, ''), creator, license, sourceUrl,
      licenseUrl: safeHttpUrl(metadata.LicenseUrl?.value || ''),
      attributionText: plainText(metadata.Attribution?.value || '') || undefined,
      credit: plainText(metadata.Credit?.value || '') || undefined,
    } }];
  });
}

export async function searchCommons(query: string, signal: AbortSignal): Promise<CommonsImage[]> {
  const params = new URLSearchParams({
    action: 'query', format: 'json', origin: '*', generator: 'search',
    gsrsearch: `${query.trim()} filetype:bitmap`, gsrnamespace: '6', gsrlimit: '12',
    prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: '1024',
    iiextmetadatafilter: 'Artist|Credit|Attribution|LicenseShortName|LicenseUrl|UsageTerms',
  });
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { signal });
  if (!response.ok) throw new Error(serviceText('searchOffline'));
  const data = await response.json();
  if (data.error) throw new Error(serviceText('searchFailed'));
  return parseCommonsImages(data);
}

export async function importCommonsImage(image: CommonsImage, signal: AbortSignal): Promise<string> {
  const response = await fetch(image.url, { signal });
  if (!response.ok) throw new Error(serviceText('imageDownload'));
  const blob = await response.blob();
  const error = imageFileError(blob);
  if (error) throw new Error(error);
  return blobToDataUrl(blob);
}
