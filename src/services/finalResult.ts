import type { GameSession } from '../types/quiz';
import type { Language } from '../i18n/translations';
import { gameExperienceTranslations } from '../i18n/gameExperience';

export interface ResultRow { id: string; nickname: string; avatar: string; score: number; totalTimeTakenMs?: number }
export interface FinalResult { pin: string; title: string; playerId: string; players: ResultRow[]; expiresAt: number }
const key = (pin: string) => `qurioso_final_result_v1:${pin}`;
export function finalResult(session: GameSession, playerId: string): FinalResult {
  return { pin: session.pin, title: session.quizTitle, playerId, expiresAt: Date.now() + 2 * 60 * 60 * 1000,
    players: Object.values(session.players).map(p => ({ id: p.id, nickname: p.nickname || p.name || '', avatar: p.avatar, score: p.score, totalTimeTakenMs: p.totalTimeTakenMs || 0 })).sort((a, b) => b.score - a.score || (a.totalTimeTakenMs || 0) - (b.totalTimeTakenMs || 0)) };
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

/** Render a podium and complete ranking, matching the teacher's result identity. */
export async function resultImage(result: FinalResult, language: Language): Promise<Blob> {
  const t = gameExperienceTranslations[language], canvas = document.createElement('canvas');
  const player = result.players.find(p => p.id === result.playerId); if (!player) throw new Error('Player missing');
  const columns = Math.max(1, Math.ceil(result.players.length / 180));
  const rows = Math.ceil(result.players.length / columns), rowHeight = 72;
  canvas.width = 1080; canvas.height = Math.max(1080, 920 + rows * rowHeight);
  const c = canvas.getContext('2d'); if (!c) throw new Error('Canvas unavailable');
  c.fillStyle = '#f4fafa'; c.fillRect(0, 0, canvas.width, canvas.height);
  const draw = (value: string, x: number, y: number, size: number, width: number, color = '#075e63', weight = 'bold') => {
    c.fillStyle = color; c.textAlign = 'center';
    let fontSize = size;
    c.font = `${weight} ${fontSize}px system-ui, sans-serif`;
    while (c.measureText(value).width > width && fontSize > 6) { fontSize -= .5; c.font = `${weight} ${fontSize}px system-ui, sans-serif`; }
    c.fillText(value, x, y, width);
  };
  c.fillStyle = '#075e63'; c.fillRect(0, 0, 1080, 130);
  draw('Qurioso', 540, 88, 58, 960, '#ffffff');
  draw(t.finished, 540, 182, 30, 960);
  draw(result.title, 540, 245, 42, 980);
  // Same winner order and podium colors as the teacher: second, first, third.
  for (const [column, index] of [1, 0, 2].entries()) {
    const p = result.players[index]; if (!p) continue;
    const x = 190 + column * 350, y = index === 0 ? 330 : 380;
    draw(p.avatar, x, y, 76, 280);
    draw(p.nickname, x, y + 58, 32, 300, '#18383d');
    c.fillStyle = ['#ff963b', '#d6e4e6', '#ead4bc'][index];
    c.fillRect(x - 145, y + 85, 290, 200 - (y - 330));
    draw(`#${index + 1}`, x, y + 155, 54, 250, '#18383d');
    draw(new Intl.NumberFormat(language).format(p.score), x, 605, 38, 260, '#18383d');
  }
  c.fillStyle = '#ffffff'; c.fillRect(40, 650, 1000, 130);
  draw(`${player.avatar} ${player.nickname}`, 540, 705, 38, 950, '#18383d');
  const rank = result.players.findIndex(p => p.id === player.id) + 1;
  draw(`${t.position} ${rank} ${t.of} ${result.players.length} · ${new Intl.NumberFormat(language).format(player.score)} ${t.points}`, 540, 755, 30, 950);
  draw(t.ranking, 540, 850, 36, 980);
  const cellWidth = 1000 / columns;
  result.players.forEach((p, index) => {
    const column = Math.floor(index / rows), row = index % rows;
    const left = 40 + column * cellWidth, top = 880 + row * rowHeight;
    c.fillStyle = p.id === result.playerId ? '#ffe2c6' : row % 2 ? '#ffffff' : '#e7f1f1';
    c.fillRect(left, top, cellWidth - 5, rowHeight - 5);
    draw(`#${index + 1}  ${p.avatar}  ${p.nickname}  ·  ${new Intl.NumberFormat(language).format(p.score)}`, left + (cellWidth - 5) / 2, top + 44, 30, cellWidth - 30, '#18383d');
  });
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image encoding failed')), 'image/png'));
}
