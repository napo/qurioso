/** Server monotonic time is the authority. This allowance is fixed, never client-reported RTT. */
export const LAN_LATENCY_ALLOWANCE_MS = 100;
export const SCORE_TIME_QUANTUM_MS = 100;

export interface RoundClock { startedAt: number; durationMs: number }
export function remainingMs(clock: RoundClock, now: number): number {
  return Math.max(0, clock.durationMs - (now - clock.startedAt));
}
export function receivedTimeMs(clock: RoundClock, now: number): number {
  const elapsed = Math.max(0, now - clock.startedAt - LAN_LATENCY_ALLOWANCE_MS);
  return Math.round(elapsed / SCORE_TIME_QUANTUM_MS) * SCORE_TIME_QUANTUM_MS;
}
