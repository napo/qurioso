import type { GameSession } from '../types/quiz';
import type { Language } from '../i18n/translations';
import { gameExperienceTranslations } from '../i18n/gameExperience';

export interface ResultRow { id: string; nickname: string; avatar: string; score: number }
export interface FinalResult { pin: string; title: string; playerId: string; players: ResultRow[]; expiresAt: number }
const key = (pin: string) => `qurioso_final_result_v1:${pin}`;
export function finalResult(session: GameSession, playerId: string): FinalResult {
  return { pin: session.pin, title: session.quizTitle, playerId, expiresAt: Date.now() + 2 * 60 * 60 * 1000,
    players: Object.values(session.players).map(p => ({ id: p.id, nickname: p.nickname || p.name || '', avatar: p.avatar, score: p.score })).sort((a, b) => b.score - a.score) };
}
export function saveFinalResult(value: FinalResult) { try { window.sessionStorage.setItem(key(value.pin), JSON.stringify(value)); } catch { /* The current result remains available without storage. */ } }
export function clearFinalResult(pin: string) { try { window.sessionStorage.removeItem(key(pin)); } catch {} }
export function readFinalResult(pin: string): FinalResult | null {
  if (!/^\d{6}$/.test(pin)) return null;
  try {
    const v = JSON.parse(window.sessionStorage.getItem(key(pin)) || 'null') as FinalResult;
    if (!v || v.pin !== pin || typeof v.title !== 'string' || v.title.length > 500 || typeof v.playerId !== 'string' || !Number.isFinite(v.expiresAt) || v.expiresAt <= Date.now() || !Array.isArray(v.players) || v.players.length > 1000 || !v.players.some(p => p.id === v.playerId) ||
      v.players.some(p => typeof p.id !== 'string' || typeof p.nickname !== 'string' || p.nickname.length > 100 || typeof p.avatar !== 'string' || p.avatar.length > 100 || !Number.isFinite(p.score) || p.score < 0)) { clearFinalResult(pin); return null; }
    return v;
  } catch { clearFinalResult(pin); return null; }
}

/** Render the same personal result card shown on screen, without external images or session secrets. */
export async function resultImage(result: FinalResult, language: Language): Promise<Blob> {
  const t = gameExperienceTranslations[language], canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1080;
  const c = canvas.getContext('2d'); if (!c) throw new Error('Canvas unavailable');
  const player = result.players.find(p => p.id === result.playerId); if (!player) throw new Error('Player missing');
  c.fillStyle = '#f4fafa'; c.fillRect(0, 0, 1080, 1080);
  c.fillStyle = '#00616d'; c.fillRect(0, 0, 1080, 140);
  c.textAlign = 'center'; c.fillStyle = '#ffffff'; c.font = 'bold 58px system-ui, sans-serif'; c.fillText('Qurioso', 540, 95);
  const text = (value: string, y: number, font: string, color: string, maxLines: number) => {
    c.font = font; c.fillStyle = color;
    const lines: string[] = []; let line = '';
    for (const char of Array.from(value.replace(/\s+/g, ' '))) {
      if (c.measureText(line + char).width > 900) { lines.push(line); line = ''; }
      line += char;
    }
    if (line) lines.push(line);
    lines.slice(0, maxLines).forEach((value, index) => c.fillText(index === maxLines - 1 && lines.length > maxLines ? value.slice(0, -1) + '…' : value, 540, y + index * 46));
  };
  text(result.title, 225, 'bold 36px system-ui, sans-serif', '#00616d', 3);
  text(player.nickname, 410, 'bold 44px system-ui, sans-serif', '#18383d', 2);
  text(t.score, 565, '32px system-ui, sans-serif', '#435f64', 1);
  text(new Intl.NumberFormat(language).format(player.score), 685, 'bold 92px system-ui, sans-serif', '#00616d', 1);
  text(`${t.position} ${result.players.findIndex(p => p.id === player.id) + 1} ${t.of} ${result.players.length}`, 805, 'bold 42px system-ui, sans-serif', '#18383d', 1);
  c.fillStyle = '#ff9628'; c.fillRect(420, 885, 240, 8);
  text(t.finished, 965, '30px system-ui, sans-serif', '#435f64', 1);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image encoding failed')), 'image/png'));
}
