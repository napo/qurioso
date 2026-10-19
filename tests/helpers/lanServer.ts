import { spawn } from 'node:child_process';
import { once } from 'node:events';
import type { TestContext } from 'node:test';
import { WebSocket } from 'ws';
import type { GameSession } from '../../src/types/quiz';
import { DEFAULT_QUIZZES } from '../../src/data/defaultQuizzes';
import { publicQuestion } from '../../src/services/sessionState';

export async function startLanServer(t: TestContext) {
  const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    env: { ...process.env, NODE_ENV: 'production', PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => { if (child.exitCode === null) { child.kill(); await once(child, 'exit'); } });
  let errors = '';
  child.stderr.on('data', chunk => { errors += chunk; });
  const base = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server startup timed out: ' + errors)), 10000);
    child.stdout.on('data', chunk => {
      const match = chunk.toString().match(/Qurioso: (http:\/\/localhost:\d+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited (${code}): ${errors}`)); });
  });
  const request = (url: string, method = 'GET', body?: unknown, token?: string) => fetch(base + url, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const mint = async () => (await (await request('/api/presenter-token', 'POST')).json()).hostToken as string;
  const socket = async () => {
    const ws = new WebSocket(base.replace('http:', 'ws:') + '/ws');
    const messages: any[] = [];
    ws.on('message', bytes => messages.push(JSON.parse(bytes.toString())));
    t.after(() => ws.terminate());
    await once(ws, 'open');
    const next = async (data: unknown, predicate: (message: any) => boolean = () => true) => {
      const start = messages.length;
      ws.send(JSON.stringify(data));
      const end = Date.now() + 2000;
      while (Date.now() < end) {
        const found = messages.slice(start).find(predicate);
        if (found) return found;
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      throw new Error('No matching WebSocket response: ' + JSON.stringify(messages));
    };
    return { ws, messages, next };
  };
  return { base, request, mint, socket };
}
export function round(pin = '123456'): GameSession {
  const quiz = DEFAULT_QUIZZES[0];
  return {
    pin, quizId: quiz.id, quizTitle: quiz.title, mode: 'standard', status: 'question',
    currentQuestionIndex: 0, currentQuestion: publicQuestion(quiz, 0), questionStartTime: Date.now(),
    timeRemaining: quiz.questions[0].timeLimit, players: {}, answersForCurrentQuestion: {}, totalQuestions: quiz.questions.length,
  };
}
