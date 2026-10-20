import { BlobReader, BlobWriter, TextReader, ZipReader, ZipWriter, type FileEntry } from '@zip.js/zip.js';
import type { Quiz, ImageAttribution } from '../types/quiz';
import { commitLibraryRestore, inspectVideoAssets, readLibrarySnapshot, loadVideo } from './quizStorage';
import { blobToDataUrl } from './images';
import packageInfo from '../../package.json';

// Concrete resource ceilings, also enforced on untrusted archive metadata before extraction.
export const BACKUP_LIMITS = { buffered: 512 * 1024 ** 2, total: 8 * 1024 ** 3, json: 32 * 1024 ** 2, images: 64 * 1024 ** 2, entries: 10000 };
export type BackupAsset = { id: string; kind: 'image' | 'video'; name?: string; size: number; sizeKnown?: boolean; mime: string; included: boolean; path?: string };
export interface BackupManifest {
  format: 'qurioso-library'; version: 1; appVersion: string; createdAt: string;
  settings: { language?: 'it' | 'en' | 'de' }; quizzes: Quiz[]; assets: BackupAsset[];
}
export interface BackupPlan {
  manifest: BackupManifest; sources: Map<string, () => Promise<Blob>>;
  quizBytes: number; imageBytes: number; videoBytes: number; orphanCount: number; orphanBytes: number; warnings: string[];
}
export interface BackupPreview { manifest: BackupManifest; file: Blob; entries: Map<string, FileEntry>; expected: Quiz[] | null; current: Quiz[]; conflicts: string[]; total: number }
export type RestoreMode = 'add' | 'replace' | 'all';
export type Progress = (phase: 'export' | 'verify' | 'restore', done: number, total: number) => void;
function fail(key = 'backupInvalid'): never { throw new Error(key); }
const uid = () => crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
const utf8 = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
const object = (v: any) => v && typeof v === 'object' && !Array.isArray(v) ? v : fail();
const text = (v: any): string => typeof v === 'string' ? v : fail();
const finite = (v: any): number => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fail();
const bool = (v: any): boolean => typeof v === 'boolean' ? v : fail();
function choice<T extends string>(v: any, options: readonly T[]): T { return options.includes(v) ? v : fail(); }
const array = (v: any): any[] => Array.isArray(v) && v.length <= BACKUP_LIMITS.entries ? v : fail();
const optional = (v: any) => v === undefined ? undefined : text(v);
const unique = (values: string[]) => { if (new Set(values).size !== values.length || values.some(v => !v)) fail(); };
function credit(v: any): ImageAttribution | undefined {
  if (v === undefined) return;
  object(v); return { title: text(v.title), creator: text(v.creator), license: text(v.license), sourceUrl: safeUrl(text(v.sourceUrl)), licenseUrl: v.licenseUrl === undefined ? undefined : safeUrl(text(v.licenseUrl)), attributionText: optional(v.attributionText), credit: optional(v.credit) };
}
function safeUrl(url: string): string {
  if (!url || /^https?:\/\//i.test(url) || /^data:(image|video)\//i.test(url) || /^qurioso-asset:[a-zA-Z0-9_-]+$/.test(url)) return url;
  fail('backupFragile');
}
/** Whitelist at every level: runtime keys/credentials in permissive legacy imports cannot enter backups. */
export function portableQuiz(value: unknown): Quiz {
  const q = object(value), s = object(q.settings);
  const quiz: Quiz = {
    id: text(q.id), title: text(q.title), description: text(q.description ?? ''), category: text(q.category ?? ''), author: text(q.author ?? ''), createdAt: finite(q.createdAt ?? 0),
    coverImage: q.coverImage === undefined ? undefined : safeUrl(text(q.coverImage)), coverAttribution: credit(q.coverAttribution),
    settings: { pointsMultiplier: finite(s.pointsMultiplier), showExplanation: bool(s.showExplanation), streakBonus: bool(s.streakBonus) },
    questions: array(q.questions).map(v => { object(v); const question = {
      id: text(v.id), text: text(v.text), type: choice(v.type, ['multiple_choice','true_false'] as const), timeLimit: finite(v.timeLimit), points: finite(v.points),
      explanation: optional(v.explanation), mediaUrl: v.mediaUrl === undefined ? undefined : safeUrl(text(v.mediaUrl)), mediaAttribution: credit(v.mediaAttribution),
      mediaType: v.mediaType === undefined ? undefined : choice(v.mediaType, ['image','video'] as const), videoTimestamp: v.videoTimestamp === undefined ? undefined : finite(v.videoTimestamp),
      options: array(v.options).map(o => { object(o); return { id: text(o.id), text: text(o.text), isCorrect: bool(o.isCorrect),
        color: choice(o.color, ['red','blue','yellow','green','purple','orange'] as const), shape: choice(o.shape, ['triangle','diamond','circle','square','star','hexagon'] as const) }; }),
    }; unique(question.options.map(o => o.id)); return question; }),
  };
  unique(quiz.questions.map(v => v.id));
  if (q.videoConfig !== undefined) {
    const v = object(q.videoConfig);
    quiz.videoConfig = {
      videoUrl: safeUrl(text(v.videoUrl)), videoTitle: text(v.videoTitle ?? ''), videoType: choice(v.videoType, ['html5','sample','youtube','vimeo','file'] as const),
      videoAssetId: optional(v.videoAssetId), videoFileName: optional(v.videoFileName), pauseMode: choice(v.pauseMode, ['defined','random'] as const),
      checkpointMode: v.checkpointMode === undefined ? undefined : choice(v.checkpointMode, ['explicit'] as const),
      checkpoints: array(v.checkpoints).map(c => { object(c); if (!quiz.questions.some(question => question.id === c.questionId)) fail(); return { questionId: text(c.questionId), timestamp: finite(c.timestamp) }; }),
      randomConfig: v.randomConfig === undefined ? undefined : { frequencySeconds: finite(object(v.randomConfig).frequencySeconds), totalCheckpoints: finite(v.randomConfig.totalCheckpoints) },
      missingVideo: v.missingVideo === undefined ? undefined : { name: optional(object(v.missingVideo).name), size: finite(v.missingVideo.size), sizeKnown: v.missingVideo.sizeKnown === undefined ? undefined : bool(v.missingVideo.sizeKnown), mime: text(v.missingVideo.mime) },
    };
    unique(quiz.videoConfig.checkpoints.map(c => c.questionId));
  }
  return quiz;
}
function mediaFields(quiz: Quiz): { get: () => string | undefined; set: (v: string) => void; kind: 'image' | 'video' }[] {
  return [{ get: () => quiz.coverImage, set: v => { quiz.coverImage = v; }, kind: 'image' }, ...quiz.questions.map(q => ({ get: () => q.mediaUrl, set: (v: string) => { q.mediaUrl = v; }, kind: q.mediaType === 'video' ? 'video' as const : 'image' as const }))];
}
export function backupImageCount(manifest: BackupManifest): number {
  const urls=new Set<string>();
  for(const q of manifest.quizzes) for(const f of mediaFields(q)) if(f.kind==='image' && f.get()) urls.add(f.get()!);
  return urls.size;
}
function manifestFor(plan: BackupPlan, includeVideos: boolean): BackupManifest {
  return { ...plan.manifest, assets: plan.manifest.assets.map(a => ({ ...a, included: a.included && (a.kind !== 'video' || includeVideos), path: a.included && (a.kind !== 'video' || includeVideos) ? `media/${a.id}` : undefined })) };
}
export function backupEstimate(plan: BackupPlan, includeVideos: boolean) {
  const manifest = manifestFor(plan, includeVideos), metadata = utf8(manifest);
  const included = manifest.assets.filter(a => a.included);
  return { metadata, images: plan.imageBytes, videos: included.filter(a => a.kind === 'video').reduce((n,a) => n+a.size,0), total: metadata + included.reduce((n,a) => n+a.size,0), excluded: manifest.assets.filter(a => a.kind === 'video' && !a.included).length };
}
/** Reads only saved content passed by the dashboard, never arbitrary storage keys. */
export async function planBackup(quizzes: Quiz[], language?: 'it'|'en'|'de'): Promise<BackupPlan> {
  const manifest: BackupManifest = { format:'qurioso-library', version:1, appVersion:packageInfo.version, createdAt:new Date().toISOString(), settings:{ language }, quizzes: quizzes.map(portableQuiz), assets:[] };
  unique(manifest.quizzes.map(q => q.id));
  const sources = new Map<string, () => Promise<Blob>>(), embedded = new Map<string, string>(), videos = new Map<string, string>();
  const plan: BackupPlan = { manifest, sources, quizBytes:0, imageBytes:0, videoBytes:0, orphanCount:0, orphanBytes:0, warnings:[] };
  const addEmbedded = async (url: string, kind: 'image'|'video') => {
    if (embedded.has(url)) return embedded.get(url)!;
    // Legacy data URLs already occupy RAM; do not multiply huge legacy strings/decodes.
    if (url.length > BACKUP_LIMITS.images * 1.4) fail('backupLegacyLarge');
    const blob = await (await fetch(url)).blob(), id = uid();
    manifest.assets.push({ id, kind, size:blob.size, mime:blob.type, included:true });
    sources.set(id, async () => blob); embedded.set(url,id); return id;
  };
  for (const quiz of manifest.quizzes) {
    for (const field of mediaFields(quiz)) {
      const url = field.get(); if (url?.startsWith('qurioso-asset:')) fail('backupFragile');
      if (url && /^data:video\//i.test(url)) fail('backupUnsupportedMedia');
      if (url && /^data:/i.test(url) && field.kind === 'video') fail('backupUnsupportedMedia');
      if (url && /^data:/i.test(url)) field.set(`qurioso-asset:${await addEmbedded(url,field.kind)}`);
      else if (url) plan.warnings.push('backupExternal');
    }
    const v = quiz.videoConfig;
    if (!v) continue;
    if (v.videoAssetId) {
      const originalId = v.videoAssetId;
      let id = videos.get(originalId);
      if (!id) {
        id = uid(); videos.set(originalId,id);
        let blob: Blob | undefined;
        try { blob = await loadVideo(originalId); } catch(error) {
          if(!(error instanceof Error) || !error.message.startsWith('Video locale non trovato.')) throw error;
          // A genuinely missing reference remains explicit and relinkable.
        }
        manifest.assets.push({ id, kind:'video', name:v.videoFileName || v.missingVideo?.name || (blob && 'name' in blob ? String(blob.name) : undefined), size:blob?.size ?? v.missingVideo?.size ?? 0, sizeKnown:blob ? true : v.missingVideo ? v.missingVideo.sizeKnown !== false : false, mime:blob?.type || v.missingVideo?.mime || '', included:!!blob });
        if (blob) sources.set(id, () => loadVideo(originalId));
      }
      v.videoAssetId = id; v.videoUrl = '';
    } else if (/^data:/i.test(v.videoUrl)) {
      v.videoAssetId = await addEmbedded(v.videoUrl,'video'); v.videoUrl = ''; v.videoType = 'file';
    } else if (v.videoUrl.startsWith('qurioso-asset:')) fail('backupFragile');
    else if (v.videoUrl) plan.warnings.push('backupExternal');
  }
  // Detect library orphans, retaining all files (including drafts and presenter copies).
  const inventory = typeof indexedDB === 'undefined' ? [] : await inspectVideoAssets();
  const orphans = inventory.filter(a => !videos.has(a.id));
  plan.orphanCount = orphans.length; plan.orphanBytes = orphans.reduce((n,a)=>n+a.size,0);
  plan.quizBytes = utf8(manifest);
  plan.imageBytes = manifest.assets.filter(a=>a.kind==='image').reduce((n,a)=>n+a.size,0);
  plan.videoBytes = manifest.assets.filter(a=>a.kind==='video' && a.included).reduce((n,a)=>n+a.size,0);
  if (plan.imageBytes > BACKUP_LIMITS.images || plan.quizBytes > BACKUP_LIMITS.json) fail('backupLimit');
  return plan;
}
/** Stored (level 0) ZIP: video codecs are already compressed. Entries are processed sequentially. */
export async function exportLibraryBackup(plan: BackupPlan, includeVideos: boolean, sink?: WritableStream<Uint8Array>, progress?: Progress, signal?: AbortSignal): Promise<Blob | undefined> {
  const estimate = backupEstimate(plan, includeVideos);
  if (estimate.total > (sink ? BACKUP_LIMITS.total : BACKUP_LIMITS.buffered)) fail('backupLimit');
  const manifest = manifestFor(plan,includeVideos);
  if(manifest.assets.length>BACKUP_LIMITS.entries || manifest.assets.filter(a=>a.included).length+1>BACKUP_LIMITS.entries || estimate.metadata>BACKUP_LIMITS.json) fail('backupLimit');
  const zip = new ZipWriter(sink || new BlobWriter('application/zip'), { level:0, useWebWorkers:false });
  let done = 0;
  try {
    await zip.add('manifest.json',new TextReader(JSON.stringify(manifest)),{ signal }); done = estimate.metadata;
    for (const asset of manifest.assets.filter(a=>a.included)) {
      signal?.throwIfAborted();
      const source = plan.sources.get(asset.id); if (!source) fail('backupMissing');
      const blob = await source(); if (blob.size !== asset.size || blob.type !== asset.mime) fail('backupChanged');
      await zip.add(asset.path!,new BlobReader(blob),{ signal, onprogress:n=>progress?.('export',done+n,estimate.total) });
      done += asset.size; progress?.('export',done,estimate.total);
    }
    const result = await zip.close(); progress?.('export',estimate.total,estimate.total);
    return result instanceof Blob ? result : undefined;
  } catch (error) { if (sink) { try { await sink.abort(error); } catch {} } throw error; }
}
function safePath(path: string) { if (!/^(manifest\.json|media\/[a-zA-Z0-9_-]+)$/.test(path)) fail('backupPath'); }
function validateManifest(value: unknown): BackupManifest {
  const m = object(value);
  if (m.format !== 'qurioso-library' || m.version !== 1) fail('backupVersion');
  if (!Number.isFinite(Date.parse(text(m.createdAt)))) fail();
  const quizzes = array(m.quizzes).map(portableQuiz); unique(quizzes.map(q=>q.id));
  const assets: BackupAsset[] = array(m.assets).map(v=> {
    object(v); const a: BackupAsset = { id:text(v.id),kind:choice(v.kind,['image','video'] as const),name:optional(v.name),size:finite(v.size),sizeKnown:v.sizeKnown===undefined?undefined:bool(v.sizeKnown),mime:text(v.mime),included:bool(v.included),path:optional(v.path) };
    if (!/^[a-zA-Z0-9_-]+$/.test(a.id) || !Number.isSafeInteger(a.size)) fail();
    if (a.included ? a.path !== `media/${a.id}` : a.path !== undefined) fail('backupPath');
    if(a.included && a.sizeKnown===false) fail();
    if (a.kind==='image' && !a.included) fail('backupMissing');
    return a;
  }); unique(assets.map(a=>a.id));
  const used = new Set<string>();
  const reference = (id: string, kind?: string) => { const a=assets.find(a=>a.id===id); if(!a || kind && a.kind!==kind) fail('backupMissing'); used.add(id); };
  for (const q of quizzes) {
    for (const f of mediaFields(q)) {
      const url=f.get(); if(url?.startsWith('qurioso-asset:')) { if(f.kind==='video') fail('backupUnsupportedMedia'); reference(url.slice(14),f.kind); }
      if(url && /^data:/i.test(url)) fail(); // Binary assets only in backup v1.
    }
    if(q.videoConfig?.videoAssetId) { reference(q.videoConfig.videoAssetId,'video'); if(q.videoConfig.videoUrl) fail(); }
    if(q.videoConfig && /^data:/i.test(q.videoConfig.videoUrl) || q.videoConfig?.videoUrl.startsWith('qurioso-asset:')) fail();
  }
  if(assets.some(a=>!used.has(a.id))) fail();
  const settings = object(m.settings);
  return {format:'qurioso-library',version:1,appVersion:text(m.appVersion),createdAt:m.createdAt,quizzes,assets,
    settings:{language:settings.language===undefined?undefined:choice(settings.language,['it','en','de'] as const)} };
}
async function readAsset(entry: FileEntry, mime: string, limit: number, signal?: AbortSignal, onprogress?: (n:number)=>void): Promise<Blob> {
  const output = new BlobWriter(mime); await output.init();
  const writer = output.writable.getWriter(); let written = 0;
  const bounded = new WritableStream<Uint8Array>({
    async write(chunk) { written += chunk.byteLength; if(written>limit) fail('backupLimit'); await writer.write(chunk); },
    close: () => writer.close(), abort: error => writer.abort(error),
  });
  try { await entry.getData(bounded,{checkSignature:true,signal,onprogress}); return await output.getData(); }
  finally { writer.releaseLock(); }
}
async function openArchive(file: Blob) {
  // Allow ZIP headers in addition to the 8 GiB uncompressed-content ceiling.
  if(file.size > BACKUP_LIMITS.total + 16 * 1024 ** 2) fail('backupLimit');
  return new ZipReader(new BlobReader(file),{useWebWorkers:false,checkSignature:true,checkOverlappingEntry:true,checkAmbiguity:true});
}
export async function previewLibraryBackup(file: Blob, current: Quiz[]): Promise<BackupPreview> {
  const zip = await openArchive(file);
  try {
    const entries = new Map<string, FileEntry>(); let total = 0;
    for await (const entry of zip.getEntriesGenerator()) {
      safePath(entry.filename);
      if(entries.has(entry.filename) || entry.directory || entry.encrypted || entry.uncompressedSize < 0) fail('backupPath');
      total += entry.uncompressedSize;
      if(total > BACKUP_LIMITS.total || entries.size >= BACKUP_LIMITS.entries) fail('backupLimit');
      if (!('getData' in entry)) fail('backupPath');
      entries.set(entry.filename,entry);
    }
    const json = entries.get('manifest.json');
    if(!json || json.uncompressedSize > BACKUP_LIMITS.json || !json.getData) fail('backupInvalid');
    const manifest = validateManifest(JSON.parse(await (await readAsset(json,'application/json',BACKUP_LIMITS.json)).text()));
    if(manifest.assets.filter(a=>a.kind==='image').reduce((n,a)=>n+a.size,0) > BACKUP_LIMITS.images) fail('backupLimit');
    for(const asset of manifest.assets) if(asset.included && entries.get(asset.path!)?.uncompressedSize !== asset.size) fail('backupMissing');
    if(entries.size !== manifest.assets.filter(a=>a.included).length+1) fail('backupInvalid');
    const expected = await readLibrarySnapshot();
    // The dashboard may display default examples when no library has been saved.
    if(expected && JSON.stringify(expected)!==JSON.stringify(current)) fail('backupChanged');
    return {manifest,file,entries,expected,current:structuredClone(current),conflicts:manifest.quizzes.filter(q=>current.some(c=>c.id===q.id)).map(q=>q.id),total};
  } catch(error) { if(error instanceof Error && /unsafe filename/i.test(error.message)) fail('backupPath'); throw error; } finally { await zip.close(); }
}
export function resolveBackupQuizzes(preview: BackupPreview, incoming: Quiz[], mode: RestoreMode, selected: string[], confirmedAll: boolean): Quiz[] {
  if(mode==='all') { if(!confirmedAll) fail('backupConfirm'); return incoming; }
  if(mode==='replace') {
    if(!selected.length || selected.some(id=>!preview.conflicts.includes(id))) fail('backupSelection');
    return preview.current.map(q=>selected.includes(q.id)?incoming.find(v=>v.id===q.id)!:q);
  }
  if(mode!=='add') fail();
  return [...preview.current,...incoming.map(q=> {
    const copy=structuredClone(q), ids = new Map(copy.questions.map(v=>[v.id,uid()]));
    copy.id=uid(); copy.questions=copy.questions.map(v=>({...v,id:ids.get(v.id)!,options:v.options.map(o=>({...o,id:uid()}))}));
    if(copy.videoConfig) copy.videoConfig.checkpoints=copy.videoConfig.checkpoints.map(c=>({...c,questionId:ids.get(c.questionId)!}));
    return copy;
  })];
}
/** Verification/staging finishes before opening the readwrite transaction. Abort retains original library. */
export async function restoreLibraryBackup(preview: BackupPreview, mode: RestoreMode, selected: string[], confirmedAll: boolean, progress?: Progress, signal?: AbortSignal): Promise<Quiz[]> {
  resolveBackupQuizzes(preview,preview.manifest.quizzes,mode,selected,confirmedAll);
  const quizzes=structuredClone(preview.manifest.quizzes), staged=new Map<string,Blob>(), ids=new Map<string,string>(), images=new Map<string,string>();
  const zip=await openArchive(preview.file);
  let done=0;
  try {
    const entries=await zip.getEntries();
    for(const asset of preview.manifest.assets) {
      signal?.throwIfAborted();
      const id=uid(); ids.set(asset.id,id);
      if(!asset.included) continue;
      const entry=entries.find(e=>e.filename===asset.path); if(!entry || !('getData' in entry)) fail('backupMissing');
      const blob=await readAsset(entry,asset.mime,asset.size,signal,n=>progress?.('verify',done+n,preview.total));
      if(blob.size!==asset.size) fail('backupMissing');
      if(asset.kind==='image') images.set(asset.id,await blobToDataUrl(blob));
      else staged.set(id,asset.name ? new File([blob],asset.name,{type:asset.mime}) : blob);
      done+=asset.size; progress?.('verify',done,preview.total);
    }
  } finally { await zip.close(); }
  for(const quiz of quizzes) {
    for(const field of mediaFields(quiz)) { const url=field.get(); if(url?.startsWith('qurioso-asset:')) {
      const old=url.slice(14), image=images.get(old);
      // Legacy per-question inline videos are re-embedded only if small; v1 currently rejects them conservatively below.
      if(!image) fail('backupUnsupportedMedia'); field.set(image);
    } }
    const v=quiz.videoConfig;
    if(v?.videoAssetId) {
      const a=preview.manifest.assets.find(a=>a.id===v.videoAssetId)!;
      v.videoAssetId=ids.get(a.id)!; v.videoUrl=''; v.videoFileName=a.name || v.videoFileName;
      v.missingVideo=a.included?undefined:{name:a.name,size:a.size,sizeKnown:a.sizeKnown,mime:a.mime};
    }
  }
  const updated=resolveBackupQuizzes(preview,quizzes,mode,selected,confirmedAll);
  const used=new Set(updated.map(q=>q.videoConfig?.videoAssetId));
  for(const id of staged.keys()) if(!used.has(id)) staged.delete(id);
  signal?.throwIfAborted(); progress?.('restore',0,1);
  await commitLibraryRestore(preview.expected,updated,staged); progress?.('restore',1,1);
  return updated;
}
/** Relink the shared missing ID in one transaction; every referencing quiz retains its timeline. */
export async function relinkBackupVideo(current: Quiz[], id: string, file: File, acceptMismatch=false): Promise<Quiz[]> {
  const linked=current.filter(q=>q.videoConfig?.videoAssetId===id), descriptor=linked[0]?.videoConfig?.missingVideo;
  if(!descriptor) fail('backupChanged');
  if(!/^video\/(mp4|webm)$/.test(file.type)) fail('backupVideoType');
  if(!acceptMismatch && ((descriptor.sizeKnown!==false && descriptor.size!==file.size) || (descriptor.mime && descriptor.mime!==file.type) || (descriptor.name && descriptor.name!==file.name))) fail('backupMismatch');
  const expected=await readLibrarySnapshot();
  if(!expected || JSON.stringify(expected)!==JSON.stringify(current)) fail('backupChanged');
  const updated=current.map(q=>q.videoConfig?.videoAssetId===id?{...q,videoConfig:{...q.videoConfig,missingVideo:undefined,videoFileName:file.name}}:q);
  await commitLibraryRestore(expected,updated,new Map([[id,file]])); return updated;
}
