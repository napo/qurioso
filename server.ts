import 'dotenv/config';
import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// PORT=0 asks the OS for a free port; a fixed port remains optional.
const requestedPort = Number(process.env.PORT ?? 0);
if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) {
  throw new Error('PORT must be an integer between 0 and 65535');
}
let listeningPort = requestedPort;

// Shared WebSocket Server instance
const wss = new WebSocketServer({ noServer: true });

function attachWsUpgrade(httpServer: http.Server) {
  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const host = request.headers.host || `localhost:${listeningPort}`;
      const url = new URL(request.url || '', `http://${host}`);
      if (url.pathname === '/ws') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } // Other upgrade handlers (Vite HMR) own their own paths.
    } catch {
      socket.destroy();
    }
  });
}

app.use(express.json());

// Enable CORS for local network and cross-origin access
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// In-Memory Session Store
interface ConnectedClient {
  ws: WebSocket;
  role: 'host' | 'player';
  playerId?: string;
  pin: string;
}

const sessions = new Map<string, any>();
const sessionClients = new Map<string, Set<ConnectedClient>>();

// Helper to broadcast to all clients in a session PIN
function broadcastToPin(pin: string, data: any, excludeWs?: WebSocket) {
  const clients = sessionClients.get(pin);
  if (!clients) return;

  const payload = JSON.stringify(data);
  for (const client of clients) {
    if (client.ws !== excludeWs && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(payload);
      } catch (err) {
        console.error('Error sending WS message:', err);
      }
    }
  }
}

// REST Endpoints
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    app: 'Qurioso',
    port: listeningPort,
    uptime: process.uptime(),
    activeSessions: sessions.size,
  });
});

app.get('/api/server-info', (req, res) => {
  const networkInterfaces = os.networkInterfaces();
  const localIps: string[] = [];

  for (const name of Object.keys(networkInterfaces)) {
    for (const net of networkInterfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        localIps.push(net.address);
      }
    }
  }

  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers.host || `localhost:${listeningPort}`;

  res.json({
    status: 'ok',
    port: listeningPort,
    protocol,
    host,
    localIps,
    fullUrl: `${protocol}://${host}`,
  });
});

// Create or update session
app.post('/api/session/create', (req, res) => {
  const { session } = req.body;
  if (!session || !session.pin) {
    res.status(400).json({ error: 'Missing session or pin' });
    return;
  }

  const existing = sessions.get(session.pin);
  if (existing && existing.questionStartTime === session.questionStartTime) {
    session.players = { ...existing.players, ...session.players };
    session.answersForCurrentQuestion = { ...existing.answersForCurrentQuestion, ...session.answersForCurrentQuestion };
  }
  sessions.set(session.pin, session);
  if (!sessionClients.has(session.pin)) {
    sessionClients.set(session.pin, new Set());
  }

  broadcastToPin(session.pin, {
    type: 'SESSION_STATE_UPDATE',
    session,
  });

  res.json({ success: true, pin: session.pin, session });
});

app.get('/api/session/:pin', (req, res) => {
  const pin = req.params.pin;
  const session = sessions.get(pin);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json({ success: true, session });
});

app.post('/api/session/:pin/join', (req, res) => {
  const pin = req.params.pin;
  const { player } = req.body;
  const session = sessions.get(pin);

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  if (!player || typeof player.id !== 'string' || typeof player.nickname !== 'string') {
    res.status(400).json({ error: 'Invalid player' });
    return;
  }
  if (!session.players) session.players = {};
  session.players[player.id] ??= player;
  sessions.set(pin, session);

  broadcastToPin(pin, {
    type: 'PLAYER_JOIN',
    pin,
    player,
    players: session.players,
  });

  res.json({ success: true, session });
});

function receiveAnswer(pin: string, data: any): { status: number; error?: string } {
  const session = sessions.get(pin);
  if (!session) return { status: 404, error: 'Session not found' };
  const { playerId, questionId, optionId, timeTakenMs } = data;
  if (session.currentQuestion?.id !== questionId ||
      !session.players?.[playerId] || !Number.isFinite(timeTakenMs) || timeTakenMs < 0 ||
      !session.currentQuestion.options.some((option: any) => option.id === optionId)) {
    return { status: 400, error: 'Invalid answer or question no longer active' };
  }
  // Retrying the same HTTP request acknowledges receipt without scoring twice.
  const previous = session.answersForCurrentQuestion?.[playerId];
  if (previous) return previous.optionId === optionId
    ? { status: 200 } : { status: 409, error: 'Answer already submitted' };
  if (session.status !== 'question' || Date.now() > session.questionStartTime + session.timeRemaining * 1000 + 1000) {
    return { status: 409, error: 'Question expired' };
  }
  session.answersForCurrentQuestion ??= {};
  session.answersForCurrentQuestion[playerId] = { questionId, optionId, timeTakenMs };
  broadcastToPin(pin, { type: 'PLAYER_ANSWER', pin, playerId, questionId, optionId, timeTakenMs });
  broadcastToPin(pin, { type: 'SESSION_STATE_UPDATE', session });
  return { status: 200 };
}

app.post('/api/session/:pin/answer', (req, res) => {
  const result = receiveAnswer(req.params.pin, req.body);
  res.status(result.status).json(result.error ? { error: result.error } : { success: true, received: true });
});

app.post('/api/session/:pin/state', (req, res) => {
  const pin = req.params.pin;
  const { session } = req.body;
  if (!session) {
    res.status(400).json({ error: 'Missing session' });
    return;
  }

  sessions.set(pin, session);
  broadcastToPin(pin, {
    type: 'SESSION_STATE_UPDATE',
    session,
  });

  res.json({ success: true });
});

app.delete('/api/session/:pin', (req, res) => {
  const pin = req.params.pin;
  sessions.delete(pin);
  sessionClients.delete(pin);
  res.json({ success: true });
});

// WebSocket Server Handlers
wss.on('connection', (ws: WebSocket) => {
  let registeredClient: ConnectedClient | null = null;

  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'REGISTER') {
        const { pin, role, playerId } = data;
        if (registeredClient) sessionClients.get(registeredClient.pin)?.delete(registeredClient);
        registeredClient = { ws, pin, role, playerId };

        if (!sessionClients.has(pin)) {
          sessionClients.set(pin, new Set());
        }
        sessionClients.get(pin)!.add(registeredClient);

        // Send back current session state if available
        const currentSession = sessions.get(pin);
        if (currentSession) {
          ws.send(JSON.stringify({
            type: 'SESSION_STATE_UPDATE',
            session: currentSession,
          }));
        }
        return;
      }

      if (data.type === 'SESSION_STATE_UPDATE' && data.session) {
        sessions.set(data.session.pin, data.session);
        broadcastToPin(data.session.pin, data, ws);
        return;
      }

      if (data.type === 'PLAYER_JOIN' && data.pin && data.player) {
        const session = sessions.get(data.pin);
        if (session) {
          if (!session.players) session.players = {};
          session.players[data.player.id] = data.player;
          sessions.set(data.pin, session);
        }
        broadcastToPin(data.pin, data);
        return;
      }

      if (data.type === 'PLAYER_ANSWER' && data.pin) {
        receiveAnswer(data.pin, data);
        return;
      }

      // Generic broadcast for other messages
      if (data.pin) {
        broadcastToPin(data.pin, data, ws);
      }
    } catch (e) {
      console.error('Error parsing WS message:', e);
    }
  });

  ws.on('close', () => {
    if (registeredClient) {
      const set = sessionClients.get(registeredClient.pin);
      if (set) {
        set.delete(registeredClient);
        if (registeredClient.role === 'player' && registeredClient.playerId) {
          broadcastToPin(registeredClient.pin, {
            type: 'PLAYER_DISCONNECTED',
            pin: registeredClient.pin,
            playerId: registeredClient.playerId,
          });
        }
      }
    }
  });

  // Keep-alive ping
  ws.send(JSON.stringify({ type: 'PING' }));
});

// Heartbeat interval for WebSocket connections
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.ping();
      } catch {}
    }
  });
}, 30000);

// Mounting Vite in development or static serving in production
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';
  const server = http.createServer(app);
  attachWsUpgrade(server);

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = process.env.QURIOSO_DIST_PATH || path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.on('error', (error) => {
    console.error('Unable to start Qurioso:', error.message);
    process.exit(1);
  });
  server.listen(requestedPort, '0.0.0.0', () => {
    listeningPort = (server.address() as import('net').AddressInfo).port;
    const parentPort = (process as NodeJS.Process & { parentPort?: { postMessage: (message: unknown) => void } }).parentPort;
    parentPort?.postMessage({ type: 'ready', port: listeningPort });
    console.log(`Qurioso: http://localhost:${listeningPort}`);
    for (const networks of Object.values(os.networkInterfaces())) {
      for (const net of networks || []) {
        if (net.family === 'IPv4' && !net.internal) console.log(`Wi-Fi / LAN: http://${net.address}:${listeningPort}`);
      }
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
