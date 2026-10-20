import { GameSession, Player, Question, Quiz } from '../types/quiz';
import type { VideoSelection } from './videoQuiz';
import { presenterQuiz } from './quizStorage';
import { readPresenterCredential, savePresenterCredential, clearPresenterCredential } from './presenterRecovery';
import { readPlayerCredential, savePlayerCredential, clearPlayerCredential } from './playerRecovery';
import type { PlayerCredential } from '../types/playerCredential';

export type PlayerRecovery =
  | { status: 'recovered'; session: GameSession; player: Player; ownAnswer?: { questionId: string; optionId: string; timeTakenMs: number } }
  | { status: 'none' | 'invalid' | 'gone' | 'ended' | 'expired' | 'unavailable'; message?: string };

export type PresenterRecovery =
  | { status: 'recovered'; session: GameSession; quiz: Quiz }
  | { status: 'none' | 'invalid' | 'gone' | 'unavailable' | 'context_missing'; message?: string };

export type GameSyncMessage =
  | { type: 'PLAYER_SESSION_ENDED'; pin: string; message: string }
  | { type: 'PLAYER_JOIN'; pin: string; player: Player }
  | { type: 'PLAYER_DISCONNECTED'; pin: string; playerId: string }
  | { type: 'PLAYER_ANSWER'; pin: string; playerId: string; questionId: string; optionId: string; timeTakenMs: number; questionStartTime?: number; roundId?: string }
  | { type: 'SESSION_STATE_UPDATE'; session: GameSession; revision?: number; sequence?: number; clock?: RoundClockSample; ownAnswer?: { questionId: string; optionId: string; timeTakenMs: number } }
  | { type: 'REQUEST_SESSION_SYNC'; pin: string; playerId: string }
  | { type: 'REACTION'; pin: string; playerId: string; emoji: string };

interface RoundClockSample { roundId: string; questionStartTime: number; remainingMs: number; durationMs: number }

export interface ServerInfo {
  status: string;
  port: number | string;
  protocol: string;
  host: string;
  localIps: string[];
  fullUrl: string;
}

export class GameSyncManager {
  private ws: WebSocket | null = null;
  private wsConnected = false;
  private listeners: ((msg: GameSyncMessage) => void)[] = [];
  private activePin: string | null = null;
  private activeRole: 'host' | 'player' = 'player';
  private activePlayerId?: string;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private pollTimer: ReturnType<typeof setInterval> | undefined;
  private publishQueue: Promise<unknown> = Promise.resolve();
  // Only room-scoped player recovery credentials may enter localStorage; never private snapshots or host tokens.
  private closingPins = new Set<string>();
  private recoveryQuizzes = new Set<string>();
  private hostTokens = new Map<string, string>();
  private playerTokens = new Map<string, string>();
  private playerCredentials = new Map<string, PlayerCredential>();
  private playerRecoveryEpoch = 0;
  private revisions = new Map<string, number>();
  private sequences = new Map<string, number>();
  private snapshots = new Map<string, GameSession>();
  private clocks = new Map<string, RoundClockSample & { receivedAt: number }>();

  private playerKey(pin: string, playerId: string) { return `${pin}:${playerId}`; }
  private credential(pin: string, role = this.activeRole, playerId = this.activePlayerId): string | undefined {
    return role === 'host' ? this.hostTokens.get(pin) : this.playerTokens.get(this.playerKey(pin, playerId || ''));
  }
  private headers(credential?: string): Record<string, string> {
    return { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) };
  }
  private initWebSocket() {
    if (typeof window === 'undefined' || !this.activePin || !this.credential(this.activePin)) return;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const desktopPort = window.quriosoDesktop?.serverPort;
      const host = desktopPort ? `127.0.0.1:${desktopPort}` : window.location.host;
      const ws = new WebSocket(`${protocol}//${host}/ws`);
      this.ws = ws;
      ws.onopen = () => {
        this.wsConnected = true;
        this.sendRegistration();
      };
      ws.onmessage = event => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'PING' || data.type === 'ERROR') return;
          this.handleIncomingMessage(data);
        } catch { /* Ignore malformed transport frames; polling can recover. */ }
      };
      ws.onclose = () => {
        if (this.ws !== ws) return;
        this.wsConnected = false;
        clearTimeout(this.reconnectTimer);
        if (this.activePin) this.reconnectTimer = setTimeout(() => this.initWebSocket(), 3000);
      };
      ws.onerror = () => { if (this.ws === ws) this.wsConnected = false; };
    } catch { /* HTTP polling remains available on networks blocking WebSocket. */ }
  }
  private sendRegistration() {
    if (!this.activePin || this.ws?.readyState !== WebSocket.OPEN) return;
    const token = this.credential(this.activePin);
    if (!token) return;
    this.ws.send(JSON.stringify({ type: 'REGISTER', pin: this.activePin, role: this.activeRole,
      playerId: this.activePlayerId, token }));
  }
  public register(pin: string, role: 'host' | 'player', playerId?: string) {
    this.activePin = pin;
    this.activeRole = role;
    this.activePlayerId = playerId;
    if (!this.credential(pin)) return; // Creation/join must succeed before registering a socket.
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) this.initWebSocket();
    else this.sendRegistration();
    clearInterval(this.pollTimer);
    this.pollTimer = setInterval(async () => {
      if (this.activePin !== pin) return;
      await this.fetchSessionFromServer(pin, true);
    }, 1000);
  }
  public unregister(pin: string) {
    if (this.activePin !== pin) return;
    this.activePin = null;
    clearInterval(this.pollTimer);
    clearTimeout(this.reconnectTimer);
    this.pollTimer = undefined;
    this.reconnectTimer = undefined;
    if (this.ws) { this.ws.onclose = null; this.ws.close(); this.ws = null; }
    this.wsConnected = false;
  }
  private handleIncomingMessage(msg: GameSyncMessage): boolean {
    if (msg.type === 'SESSION_STATE_UPDATE') {
      const pin = msg.session.pin;
      if ((msg.revision !== undefined && msg.revision < (this.revisions.get(pin) ?? -1)) ||
          (msg.sequence !== undefined && msg.sequence < (this.sequences.get(pin) ?? -1))) return false;
      if (msg.revision !== undefined) this.revisions.set(pin, msg.revision);
      if (msg.sequence !== undefined) this.sequences.set(pin, msg.sequence);
      this.snapshots.set(pin, msg.session);
      if (msg.clock) this.rememberClock(pin, msg.clock);
    }
    this.listeners.forEach(listener => {
      try { listener(msg); } catch (e) { console.error('Error in gameSync listener:', e); }
    });
    return true;
  }
  private rememberClock(pin: string, sample: RoundClockSample) {
    const previous = this.clocks.get(pin), now = performance.now();
    const remaining = previous?.roundId === sample.roundId
      ? Math.min(sample.remainingMs, Math.max(0, previous.remainingMs - (now - previous.receivedAt))) : sample.remainingMs;
    this.clocks.set(pin, { ...sample, remainingMs: remaining, receivedAt: now });
  }
  /** A display estimate; grading and expiry are enforced independently by the server. */
  public remainingQuestionSeconds(pin: string, questionStartTime: number, duration: number): number {
    const clock = this.clocks.get(pin);
    if (!clock || clock.questionStartTime !== questionStartTime) return duration;
    return Math.ceil(Math.max(0, clock.remainingMs - (performance.now() - clock.receivedAt)) / 1000);
  }
  public getRoundId(pin: string): string | undefined { return this.snapshots.get(pin)?.roundId; }
  public async flushSession(): Promise<boolean> { return await this.publishQueue !== false; }
  private async retryRequest(action: () => Promise<Response>): Promise<Response | null> {
    const until = performance.now() + 12000;
    do {
      try {
        const response = await action();
        if (response.status < 500) return response;
        await response.body?.cancel();
      } catch { /* Same operation/credential is retried after a brief LAN outage. */ }
      if (performance.now() >= until) return null;
      await new Promise(resolve => setTimeout(resolve, 250));
    } while (true);
  }
  public subscribe(callback: (msg: GameSyncMessage) => void): () => void {
    this.listeners.push(callback);
    return () => { this.listeners = this.listeners.filter(cb => cb !== callback); };
  }
  public async getServerInfo(): Promise<ServerInfo | null> {
    try {
      const res = await fetch('/api/server-info', { signal: AbortSignal.timeout(5000) });
      return res.ok ? await res.json() : null;
    } catch { return null; }
  }
  public createSessionOnServer(session: GameSession, videoQuiz?: Quiz, runtimeQuiz?: Quiz): Promise<boolean> {
    // Serialize all host transitions, including deletion, to prevent late writes resurrecting a room.
    if (this.closingPins.has(session.pin)) return Promise.resolve(false);
    const publish = this.publishQueue.then(async () => {
      try {
        if (runtimeQuiz && !this.recoveryQuizzes.has(session.pin)) {
          try { await presenterQuiz(session.pin, 'write', runtimeQuiz); this.recoveryQuizzes.add(session.pin); }
          catch { /* Storage failure does not block an ordinary LAN session. */ }
        }
        let credential = this.hostTokens.get(session.pin);
        if (!credential) {
          const response = await this.retryRequest(() => fetch('/api/presenter-token', {
            method: 'POST', signal: AbortSignal.timeout(5000), headers: this.headers(), body: '{}',
          }));
          if (!response?.ok) return false;
          credential = (await response.json()).hostToken;
          if (!credential) return false;
          this.hostTokens.set(session.pin, credential);
        }
        // Freeze both the base revision and body for every retry. Never rebase a stale snapshot.
        const definition = videoQuiz ? {
          id: videoQuiz.id, title: videoQuiz.title, settings: videoQuiz.settings,
          questions: videoQuiz.questions.map(({ id, text, type, options, timeLimit, points, explanation }) => ({
            id, text, type, timeLimit, points, explanation,
            options: options.map(({ id, text, color, shape, isCorrect }) => ({ id, text, color, shape, isCorrect })),
          })),
        } : undefined;
        const body = JSON.stringify({ session, videoQuiz: definition, revision: this.revisions.get(session.pin),
          operationId: Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('') });
        // Keep ownership across a reload that loses the initial creation acknowledgement.
        if (!this.closingPins.has(session.pin) && this.recoveryQuizzes.has(session.pin)) savePresenterCredential(session.pin, credential);
        const res = await this.retryRequest(() => fetch('/api/session/create', {
          method: 'POST', signal: AbortSignal.timeout(5000), headers: this.headers(credential), body,
        }));
        if (!res?.ok) {
          if (res?.status === 409) await this.fetchSessionFromServer(session.pin, true);
          return false;
        }
        const data = await res.json();
        if (!this.closingPins.has(session.pin) && this.recoveryQuizzes.has(session.pin)) savePresenterCredential(session.pin, credential);
        this.handleIncomingMessage(data);
        if (this.activePin === session.pin && this.activeRole === 'host' && this.pollTimer === undefined) this.register(session.pin, 'host');
        return true;
      } catch { return false; }
    });
    this.publishQueue = publish;
    return publish;
  }
  public async savePresenterVideoSource(pin: string, selection: VideoSelection): Promise<boolean> {
    await this.publishQueue;
    if (this.closingPins.has(pin)) return false;
    try {
      const quiz = await presenterQuiz(pin, 'read');
      if (!quiz?.videoConfig || this.closingPins.has(pin)) return false;
      await presenterQuiz(pin, 'write', { ...quiz, videoConfig: { ...quiz.videoConfig, ...selection } });
      return true;
    } catch { return false; }
  }
  public canRecoverPresenter(pin: string): boolean {
    const stored = readPresenterCredential();
    return Boolean(stored && stored !== 'invalid' && stored.pin === pin && stored.token === this.hostTokens.get(pin));
  }
  public async recoverPresenter(): Promise<PresenterRecovery> {
    const credential = readPresenterCredential();
    if (!credential) return { status: 'none' };
    if (credential === 'invalid') {
      clearPresenterCredential();
      return { status: 'invalid', message: 'Credenziale di recupero non valida. Il PIN pubblico non permette di recuperare il controllo.' };
    }
    const { pin, token } = credential;
    try {
      // A host-only endpoint proves ownership; a public snapshot or player token cannot restore a presenter.
      const response = await fetch(`/api/session/${pin}/presenter`, {
        headers: this.headers(token), cache: 'no-store', signal: AbortSignal.timeout(5000),
      });
      if (response.status === 403 || response.status === 404) {
        clearPresenterCredential(pin);
        this.hostTokens.delete(pin);
        await presenterQuiz(pin, 'delete').catch(() => {});
        return response.status === 403
          ? { status: 'invalid', message: 'La credenziale del presentatore non è più valida. Il PIN non concede il controllo della partita.' }
          : { status: 'gone', message: 'Sessione non più disponibile: è stata chiusa oppure il server è stato riavviato.' };
      }
      if (!response.ok) throw new Error('Unavailable');
      const data = await response.json();
      this.hostTokens.set(pin, token);
      this.handleIncomingMessage(data);
      const quiz = await presenterQuiz(pin, 'read').catch(() => undefined);
      if (!quiz || quiz.id !== data.session.quizId || !Array.isArray(quiz.questions) || quiz.questions.length !== data.session.totalQuestions) {
        return { status: 'context_missing', message: 'Il quiz necessario al recupero non è più disponibile in questo browser. Puoi riprovare oppure terminare la sessione.' };
      }
      this.recoveryQuizzes.add(pin);
      this.register(pin, 'host');
      if (data.session.videoState?.isPlaying) {
        const paused = { ...data.session, videoState: { ...data.session.videoState, isPlaying: false } };
        if (!await this.createSessionOnServer(paused, data.session.mode === 'video' ? quiz : undefined, quiz)) throw new Error('Conflict');
      }
      return { status: 'recovered', session: this.snapshots.get(pin)!, quiz };
    } catch {
      return { status: 'unavailable', message: 'Server non raggiungibile o sessione cambiata durante il recupero. Controlla la connessione e riprova; la credenziale è stata conservata.' };
    }
  }
  public async endRecoverableSession(): Promise<void> {
    const stored = readPresenterCredential();
    if (stored && stored !== 'invalid') {
      // Deletion still requires server authorization, even for a locally persisted record.
      this.hostTokens.set(stored.pin, stored.token);
      await this.removeSession(stored.pin);
    } else clearPresenterCredential();
  }
  public async submitBotAnswer(pin: string, playerId: string, questionId: string, optionId: string): Promise<boolean> {
    const body = JSON.stringify({ playerId, questionId, optionId, timeTakenMs: 0, roundId: this.getRoundId(pin) });
    const response = await this.retryRequest(() => fetch(`/api/session/${pin}/bot-answer`, {
      method: 'POST', headers: this.headers(this.hostTokens.get(pin)), body, signal: AbortSignal.timeout(5000),
    }));
    return response?.ok ?? false;
  }
  public async fetchSessionFromServer(pin: string, dispatch = false): Promise<GameSession | null> {
    try {
      const res = await fetch(`/api/session/${encodeURIComponent(pin)}`, {
        signal: AbortSignal.timeout(5000), headers: this.headers(this.credential(pin)), cache: 'no-store',
      });
      if (!res.ok) {
        if ([403, 404, 410].includes(res.status) && this.activePin === pin && this.activeRole === 'player') {
          const key = this.playerKey(pin, this.activePlayerId || '');
          const credential = this.playerCredentials.get(key);
          clearPlayerCredential(pin, credential);
          this.playerTokens.delete(key); this.playerCredentials.delete(key);
          this.unregister(pin);
          this.handleIncomingMessage({ type: 'PLAYER_SESSION_ENDED', pin, message: 'Partita non più disponibile o credenziale scaduta. Puoi effettuare un nuovo ingresso.' });
        }
        return null;
      }
      const data = await res.json();
      if (dispatch && this.activePin === pin) this.handleIncomingMessage(data);
      else if ((data.sequence ?? 0) >= (this.sequences.get(pin) ?? -1)) {
        this.snapshots.set(pin, data.session);
        this.sequences.set(pin, data.sequence);
        if (data.clock) this.rememberClock(pin, data.clock);
      }
      return this.snapshots.get(pin) || null;
    } catch { return null; }
  }
  public async joinSessionOnServer(pin: string, player: Player): Promise<boolean> {
    const epoch = this.playerRecoveryEpoch;
    try {
      const key = this.playerKey(pin, player.id);
      const res = await fetch(`/api/session/${encodeURIComponent(pin)}/join`, {
        method: 'POST', signal: AbortSignal.timeout(5000), headers: this.headers(this.playerTokens.get(key)),
        body: JSON.stringify({ player }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (!data.playerToken) return false;
      if (epoch !== this.playerRecoveryEpoch) {
        await fetch(`/api/session/${encodeURIComponent(pin)}/player/${encodeURIComponent(player.id)}/leave`, { method: 'POST', headers: this.headers(data.playerToken), signal: AbortSignal.timeout(5000) }).catch(() => {});
        return false;
      }
      this.playerTokens.set(key, data.playerToken);
      const credential = { pin, playerId: player.id, token: data.playerToken, expiresAt: data.playerExpiresAt };
      this.playerCredentials.set(key, credential);
      savePlayerCredential(credential);
      this.handleIncomingMessage(data);
      this.register(pin, 'player', player.id);
      return true;
    } catch { return false; }
  }
  public canRecoverPlayer(pin: string, playerId: string): boolean {
    const saved = readPlayerCredential(pin);
    return Boolean(saved && typeof saved === 'object' && saved.playerId === playerId && saved.token === this.playerTokens.get(this.playerKey(pin, playerId)));
  }
  public cancelPlayerRecovery() { this.playerRecoveryEpoch++; }
  public async recoverPlayer(pin?: string): Promise<PlayerRecovery> {
    const epoch = ++this.playerRecoveryEpoch;
    const saved = readPlayerCredential(pin);
    if (!saved) return { status: 'none' };
    if (typeof saved === 'string') {
      clearPlayerCredential(pin);
      return { status: 'invalid', message: 'La credenziale del partecipante non è valida. Puoi effettuare un nuovo ingresso.' };
    }
    try {
      const response = await fetch(`/api/session/${saved.pin}/player/${encodeURIComponent(saved.playerId)}`, {
        headers: this.headers(saved.token), cache: 'no-store', signal: AbortSignal.timeout(5000),
      });
      if (epoch !== this.playerRecoveryEpoch) return { status: 'none' };
      if ([403, 404, 410].includes(response.status)) {
        clearPlayerCredential(saved.pin, saved);
        if (this.activePin === saved.pin && this.activeRole === 'player') this.unregister(saved.pin);
        this.playerTokens.delete(this.playerKey(saved.pin, saved.playerId)); this.playerCredentials.delete(this.playerKey(saved.pin, saved.playerId));
        const error = response.status === 410 ? await response.json().catch(() => ({})) : {};
        const status = response.status === 403 ? 'invalid' : response.status === 404 ? 'gone' : error.error === 'Player credential expired' ? 'expired' : 'ended';
        return { status, message: response.status === 403 ? 'Credenziale non valida per questo partecipante. Puoi effettuare un nuovo ingresso.' : response.status === 404 ? 'Partita non più disponibile: è stata chiusa oppure il server è stato riavviato. Puoi effettuare un nuovo ingresso.' : status === 'expired' ? 'La credenziale del partecipante è scaduta. Puoi effettuare un nuovo ingresso.' : 'Partita terminata. Puoi effettuare un nuovo ingresso.' };
      }
      if (!response.ok) throw new Error('Recovery unavailable');
      const data = await response.json();
      if (epoch !== this.playerRecoveryEpoch) return { status: 'none' };
      const player = data.session?.players?.[saved.playerId];
      if (!player || data.session.pin !== saved.pin) throw new Error('Invalid recovery response');
      if (data.session.status === 'finished') {
        // Read-only final result: revoke the credential and never reconnect a player socket.
        const cleanup = this.leavePlayer(saved.pin), completedEpoch = this.playerRecoveryEpoch;
        await cleanup;
        if (completedEpoch !== this.playerRecoveryEpoch) return { status: 'none' };
        return { status: 'recovered', session: data.session, player };
      }
      const key = this.playerKey(saved.pin, saved.playerId);
      const verified = { ...saved, expiresAt: data.playerExpiresAt };
      this.playerTokens.set(key, saved.token); this.playerCredentials.set(key, verified); savePlayerCredential(verified);
      // Fresh authority from the authenticated endpoint, never a persisted session snapshot.
      this.revisions.delete(saved.pin); this.sequences.delete(saved.pin); this.clocks.delete(saved.pin);
      this.handleIncomingMessage(data);
      this.register(saved.pin, 'player', saved.playerId);
      return { status: 'recovered', session: data.session, player, ownAnswer: data.ownAnswer };
    } catch {
      return { status: 'unavailable', message: 'Recupero temporaneamente non disponibile. Controlla la connessione e riprova; la credenziale è stata conservata.' };
    }
  }
  public async leavePlayer(pin?: string, playerId?: string): Promise<void> {
    this.cancelPlayerRecovery();
    const stored = readPlayerCredential(pin);
    const credential = pin && playerId ? this.playerCredentials.get(this.playerKey(pin, playerId)) : typeof stored === 'object' ? stored : undefined;
    const target = pin || credential?.pin;
    if (target) {
      clearPlayerCredential(target, credential || undefined);
      if (this.activeRole === 'player') this.unregister(target);
    } else clearPlayerCredential();
    if (!credential) return;
    const key = this.playerKey(credential.pin, credential.playerId);
    this.playerTokens.delete(key); this.playerCredentials.delete(key);
    this.snapshots.delete(credential.pin); this.sequences.delete(credential.pin); this.revisions.delete(credential.pin); this.clocks.delete(credential.pin);
    try {
      await fetch(`/api/session/${credential.pin}/player/${encodeURIComponent(credential.playerId)}/leave`, {
        method: 'POST', headers: this.headers(credential.token), signal: AbortSignal.timeout(5000),
      });
    } catch { /* Local abandonment succeeds even when remote revocation is unreachable. */ }
  }
  public async submitAnswerOnServer(pin: string, playerId: string, optionId: string, timeTakenMs: number, questionId: string, roundId = this.snapshots.get(pin)?.roundId): Promise<boolean> {
    try {
      const res = await fetch(`/api/session/${encodeURIComponent(pin)}/answer`, {
        method: 'POST', signal: AbortSignal.timeout(5000), headers: this.headers(this.playerTokens.get(this.playerKey(pin, playerId))),
        body: JSON.stringify({ playerId, questionId, optionId, timeTakenMs, roundId }),
      });
      return res.ok;
    } catch { return false; }
  }
  public removeSession(pin: string): Promise<void> {
    this.closingPins.add(pin);
    clearPresenterCredential(pin);
    this.unregister(pin);
    const remove = this.publishQueue.then(async () => {
      const credential = this.hostTokens.get(pin);
      if (credential) {
        try { await fetch(`/api/session/${encodeURIComponent(pin)}`, {
          method: 'DELETE', headers: this.headers(credential), signal: AbortSignal.timeout(5000),
        }); } catch { /* The LAN server may have been stopped. */ }
      }
      clearPresenterCredential(pin); // Pending writes must never restore a credential after explicit exit.
      this.hostTokens.delete(pin);
      this.recoveryQuizzes.delete(pin);
      await presenterQuiz(pin, 'delete').catch(() => {});
      this.revisions.delete(pin);
      this.sequences.delete(pin);
      this.snapshots.delete(pin);
      this.clocks.delete(pin);
    });
    this.publishQueue = remove;
    return remove;
  }
  public generatePin(): string {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return String(100000 + values[0] % 900000);
  }
  public calculatePoints(
    timeLimitSeconds: number,
    timeTakenMs: number,
    basePoints: number = 1000,
    streak: number = 0
  ): number {
    const timeLimitMs = timeLimitSeconds * 1000;
    const ratio = Math.max(0, Math.min(1, 1 - timeTakenMs / (timeLimitMs * 2)));
    const speedScore = Math.round(basePoints * ratio);
    const streakBonus = Math.min(streak * 50, 300);
    return speedScore + streakBonus;
  }

  /** Release sockets, credentials and timers when an embedded client is disposed. */
  public dispose() {
    this.cancelPlayerRecovery();
    if (this.activePin) this.unregister(this.activePin);
    this.hostTokens.clear();
    this.closingPins.clear();
    this.recoveryQuizzes.clear();
    this.playerTokens.clear();
    this.playerCredentials.clear();
    this.revisions.clear();
    this.sequences.clear();
    this.snapshots.clear();
    this.clocks.clear();
  }
  public isServerConnected(): boolean { return this.wsConnected; }
}
export const gameSync = new GameSyncManager();

// Sample Bot Players for quick testing
export const BOT_PLAYERS: { name: string; avatar: string }[] = [
  { name: 'Chiara 🦊', avatar: '🦊' },
  { name: 'Lorenzo ⚡', avatar: '⚡' },
  { name: 'Sofia 🚀', avatar: '🚀' },
  { name: 'Matteo 🦁', avatar: '🦁' },
  { name: 'Giulia 🎨', avatar: '🎨' },
  { name: 'Andrea 🐺', avatar: '🐺' },
  { name: 'Elena 🌟', avatar: '🌟' },
  { name: 'Davide 🎮', avatar: '🎮' },
];

export function generateBotAnswer(
  question: Question,
  _player: Player
): { optionId: string; timeTakenMs: number } {
  const isSmart = Math.random() < 0.8;
  const correctOption = question.options.find((o) => o.isCorrect);
  const incorrectOptions = question.options.filter((o) => !o.isCorrect);

  let chosenOption = correctOption;
  if (!isSmart && incorrectOptions.length > 0) {
    chosenOption = incorrectOptions[Math.floor(Math.random() * incorrectOptions.length)];
  }

  const timeTakenMs = Math.floor(1200 + Math.random() * (question.timeLimit * 600));
  return {
    optionId: chosenOption ? chosenOption.id : question.options[0].id,
    timeTakenMs,
  };
}
