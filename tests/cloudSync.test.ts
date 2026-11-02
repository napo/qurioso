import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { DEFAULT_QUIZZES } from '../src/data/defaultQuizzes';
import type { Quiz } from '../src/types/quiz';
import { loadQuizzes, loadVideo, readLibrarySnapshot, stampLibrary, storeQuizzes, storeVideo } from '../src/services/quizStorage';
import { librarySnapshot, readSyncMeta } from '../src/services/cloudSync/archive';
import { forgetSync, synchronise } from '../src/services/cloudSync/engine';
import { SYNC_FILE_NAME, SyncFileError, readSyncFile, writeSyncFile } from '../src/services/cloudSync/file';
import { DELETION_KEPT_DAYS, mergeSnapshots, snapshotChanges } from '../src/services/cloudSync/merge';
import { DriveClient } from '../src/services/cloudSync/drive';
import { DropboxClient } from '../src/services/cloudSync/dropbox';
import { OneDriveClient } from '../src/services/cloudSync/onedrive';
import { PkceAuth, SignInError, pkcePair } from '../src/services/cloudSync/pkce';
import { StorageError, type CloudStorage } from '../src/services/cloudSync/types';

const device = () => new IDBFactory();
const use = (factory: IDBFactory) => Object.defineProperty(globalThis, 'indexedDB', { value: factory, configurable: true });
beforeEach(() => { use(device()); });

const quiz = (id: string, title = id, createdAt = 1000): Quiz => { const q = structuredClone(DEFAULT_QUIZZES.find(item => !item.videoConfig)!); delete q.coverImage; delete q.coverAttribution; return { ...q, id, title, createdAt }; };
const record = (id: string, updatedAt: number, title = id) => ({ id, updatedAt, quiz: quiz(id, title) });

/** The file on the service, shared by the devices, with conditional writes like the real ones. */
class FakeCloud implements CloudStorage {
  bytes: Uint8Array | null = null; revision = 0; beforeUpdate?: () => void; updates = 0; refused = 0;
  private file() { return { id: 'file', version: String(this.revision) }; }
  async findArchive() { return this.bytes ? this.file() : null; }
  async version() { return this.bytes ? String(this.revision) : null; }
  async download() { return this.bytes!; }
  async create(bytes: Uint8Array) { this.bytes = bytes; this.revision++; return this.file(); }
  async update(_id: string, bytes: Uint8Array, expected: string) {
    this.beforeUpdate?.(); this.beforeUpdate = undefined;
    if (expected !== String(this.revision)) { this.refused++; return null; }
    this.bytes = bytes; this.revision++; this.updates++; return this.file();
  }
  async trash() { this.bytes = null; }
}
const auth = { token: async () => 'token', invalidate() {}, signOut: async () => {} };
const run = (cloud: CloudStorage, now = Date.now) => synchronise({ auth, storage: () => cloud, appVersion: '1.3.3', now });
const titles = async () => ((await loadQuizzes()) ?? []).map(q => q.title).sort();

test('saving stamps only changed quizzes and records deletions, without touching the quizzes themselves', async () => {
  const a = quiz('a'), b = quiz('b');
  const first = stampLibrary(undefined, undefined, [a, b], 5000);
  assert.deepEqual(first, { stamps: { a: 5000, b: 5000 }, deletions: {} });
  const second = stampLibrary(first, [a, b], [{ ...a, title: 'new' }], 5000);
  assert.equal(second.stamps.a, 5001, 'a change in the same millisecond still counts');
  assert.deepEqual(second.deletions, { b: 5000 });
  assert.equal(stampLibrary(second, [a], [a, { ...b }], 6000).deletions.b, undefined, 'recreating a quiz clears its deletion');
  await storeQuizzes([a]);
  assert.deepEqual(await loadQuizzes(), [a]);
  assert.deepEqual(await readLibrarySnapshot(), [a]);
});

test('merge: one-sided change wins, two-sided keeps both, deletions travel and expire', () => {
  const base = { a: 10 };
  const side = (updatedAt: number, title: string) => ({ quizzes: [record('a', updatedAt, title)], deletions: [] });
  assert.equal(mergeSnapshots(side(10, 'old'), side(20, 'remote'), base).merged.quizzes[0].quiz.title, 'remote');
  assert.equal(mergeSnapshots(side(20, 'local'), side(10, 'old'), base).merged.quizzes[0].quiz.title, 'local');
  const both = mergeSnapshots(side(20, 'local'), side(30, 'remote'), base, () => 'copy');
  assert.equal(both.conflicts, 1);
  assert.deepEqual(both.merged.quizzes.map(r => [r.id, r.quiz.id, r.quiz.title]).sort(), [['a', 'a', 'remote'], ['copy', 'copy', 'local']]);
  const removed = mergeSnapshots(side(10, 'old'), { quizzes: [], deletions: [{ id: 'a', deletedAt: 20 }] }, base, undefined, 100);
  assert.deepEqual(removed.merged, { quizzes: [], deletions: [{ id: 'a', deletedAt: 20 }] });
  const edited = mergeSnapshots(side(30, 'edited'), { quizzes: [], deletions: [{ id: 'a', deletedAt: 20 }] }, base);
  assert.equal(edited.merged.quizzes[0].quiz.title, 'edited', 'an edit later than the deletion survives');
  const now = DELETION_KEPT_DAYS * 86_400_000 + 1000;
  assert.deepEqual(mergeSnapshots({ quizzes: [], deletions: [{ id: 'x', deletedAt: 1 }] }, { quizzes: [], deletions: [] }, {}, undefined, now).merged.deletions, []);
  assert.equal(snapshotChanges(side(10, 'same'), side(10, 'same')).changed, false);
});

test('two devices converge through the file: new quizzes, edits and deletions', async () => {
  const cloud = new FakeCloud(), one = device(), two = device();
  use(one); await storeQuizzes([quiz('a', 'A'), quiz('b', 'B')]);
  assert.deepEqual(await run(cloud), { done: true, received: 0, uploaded: true, conflicts: 0, skipped: 0 });
  use(two); await storeQuizzes([quiz('c', 'C')]);
  await run(cloud);
  assert.deepEqual(await titles(), ['A', 'B', 'C']);
  use(one); await run(cloud);
  assert.deepEqual(await titles(), ['A', 'B', 'C']);
  const current = (await loadQuizzes())!;
  await storeQuizzes(current.filter(q => q.id !== 'b').map(q => q.id === 'a' ? { ...q, title: 'A2' } : q));
  await run(cloud);
  use(two); await run(cloud);
  assert.deepEqual(await titles(), ['A2', 'C']);
  const revision = cloud.revision;
  const quiet = await run(cloud);
  assert.equal(quiet.uploaded, false, 'nothing to send');
  assert.equal(cloud.revision, revision);
  assert.equal(quiet.received, 0);
});

test('a conflict keeps both versions on every device', async () => {
  const cloud = new FakeCloud(), one = device(), two = device();
  use(one); await storeQuizzes([quiz('a', 'start')]); await run(cloud);
  use(two); await run(cloud);
  await new Promise(resolve => setTimeout(resolve, 3));
  use(one); await storeQuizzes([{ ...(await loadQuizzes())![0], title: 'one' }]);
  await new Promise(resolve => setTimeout(resolve, 3));
  use(two); await storeQuizzes([{ ...(await loadQuizzes())![0], title: 'two' }]);
  await run(cloud);
  use(one); const result = await run(cloud);
  assert.equal(result.conflicts, 1);
  assert.deepEqual(await titles(), ['one', 'two']);
  use(two); await run(cloud);
  assert.deepEqual(await titles(), ['one', 'two']);
});

test('a file changed by another device during the upload is merged, not overwritten', async () => {
  const cloud = new FakeCloud();
  const other = (title: string, updatedAt: number) => writeSyncFile({ quizzes: [{ id: 'other', updatedAt, quiz: quiz('other', title) }], deletions: [] }, '1.3.3');
  cloud.bytes = other('start', 9000); cloud.revision = 1;
  await storeQuizzes([quiz('mine', 'mine')]);
  cloud.beforeUpdate = () => { cloud.bytes = other('changed', 9001); cloud.revision++; };
  const result = await run(cloud);
  assert.equal(result.done, true);
  assert.equal(result.conflicts, 0, 'what was received in the refused round is not a conflict');
  assert.equal(cloud.refused, 1);
  assert.deepEqual(readSyncFile(cloud.bytes!).quizzes.map(r => r.quiz.title).sort(), ['changed', 'mine']);
  assert.deepEqual(await titles(), ['changed', 'mine']);
});

test('a quiz edited while the sync runs is not overwritten', async () => {
  const later = Date.now() + 60_000;
  await storeQuizzes([quiz('a', 'start')]);
  const { applySyncChanges } = await import('../src/services/cloudSync/archive');
  const before = await librarySnapshot();
  await storeQuizzes([{ ...(await loadQuizzes())![0], title: 'edited' }]);
  const applied = await applySyncChanges([{ id: 'a', updatedAt: later, quiz: quiz('a', 'remote') }], [], new Map(before.quizzes.map(r => [r.id, r.updatedAt])));
  assert.equal(applied, 0);
  assert.deepEqual(await titles(), ['edited']);
});

test('untouched included quizzes stay out, edited ones travel, invalid legacy quizzes stay local', async () => {
  const original = DEFAULT_QUIZZES.find(q => !q.videoConfig)!;
  const broken = { ...quiz('broken'), coverImage: 'blob:http://x/1' };
  await storeQuizzes([{ ...original, createdAt: 12345 }, broken, quiz('mine')]);
  let snapshot = await librarySnapshot();
  assert.deepEqual(snapshot.quizzes.map(r => r.id), ['mine']);
  assert.equal(snapshot.skipped, 1);
  await storeQuizzes([{ ...original, title: 'Edited' }, broken, quiz('mine')]);
  snapshot = await librarySnapshot();
  assert.deepEqual(snapshot.quizzes.map(r => r.id).sort(), [original.id, 'mine'].sort());
  const cloud = new FakeCloud();
  await run(cloud);
  assert.ok((await loadQuizzes())!.some(q => q.id === 'broken'), 'never deleted because it cannot travel');
});

test('local videos never travel: another device sees a relinkable description, the first keeps its file', async () => {
  const cloud = new FakeCloud(), one = device(), two = device();
  use(one);
  const blob = new Blob(['video bytes'], { type: 'video/webm' }), assetId = await storeVideo(blob);
  const lesson: Quiz = { ...quiz('lesson'), videoConfig: { videoUrl: '', videoTitle: 'Lesson', videoType: 'file', videoAssetId: assetId, videoFileName: 'lesson.webm', pauseMode: 'defined', checkpointMode: 'explicit', checkpoints: [] } };
  await storeQuizzes([lesson]);
  await run(cloud);
  const sent = JSON.parse(new TextDecoder().decode(cloud.bytes!));
  assert.equal(JSON.stringify(sent).includes(assetId), false);
  assert.deepEqual(sent.quizzes[0].quiz.videoConfig.missingVideo, { name: 'lesson.webm', size: blob.size, sizeKnown: true, mime: 'video/webm' });
  use(two); await run(cloud);
  const received = (await loadQuizzes())![0].videoConfig!;
  assert.ok(received.videoAssetId && received.videoAssetId !== assetId);
  assert.equal(received.missingVideo?.name, 'lesson.webm');
  const revision = cloud.revision;
  await run(cloud);
  assert.equal(cloud.revision, revision, 'the description does not cause endless uploads');
  use(one); await run(cloud);
  const kept = (await loadQuizzes())![0].videoConfig!;
  assert.equal(kept.videoAssetId, assetId);
  assert.equal(kept.missingVideo, undefined);
  assert.equal((await loadVideo(assetId)).size, blob.size);
  assert.equal(cloud.revision, revision);
});

test('the sync file is validated and only safe fields survive', () => {
  const bad = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
  const fails = (bytes: Uint8Array, code: string) => assert.throws(() => readSyncFile(bytes), (e: unknown) => e instanceof SyncFileError && e.message === code);
  fails(new TextEncoder().encode('not json'), 'syncInvalid');
  fails(bad({ format: 'other' }), 'syncInvalid');
  fails(bad({ format: 'qurioso-sync', version: 2, quizzes: [], deletions: [] }), 'syncVersion');
  fails(bad({ format: 'qurioso-sync', version: 1, quizzes: [{ id: 'a', updatedAt: 1, quiz: { id: 'a' } }], deletions: [] }), 'syncInvalid');
  const good = readSyncFile(bad({ format: 'qurioso-sync', version: 1, deletions: [{ id: 'x', deletedAt: 1 }, { id: 3 }, { id: 'y', deletedAt: 'never' }], quizzes: [
    { id: 'a', updatedAt: 1, quiz: { ...quiz('a'), secret: 'token' } }, { id: 'b', updatedAt: 1, quiz: { id: 'b' } }, { id: 'c', updatedAt: 1, quiz: quiz('other') }, { id: 'd', updatedAt: -1, quiz: quiz('d') },
  ] }));
  assert.deepEqual(good.quizzes.map(r => r.id), ['a']);
  assert.equal('secret' in good.quizzes[0].quiz, false);
  assert.deepEqual(good.deletions, [{ id: 'x', deletedAt: 1 }]);
  assert.match(SYNC_FILE_NAME, /\.json$/);
});

test('sync gets a new token once after a 401, stops without one and forgets on request', async () => {
  let invalidated = 0, calls = 0;
  const cloud = new FakeCloud();
  const result = await synchronise({ auth: { ...auth, invalidate() { invalidated++; } }, appVersion: '1', storage: () => ({ ...cloud, version: cloud.version.bind(cloud), download: cloud.download.bind(cloud), create: cloud.create.bind(cloud), update: cloud.update.bind(cloud), trash: cloud.trash.bind(cloud), findArchive: async () => { if (!calls++) throw new StorageError(401); return cloud.findArchive(); } }) });
  assert.equal(result.done, true);
  assert.equal(invalidated, 1);
  assert.ok((await readSyncMeta()).fileId);
  await forgetSync();
  assert.deepEqual(await readSyncMeta(), {});
  assert.equal((await synchronise({ auth: { ...auth, token: async () => null }, appVersion: '1', storage: () => cloud })).done, false);
  await assert.rejects(synchronise({ auth, appVersion: '1', storage: () => ({ ...cloud, findArchive: async () => { throw new StorageError(403); } }) as unknown as CloudStorage }));
});

const respond = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });

test('each service sends the token, stays in the app space and reports a changed file as a refused update', async () => {
  const seen: { url: string; init: RequestInit }[] = [];
  const logged = (reply: (url: string) => Response) => async (url: string, init: RequestInit = {}) => { seen.push({ url, init }); return reply(url); };
  const bytes = new Uint8Array([1, 2, 3]);

  const dropbox = new DropboxClient('t', logged(() => respond(409, { error_summary: 'path/conflict/file/..' })));
  assert.equal(await dropbox.update('', bytes, 'rev1'), null);
  const arg = JSON.parse((seen.at(-1)!.init.headers as Record<string, string>)['Dropbox-API-Arg']);
  assert.deepEqual(arg.mode, { '.tag': 'update', update: 'rev1' });
  assert.equal((seen.at(-1)!.init.headers as Record<string, string>).Authorization, 'Bearer t');
  assert.equal(await new DropboxClient('t', logged(() => respond(409, { error_summary: 'path/not_found/..' }))).findArchive(), null);
  await assert.rejects(new DropboxClient('t', logged(() => respond(401))).findArchive(), (e: unknown) => e instanceof StorageError && e.status === 401);

  const onedrive = new OneDriveClient('t', logged(() => respond(412)));
  assert.equal(await onedrive.update('', bytes, 'etag1'), null);
  assert.equal((seen.at(-1)!.init.headers as Record<string, string>)['If-Match'], 'etag1');
  assert.ok(seen.at(-1)!.url.includes('/special/approot:/'));
  assert.equal(await new OneDriveClient('t', logged(() => respond(404))).findArchive(), null);
  const signed = new OneDriveClient('t', async (url, init) => { seen.push({ url, init: init ?? {} }); return url.endsWith('signed') ? new Response(bytes) : respond(200, { eTag: 'e', '@microsoft.graph.downloadUrl': 'https://files.example/signed' }); });
  assert.deepEqual(await signed.download(), bytes);
  assert.equal((seen.at(-1)!.init.headers as Record<string, string> | undefined)?.Authorization, undefined, 'the token never reaches the download address');

  const drive = new DriveClient('t', logged(() => respond(200, { version: '8', trashed: false })));
  assert.equal(await drive.update('id', bytes, '7'), null);
  assert.equal(seen.at(-1)!.init.method, undefined, 'no write when the version differs');
  assert.equal(await new DriveClient('t', logged(() => respond(404))).version('id'), null);
  assert.equal(await new DriveClient('t', logged(() => respond(200, { version: '8', trashed: true }))).version('id'), null);
  await new DriveClient('t', logged(() => respond(200, { files: [] }))).findArchive();
  assert.ok(decodeURIComponent(seen.at(-1)!.url.replace(/\+/g, ' ')).includes("key='qurioso' and value='archive'"));
});

test('PKCE sign-in checks the state, keeps the refresh token and renews without the browser', async () => {
  const { verifier, challenge } = await pkcePair();
  assert.ok(verifier.length >= 43 && /^[\w-]+$/.test(challenge));
  const stored = new Map<string, string>();
  const storage = { getItem: (k: string) => stored.get(k) ?? null, setItem: (k: string, v: string) => { stored.set(k, v); }, removeItem: (k: string) => { stored.delete(k); } };
  const bodies: URLSearchParams[] = [];
  let opened = '', reply = (state: string) => `http://127.0.0.1:1/?code=abc&state=${state}`;
  const make = () => new PkceAuth({
    endpoints: { authorize: 'https://auth.example/a', token: 'https://auth.example/t', scope: 's', storageKey: 'k' }, clientId: 'id', storage,
    fetch: async (_url, init) => { bodies.push(new URLSearchParams(String(init!.body))); return respond(200, { access_token: `access${bodies.length}`, refresh_token: 'refresh', expires_in: 3600 }); },
    redirect: async () => ({ uri: 'http://127.0.0.1:1', wait: () => new Promise(resolve => setTimeout(() => resolve(reply(new URL(opened).searchParams.get('state')!)))) }),
    openBrowser: async url => { opened = url; },
  });
  const auth = make();
  assert.equal(await auth.token(false), null, 'never opens the browser unless asked');
  assert.equal(opened, '');
  assert.equal(await auth.token(true), 'access1');
  assert.equal(new URL(opened).searchParams.get('code_challenge_method'), 'S256');
  assert.equal(bodies[0].get('grant_type'), 'authorization_code');
  assert.ok(bodies[0].get('code_verifier'));
  assert.equal(stored.get('k'), 'refresh');
  assert.equal(await make().token(false), 'access2', 'a new session renews silently');
  assert.equal(bodies[1].get('grant_type'), 'refresh_token');
  stored.clear();
  reply = () => 'http://127.0.0.1:1/?code=abc&state=forged';
  await assert.rejects(make().token(true), SignInError);
});
