import type { Language } from '../../i18n/translations';
import { MIN_DEADLINE_MS, MAX_DEADLINE_MS } from '../../services/homework';

export const formatDeadline = (time: number, language: Language) =>
  new Intl.DateTimeFormat(language, { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(time);

/** The largest whole unit of the time left: "2 days", "5 hours", "12 minutes". */
export function formatRemaining(milliseconds: number, language: Language) {
  const minutes = Math.max(1, Math.ceil(milliseconds / 60000));
  const [value, unit] = minutes >= 2 * 1440 ? [Math.floor(minutes / 1440), 'day'] : minutes >= 120 ? [Math.floor(minutes / 60), 'hour'] : [minutes, 'minute'];
  return new Intl.NumberFormat(language, { style: 'unit', unit, unitDisplay: 'long' }).format(value);
}

// <input type="datetime-local"> works in local time without a zone.
export function toLocalInput(time: number) {
  const date = new Date(time), two = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}T${two(date.getHours())}:${two(date.getMinutes())}`;
}
export const fromLocalInput = (value: string) => new Date(value).getTime();

/** Tomorrow evening: a common homework deadline. */
export function defaultDeadline(now = Date.now()) {
  const date = new Date(now); date.setDate(date.getDate() + 1); date.setHours(20, 0, 0, 0);
  return date.getTime();
}
export const deadlineValid = (time: number, now = Date.now()) => Number.isFinite(time) && time >= now + MIN_DEADLINE_MS && time <= now + MAX_DEADLINE_MS;
