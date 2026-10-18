import { GameSession, Player, Question } from '../types/quiz';

export type GameSyncMessage =
  | { type: 'HOST_CREATED_SESSION'; session: GameSession }
  | { type: 'PLAYER_JOIN'; pin: string; player: Player; players?: Record<string, Player> }
  | { type: 'PLAYER_LEAVE'; pin: string; playerId: string }
  | { type: 'PLAYER_DISCONNECTED'; pin: string; playerId: string }
  | { type: 'PLAYER_ANSWER'; pin: string; playerId: string; questionId: string; optionId: string; timeTakenMs: number; answersCount?: number }
  | { type: 'SESSION_STATE_UPDATE'; session: GameSession }
  | { type: 'REQUEST_SESSION_SYNC'; pin: string; playerId: string }
  | { type: 'REACTION'; pin: string; playerId: string; emoji: string };

export interface ServerInfo {
  status: string;
  port: number | string;
  protocol: string;
  host: string;
  localIps: string[];
  fullUrl: string;
}

class GameSyncManager {
  private ws: WebSocket | null = null;
  private wsConnected = false;
  private channel: BroadcastChannel | null = null;
  private listeners: ((msg: GameSyncMessage) => void)[] = [];
  private activePin: string | null = null;
  private activeRole: 'host' | 'player' = 'player';
  private activePlayerId?: string;
  private reconnectTimer: any = null;
  private pollTimer: any = null;
  private publishQueue: Promise<unknown> = Promise.resolve();

  constructor() {
    // 1. BroadcastChannel (for local tab syncing)
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('qurioso_game_channel');
        this.channel.onmessage = (event) => {
          this.handleIncomingMessage(event.data);
        };
      } catch (err) {
        console.warn('BroadcastChannel fallback:', err);
      }
    }

    // 2. Storage event fallback
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === 'qurioso_latest_event' && e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            this.handleIncomingMessage(parsed);
          } catch {}
        }
      });

      // A classroom activity does not need a multiplayer connection.
    }
  }

  private initWebSocket() {
    if (typeof window === 'undefined') return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.wsConnected = true;
        // Re-register if we already have an active room
        if (this.activePin) {
          this.register(this.activePin, this.activeRole, this.activePlayerId);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'PING') return;
          this.handleIncomingMessage(data);
        } catch (e) {
          console.error('Error parsing WS message:', e);
        }
      };

      this.ws.onclose = () => {
        this.wsConnected = false;
        // Try reconnecting after 3 seconds
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          this.initWebSocket();
        }, 3000);
      };

      this.ws.onerror = () => {
        this.wsConnected = false;
      };
    } catch (e) {
      console.warn('WebSocket init error (will use HTTP fallback):', e);
    }
  }

  // Register client with server for this PIN
  public register(pin: string, role: 'host' | 'player', playerId?: string) {
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) this.initWebSocket();
    this.activePin = pin;
    this.activeRole = role;
    this.activePlayerId = playerId;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'REGISTER',
        pin,
        role,
        playerId,
      }));
    }

    // Polling also recovers an event lost while the WebSocket still appears connected.
    this.startPolling(pin);
  }

  private startPolling(pin: string) {
    clearInterval(this.pollTimer);
    this.pollTimer = setInterval(async () => {
      // Poll both roles so missed events never leave a client waiting indefinitely.
      if (this.activePin === pin) {
        try {
          const session = await this.fetchSessionFromServer(pin);
          if (session) {
            this.handleIncomingMessage({
              type: 'SESSION_STATE_UPDATE',
              session,
            });
          }
        } catch {}
      }
    }, 1000);
  }

  private handleIncomingMessage(msg: GameSyncMessage) {
    this.listeners.forEach((listener) => {
      try {
        listener(msg);
      } catch (e) {
        console.error('Error in gameSync listener:', e);
      }
    });
  }

  public subscribe(callback: (msg: GameSyncMessage) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  public broadcast(msg: GameSyncMessage) {
    // 1. WebSocket send to server
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(msg));
      } catch (err) {
        console.warn('WS send failed, will use HTTP fallback:', err);
      }
    }

    // 2. BroadcastChannel
    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch {}
    }

    // 3. LocalStorage cross-tab
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          'qurioso_latest_event',
          JSON.stringify({ ...msg, _t: Date.now() + Math.random() })
        );
      } catch {}
    }

    // 4. Local listeners dispatch
    this.handleIncomingMessage(msg);
  }

  // Server API helpers
  public async getServerInfo(): Promise<ServerInfo | null> {
    try {
      const res = await fetch('/api/server-info', { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Failed to fetch server info:', e);
    }
    return null;
  }

  public createSessionOnServer(session: GameSession): Promise<boolean> {
    this.saveSession(session);
    // Preserve host transition order even when HTTP requests complete at different speeds.
    const publish = this.publishQueue.then(async () => {
      try {
        const res = await fetch('/api/session/create', {
          method: 'POST', signal: AbortSignal.timeout(5000), headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session }),
        });
        return res.ok;
      } catch { return false; }
    });
    this.publishQueue = publish;
    return publish;
  }

  public async fetchSessionFromServer(pin: string): Promise<GameSession | null> {
    try {
      const res = await fetch(`/api/session/${pin}`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        return data.session || null;
      }
    } catch {}
    return this.getSession(pin);
  }

  public async joinSessionOnServer(pin: string, player: Player): Promise<boolean> {
    try {
      const res = await fetch(`/api/session/${pin}/join`, {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async submitAnswerOnServer(
    pin: string,
    playerId: string,
    optionId: string,
    timeTakenMs: number,
    questionId: string
  ): Promise<boolean> {
    try {
      const res = await fetch(`/api/session/${pin}/answer`, {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, questionId, optionId, timeTakenMs }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // Local storage caching helpers
  public saveSession(session: GameSession) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`qurioso_session_${session.pin}`, JSON.stringify(session));
    } catch {}
  }

  public getSession(pin: string): GameSession | null {
    if (typeof window === 'undefined') return null;
    try {
      const data = localStorage.getItem(`qurioso_session_${pin}`);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  public removeSession(pin: string) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(`qurioso_session_${pin}`);
      fetch(`/api/session/${pin}`, { method: 'DELETE' }).catch(() => {});
    } catch {}
  }

  public generatePin(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
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

  /** Release sockets and timers when an embedded client is disposed. */
  public dispose() {
    this.activePin = null;
    clearInterval(this.pollTimer);
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }
    this.channel?.close();
    this.wsConnected = false;
  }

  public isServerConnected(): boolean {
    return this.wsConnected;
  }
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
